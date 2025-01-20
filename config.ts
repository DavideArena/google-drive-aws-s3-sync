import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: __dirname + '/.env' });
import { z } from 'zod';

export const configSchema = z.object({
  GOOGLE_DRIVE_API_KEY: z.string(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string(),
  AWS_S3_BUCKET_NAME: z.string(),
  AWS_S3_ACCESS_KEY_ID: z.string(),
  AWS_S3_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_REGION: z.string(),
  GOOGLE_PROJECT_ID: z.string(),
  GOOGLE_PRIVATE_KEY_ID: z.string(),
  GOOGLE_PRIVATE_KEY: z.string(),
  GOOGLE_CLIENT_EMAIL: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  SYNC_NESTING_LEVEL_LIMIT: z.string().default('50'),
  LOG_LEVEL: z.string().default('info'),
});

export type ConfigSchema = z.infer<typeof configSchema>;

export const config = configSchema.parse(process.env);
