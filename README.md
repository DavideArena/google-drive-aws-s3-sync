# Google Drive to S3 Sync Manager

## Disclaimer

### This tool was made for a personal sync of Google Drive folder to an S3, probably has bugs and is missing feature likes

- Renamed files are not handled, they will be handled as new files
- Trashed files on Google Drive will not be deleted on S3 Bucket

Take care before running in production or in your personal environment.

## 📌 Introduction

Scope of this project was to create an automatic sync between a `Google Drive folder` and an `S3 Bucket`, using both APIs offered by two services. It uses the Google Drive API to list and export files while leveraging the AWS SDK for secure cloud storage. The service ensures that files are converted to appropriate formats when necessary and maintains a structured folder hierarchy.
The sync on each run checks for new/updated files to be synced of last day. It is expected to be executed in a scheduled way, but could be use as one shot too (updating the filter).

## 🚀 Features

- Recursively syncs folders and files from Google Drive to S3.
- Converts Google Docs, Sheets, and Slides into appropriate formats (e.g., DOCX, XLSX, PPTX).
- Enforces a configurable folder nesting limit to prevent deep recursion.
- Logs detailed sync information using `pino` for easy debugging.
- Supports pagination for large folders in Google Drive.
- Uses AWS SDK's `Upload` class for efficient file streaming.

## 🛠 Installation

### 1️⃣ Clone the repository

```sh
git clone https://github.com/DavideArena/google-drive-aws-s3-sync
cd google-drive-aws-s3-sync
```

### 2️⃣ Install dependencies

```sh
npm install
```

## ⚙️ Configuration

Before running the script, set up environment variables or a configuration file.

### Required Environment Variables

| Variable                   | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `AWS_S3_REGION`            | AWS region of the S3 bucket                    |
| `AWS_S3_BUCKET_NAME`       | Name of the S3 bucket                          |
| `AWS_S3_ACCESS_KEY_ID`     | AWS IAM Access Key ID                          |
| `AWS_S3_SECRET_ACCESS_KEY` | AWS IAM Secret Access Key                      |
| `GOOGLE_PROJECT_ID`        | Google Cloud Project ID                        |
| `GOOGLE_PRIVATE_KEY_ID`    | Google Service Account Private Key ID          |
| `GOOGLE_PRIVATE_KEY`       | Google Service Account Private Key (multiline) |
| `GOOGLE_CLIENT_EMAIL`      | Google Service Account Email                   |
| `GOOGLE_CLIENT_ID`         | Google Client ID                               |
| `SYNC_NESTING_LEVEL_LIMIT` | Maximum folder depth to sync                   |

These values can be stored in a `.env` file:

```
AWS_S3_REGION=us-east-1
AWS_S3_BUCKET_NAME=my-s3-bucket
AWS_S3_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_S3_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
GOOGLE_PROJECT_ID=your-google-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_CLIENT_EMAIL=<your-service-account-email@your-project.iam.gserviceaccount.com>
GOOGLE_CLIENT_ID=your-google-client-id
SYNC_NESTING_LEVEL_LIMIT=3
```

## 📌 Usage

To start syncing a Google Drive folder:

```typescript
import { SyncManager } from './sync-manager';
import { ConfigSchema } from './config';
import pino from 'pino';

const logger = pino();
const config: ConfigSchema = {
  AWS_S3_REGION: 'us-east-1',
  AWS_S3_BUCKET_NAME: 'my-s3-bucket',
  AWS_S3_ACCESS_KEY_ID: 'your-access-key',
  AWS_S3_SECRET_ACCESS_KEY: 'your-secret-key',
  GOOGLE_PROJECT_ID: 'your-google-project-id',
  GOOGLE_PRIVATE_KEY_ID: 'your-private-key-id',
  GOOGLE_PRIVATE_KEY: 'your-private-key',
  GOOGLE_CLIENT_EMAIL: 'your-service-account-email',
  GOOGLE_CLIENT_ID: 'your-client-id',
  SYNC_NESTING_LEVEL_LIMIT: '3',
};

const syncManager = new SyncManager(config, logger);

// Start syncing a Google Drive folder (provide the folder ID)
syncManager.syncFolder('your-drive-folder-id').then(() => {
  logger.info('Sync completed!');
});
```

## 📂 File Handling

- **Google Drive Folders**: Recursively processed up to the configured depth.
- **Google Drive Files**: If they are Google Docs, Sheets, or Slides, they are exported to compatible formats before upload.
- **Other File Types**: Directly streamed from Google Drive to S3.

### Supported Google File Formats

| Google File Type           | Export Format        |
| -------------------------- | -------------------- |
| Google Docs (`.gdoc`)      | `.docx` (Word)       |
| Google Sheets (`.gsheet`)  | `.xlsx` (Excel)      |
| Google Slides (`.gslides`) | `.pptx` (PowerPoint) |
| Google Drawings            | `.png`               |
| Google Scripts             | `.json`              |
| Google Jams                | `.pdf`               |

## 📜 Logging

This project uses [`pino`](https://github.com/pinojs/pino) for logging.

- **INFO logs** track file sync progress.
- **WARN logs** indicate skipped files or missing configurations.
- **ERROR logs** report critical failures.

## 🛠 Troubleshooting

### Issue: `Error: SYNC_NESTING_LEVEL_LIMIT must be a number`

- Ensure the `SYNC_NESTING_LEVEL_LIMIT` is a valid number in your configuration.

### Issue: `Skipping file download for mimeType: application/vnd.google-apps...`

- The script cannot export this file type. Ensure it's a supported Google format.

### Issue: `GoogleAuthError: Invalid credentials`

- Double-check your Google service account credentials.

## ⏳ Deployment as a Scheduled AWS Lambda with CDK

This project includes an AWS CDK (Cloud Development Kit) setup to deploy the `SyncManager` as a scheduled AWS Lambda function using **Amazon EventBridge**.

### Deployment Overview

- The Lambda function is created using AWS CDK.
- EventBridge (formerly CloudWatch Events) triggers the Lambda at a scheduled interval (cron job).
- The function executes `SyncManager` to sync Google Drive files to S3 automatically.

### Steps to Deploy

1. Ensure you have [AWS CDK installed](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html).

2. Bootstrap your AWS environment (if not already done):

   ```sh
   cdk bootstrap
   ```

3. Deploy the CDK stack:

   ```sh
   cdk deploy
   ```

This will create the Lambda function, necessary IAM roles, and an EventBridge rule to trigger the sync process automatically.

## 📜 License

This project is licensed under the MIT License.
