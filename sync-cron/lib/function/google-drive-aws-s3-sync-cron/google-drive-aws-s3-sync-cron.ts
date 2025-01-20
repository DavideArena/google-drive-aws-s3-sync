import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { join } from 'path';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { config, ConfigSchema } from '../../../../config';

export class GoogleDriveAwsS3SyncLambdaCron extends Construct {
  constructor(scope: Construct) {
    const id = `GoogleDriveAwsS3SyncLambdaCron`;
    super(scope, id);

    const googleDriveAwsS3SyncLambdaCron = new NodejsFunction(this, id, {
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      functionName: id,
      logRetention: RetentionDays.THREE_MONTHS,
      bundling: {
        sourceMap: true,
      },
      environment: {
        LOG_LEVEL: config.LOG_LEVEL,
        GOOGLE_DRIVE_API_KEY: config.GOOGLE_DRIVE_API_KEY,
        GOOGLE_DRIVE_ROOT_FOLDER_ID: config.GOOGLE_DRIVE_ROOT_FOLDER_ID,
        GOOGLE_PROJECT_ID: config.GOOGLE_PROJECT_ID,
        GOOGLE_PRIVATE_KEY_ID: config.GOOGLE_PRIVATE_KEY_ID,
        GOOGLE_PRIVATE_KEY: config.GOOGLE_PRIVATE_KEY,
        GOOGLE_CLIENT_EMAIL: config.GOOGLE_CLIENT_EMAIL,
        GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID,
        AWS_S3_ACCESS_KEY_ID: config.AWS_S3_ACCESS_KEY_ID,
        AWS_S3_SECRET_ACCESS_KEY: config.AWS_S3_SECRET_ACCESS_KEY,
        AWS_S3_REGION: config.AWS_S3_REGION,
        AWS_S3_BUCKET_NAME: config.AWS_S3_BUCKET_NAME,
        SYNC_NESTING_LEVEL_LIMIT: config.SYNC_NESTING_LEVEL_LIMIT,
      } satisfies ConfigSchema,
      timeout: Duration.minutes(5),
      entry: join(__dirname, 'google-drive-aws-s3-sync-cron.lambda.ts'),
    });

    // Create an EventBridge rule to schedule the Lambda function
    new Rule(this, `GoogleDriveAwsS3SyncLambdaCronRuleSchedule`, {
      schedule: Schedule.cron({
        hour: '1',
        minute: '0',
        day: '*',
        month: '*',
        year: '*',
      }),
      ruleName: `GoogleDriveAwsS3SyncLambdaCronRuleSchedule`,
      enabled: true,
      targets: [
        new LambdaFunction(googleDriveAwsS3SyncLambdaCron, {
          retryAttempts: 0,
        }),
      ],
    });
  }
}
