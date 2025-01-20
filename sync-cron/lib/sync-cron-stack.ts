import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GoogleDriveAwsS3SyncLambdaCron } from './function/google-drive-aws-s3-sync-cron/google-drive-aws-s3-sync-cron';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SyncCronStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new GoogleDriveAwsS3SyncLambdaCron(this);
  }
}
