import { ConfigSchema } from './config';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { addDays, startOfDay } from 'date-fns';
import { drive_v3, Auth } from 'googleapis';
import { Logger } from 'pino';
import { PassThrough } from 'stream';

const DEFAULT_EXPORT_FORMATS: Record<string, string> = {
  'application/vnd.google-apps.document':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Export Google Docs as PDF
  'application/vnd.google-apps.spreadsheet':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Export Google Sheets as Excel
  'application/vnd.google-apps.presentation':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // Export Google Slides as PDF
  'application/vnd.google-apps.drawing': 'image/png', // Export Google Drawings as PNG
  'application/vnd.google-apps.script':
    'application/vnd.google-apps.script+json', // Apps Script JSON Manifest
  'application/vnd.google-apps.jam': 'application/pdf',
};

const DRIVE_AUTH_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export class SyncManager {
  private s3Client: S3Client;
  private driveClient: drive_v3.Drive;
  private nestingLimit: number;
  private config: ConfigSchema;
  private logger: Logger;

  constructor(config: ConfigSchema, logger: Logger) {
    this.config = config;
    this.logger = logger;

    this.nestingLimit = parseInt(config.SYNC_NESTING_LEVEL_LIMIT);
    if (isNaN(this.nestingLimit)) {
      this.logger.error('SYNC_NESTING_LEVEL_LIMIT must be a number');
      throw new Error('SYNC_NESTING_LEVEL_LIMIT must be a number');
    }

    this.s3Client = new S3Client({
      region: config.AWS_S3_REGION,
      credentials: {
        secretAccessKey: config.AWS_S3_SECRET_ACCESS_KEY,
        accessKeyId: config.AWS_S3_ACCESS_KEY_ID,
      },
    });

    const auth = new Auth.GoogleAuth({
      scopes: DRIVE_AUTH_SCOPES,
      credentials: {
        type: 'service_account',
        project_id: config.GOOGLE_PROJECT_ID,
        private_key_id: config.GOOGLE_PRIVATE_KEY_ID,
        private_key: config.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: config.GOOGLE_CLIENT_EMAIL,
        client_id: config.GOOGLE_CLIENT_ID,
        universe_domain: 'googleapis.com',
      },
    });

    this.driveClient = new drive_v3.Drive({ auth });
  }

  /**
   * Recursively syncs all files and subfolders of a given Google Drive folder to AWS S3.
   *
   * @param folderId The ID of the Google Drive folder to sync.
   * @param currentPathDirectories The path of the current folder in the Google Drive hierarchy.
   * @returns A Promise that resolves when all files in the folder have been synced to S3.
   */
  async syncFolder(folderId: string, currentPathDirectories: string[] = []) {
    if (currentPathDirectories.length > 0) {
      this.logger.info(`Entering folder: ${currentPathDirectories.join('/')}`);
    } else {
      this.logger.info('Entering root folder');
    }

    const items = await this.listDriveFolderContents(folderId);

    this.logger.info({ items }, 'Items in folder');

    for (const item of items || []) {
      if (!item.id || !item.name || !item.mimeType) {
        this.logger.info(
          { item },
          'Skipping item because `id`, `name` or `mimeType` is missing',
        );
        continue;
      }

      // If is a folder, should go deeper
      if (item.mimeType === DRIVE_FOLDER_MIME_TYPE) {
        const newPathDirectories = [...currentPathDirectories, item.name];

        if (newPathDirectories.length > this.nestingLimit) {
          this.logger.info(
            {
              currentPath: newPathDirectories.join('/'),
              nestingLimit: this.nestingLimit,
            },
            'Skipping folder because nesting limit reached',
          );
          continue;
        }
        await this.syncFolder(item.id, newPathDirectories);
      } else {
        this.logger.info({ item }, 'Processing file');

        // If is a file, should upload to S3
        await this.uploadFileToS3({
          fileId: item.id,
          fileName: item.name,
          fileMimeType: item.mimeType,
          folderPath:
            currentPathDirectories.length > 1
              ? currentPathDirectories.join('/')
              : currentPathDirectories[0],
        });
      }
    }
  }

  /**
   * Lists the contents of a Google Drive folder.
   * @param {string} folderId The id of the folder to list
   * @returns {Promise<drive_v3.Schema$File[]>} A promise that resolves with an array of file objects
   */
  private async listDriveFolderContents(
    folderId: string,
  ): Promise<drive_v3.Schema$File[]> {
    const yesterday = startOfDay(addDays(new Date(), -1)).toISOString();

    // Loop through all the pages of the folder contents
    let safeCounter = 0;

    const files = [];

    let nextPageToken: string | undefined = undefined;

    while (safeCounter <= 20) {
      safeCounter++;

      this.logger.info(
        { folderId, nextPageToken },
        `Listing folder contents at page ${safeCounter}`,
      );

      const response: drive_v3.Schema$FileList = (
        await this.driveClient.files.list({
          q: `'${folderId}' in parents and trashed = false and (mimeType = '${DRIVE_FOLDER_MIME_TYPE}' OR (createdTime >= '${yesterday}' OR modifiedTime >= '${yesterday}'))`,
          fields: 'files(id, name, mimeType, trashed), nextPageToken',
          pageToken: nextPageToken,
          pageSize: 1000,
        })
      ).data;

      files.push(...(response.files || []));

      if (!response.nextPageToken) {
        break;
      }

      nextPageToken = response.nextPageToken || undefined;
    }

    return files;
  }

  /**
   * Uploads a file to S3, given a file ID, file name, file mime type and folder path.
   * If the file is a Google Docs file, it will be exported with the correct mime type.
   * @param {{ fileId: string, fileName: string, fileMimeType: string, folderPath: string }} params The parameters.
   * @returns {Promise<void>} A promise that resolves when the file is uploaded.
   */
  private async uploadFileToS3(params: {
    fileId: string;
    fileName: string;
    fileMimeType: string;
    folderPath: string;
  }): Promise<void> {
    const { fileId, fileName, folderPath, fileMimeType } = params;

    // Default use the mimeType of file loaded from Google Drive
    let uploadFileContentType = fileMimeType;

    const s3FileKey = `${folderPath ? folderPath + '/' : ''}${fileName}`;

    this.logger.info({ folderPath }, `Uploading file: ${s3FileKey}`);

    let getFileResponse;

    // Google docs files need to be exported with export function. Other cases can be downloaded directly with get function
    if (fileMimeType.startsWith('application/vnd.google-apps')) {
      const exportMimeType = this.getGoogleFileExportMimeType(fileMimeType);

      if (!exportMimeType) {
        this.logger.warn(
          `Skipping file download for mimeType: ${fileMimeType} because no export format found`,
        );
        return;
      }

      // If exportMimeType is found for google file, use it as the content type
      uploadFileContentType = exportMimeType;

      getFileResponse = await this.driveClient.files.export(
        { fileId: fileId, alt: 'media', mimeType: exportMimeType },
        { responseType: 'stream' },
      );
    } else {
      getFileResponse = await this.driveClient.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'stream' },
      );
    }

    const passThroughStream = new PassThrough();

    getFileResponse.data.pipe(passThroughStream);

    const parallelUploads3 = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.config.AWS_S3_BUCKET_NAME,
        Key: s3FileKey,
        Body: passThroughStream,
        ContentType: uploadFileContentType,
      },

      // Concurrency configuration
      queueSize: 4,

      // Size of each part, in bytes
      partSize: 1024 * 1024 * 5,
      leavePartsOnError: false,
    });

    parallelUploads3.on('httpUploadProgress', (progress) => {
      this.logger.info({ progress }, 'Uploading file to S3');
    });

    await parallelUploads3.done();

    this.logger.info(`Uploaded file: ${s3FileKey}`);
  }

  /**
   * Gets the export mime type for a given google file mime type.
   * @param mimeType - The mime type of the Google file.
   * @returns The export mime type or null if no export format is found.
   */
  private getGoogleFileExportMimeType(mimeType: string) {
    const exportMimeType = DEFAULT_EXPORT_FORMATS[mimeType] || null;

    if (!exportMimeType) {
      this.logger.warn(`No export format found for mimeType: ${mimeType}`);
    }

    return exportMimeType;
  }
}
