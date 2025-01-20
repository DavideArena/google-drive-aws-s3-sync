import { SyncManager } from '../../../../google-drive-aws-s3-sync';
import { config } from './../../../../config';
import pino from 'pino';

const logger = pino({ level: config.LOG_LEVEL });

const syncManager = new SyncManager(config, logger);

export const handler = async () => {
  try {
    logger.info('Starting sync process');

    const rootFolderId = config.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    // Start the sync process
    await syncManager.syncFolder(rootFolderId);
    logger.info('Sync completed successfully');
  } catch (error) {
    logger.error({ err: error }, 'Error during sync');
    throw error;
  }
};
