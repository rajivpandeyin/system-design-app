import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface DatabaseConstructProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  rdsSecurityGroup: ec2.SecurityGroup;
  rdsInstanceClass: string;
  tags: Record<string, string>;
}

export class DatabaseConstruct extends Construct {
  public readonly database: rds.DatabaseCluster | rds.DatabaseInstance;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly dbKey: kms.Key;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);

    // Create KMS key for encryption at rest
    // Enforce key rotation every year
    this.dbKey = new kms.Key(this, 'RdsKmsKey', {
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pendingWindow: cdk.Duration.days(7),
      description: 'KMS key for flairX RDS encryption',
    });

    // Create a secret for database credentials
    // Credentials will be stored in Secrets Manager with automatic rotation
    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: 'flairx/rds/postgres',
      description: 'RDS PostgreSQL credentials for flairX',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'flairxadmin',
        }),
        generateStringKey: 'password',
        passwordLength: 32,
        excludeCharacters: '"@/\\',
      },
    });

    // Single-AZ deployment initially (cost-optimized)
    // Architected so Multi-AZ can be enabled in one CDK change
    // db.t4g.medium (ARM Graviton, ~10% cheaper than db.t3.medium)
    const dbInstance = new rds.DatabaseInstance(this, 'PostgresDb', {
      engine: rds.DatabaseEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_1,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MEDIUM
      ),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.rdsSecurityGroup],
      databaseName: 'flairx',
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      // Storage: gp3 (cheaper than gp2, free 3000 IOPS baseline)
      storageType: rds.StorageType.GP3,
      allocatedStorage: 100,
      iops: 3000, // gp3 free baseline
      storageThroughput: 125,
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      backupRetention: cdk.Duration.days(7),
      preferredBackupWindow: '03:00-04:00', // Early morning UTC
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      multiAz: false, // Single-AZ initially; set to true for Multi-AZ in one change: multiAz: true
      publiclyAccessible: false,
      encryption: kms.Key.fromKeyArn(this, 'ImportedKey', this.dbKey.keyArn),
      encryptionKey: this.dbKey,
      // Enable Performance Insights (7-day retention free for db.t4g)
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      // Enable CloudWatch logging
      cloudwatchLogsRetentionRole: new cdk.aws_iam.Role(
        this,
        'RdsLogsRole',
        {
          assumedBy: new cdk.aws_iam.ServicePrincipal('rds.amazonaws.com'),
        }
      ),
      enableCloudwatchLogsExports: [
        'postgresql', // PostgreSQL error logs
        // 'upgrade' — optional slow query log (very verbose)
      ],
      // Enable automatic minor version upgrades during maintenance window
      autoMinorVersionUpgrade: true,
      // Copy tags to snapshots for cost tracking
      copyTagsToSnapshot: true,
      // Enable IAM database authentication (optional, for future use)
      iamAuthentication: true,
      // Enable Enhanced Monitoring (optional, premium feature)
      monitoringInterval: cdk.Duration.seconds(0), // Disabled by default to save costs
    });

    // Store the database instance for later reference
    this.database = dbInstance;

    // Enable automatic rotation of database credentials every 30 days
    dbInstance.addRotationSingleUser({
      automaticallyAfter: cdk.Duration.days(30),
      excludeCharacters: '"@/\\',
    });

    // Tag all resources
    Object.entries(props.tags).forEach(([key, value]) => {
      cdk.Tags.of(dbInstance).add(key, value);
      cdk.Tags.of(this.dbSecret).add(key, value);
      cdk.Tags.of(this.dbKey).add(key, value);
    });

    // Export database endpoint and secret ARN for application use
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      exportName: 'FlairX-DbEndpoint',
    });

    new cdk.CfnOutput(this, 'DbPort', {
      value: dbInstance.dbInstanceEndpointPort,
      exportName: 'FlairX-DbPort',
    });

    new cdk.CfnOutput(this, 'DbName', {
      value: 'flairx',
      exportName: 'FlairX-DbName',
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretFullArn!,
      exportName: 'FlairX-DbSecretArn',
    });

    new cdk.CfnOutput(this, 'DbSecretName', {
      value: this.dbSecret.secretName,
      exportName: 'FlairX-DbSecretName',
    });
  }

  /**
   * Enable Multi-AZ deployment
   * This can be called separately or the construct can be modified to set multiAz: true
   * NOTE: In one CDK change, set multiAz: true in the DatabaseInstance configuration
   */
  enableMultiAz(): void {
    // This is a placeholder reminder
    // To enable Multi-AZ, modify the DatabaseInstance configuration:
    // multiAz: true
    console.log(
      'To enable Multi-AZ, set multiAz: true in DatabaseInstance configuration'
    );
  }
}
