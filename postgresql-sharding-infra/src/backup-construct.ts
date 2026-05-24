import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface BackupConstructProps {
  environment: string;
}

export class BackupConstruct extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: BackupConstructProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'backup-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.STANDARD_IA,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(365),
        },
      ],
      enforceSSL: true,
    });

    cdk.Tags.of(this.bucket).add('Name', `postgres-backup-${props.environment}`);
    cdk.Tags.of(this.bucket).add('Purpose', 'PostgreSQL sharding backups');
  }
}
