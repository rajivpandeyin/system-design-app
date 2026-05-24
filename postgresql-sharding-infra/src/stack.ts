import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcConstruct } from './vpc-construct';
import { SecurityGroupConstruct } from './security-group-construct';
import { PostgresInstanceConstruct } from './postgres-construct';
import { BackupConstruct } from './backup-construct';
import { SecretsConstruct } from './secrets-construct';
import { MonitoringConstruct } from './monitoring-construct';

export interface PostgresShardingStackProps extends cdk.StackProps {
  environment: string;
  region: string;
  vpcCidr: string;
  shardCount: number;
  instanceType: string;
  storageSize: number;
  storageType: string;
  postgresVersion: string;
}

export class PostgresShardingStack extends cdk.Stack {
  public readonly vpcConstruct: VpcConstruct;
  public readonly instances: PostgresInstanceConstruct[] = [];

  constructor(scope: Construct, id: string, props: PostgresShardingStackProps) {
    super(scope, id, {
      ...props,
      env: {
        region: props.region,
      },
    });

    // VPC Setup
    this.vpcConstruct = new VpcConstruct(this, 'vpc-construct', {
      cidr: props.vpcCidr,
    });

    // Security Groups
    const sgConstruct = new SecurityGroupConstruct(this, 'sg-construct', {
      vpc: this.vpcConstruct.vpc,
    });

    // Backup Storage
    const backupConstruct = new BackupConstruct(this, 'backup-construct', {
      environment: props.environment,
    });

    // Secrets Manager
    const secretsConstruct = new SecretsConstruct(this, 'secrets-construct', {
      shardCount: props.shardCount,
    });

    // PostgreSQL Instances with Cross-Replication
    // Shard 0: Primary on Instance 0, Standby on Instance 1
    // Shard 1: Primary on Instance 1, Standby on Instance 0
    const primaryConfig = [
      { isPrimaryFor: [0], isStandbyFor: [1] }, // Instance 0
      { isPrimaryFor: [1], isStandbyFor: [0] }, // Instance 1
    ];

    for (let i = 0; i < 2; i++) {
      const postgresConstruct = new PostgresInstanceConstruct(
        this,
        `postgres-${i}`,
        {
          vpc: this.vpcConstruct.vpc,
          securityGroup: sgConstruct.postgresSecurityGroup,
          backupBucket: backupConstruct.bucket,
          shardId: i,
          primaryShardId: primaryConfig[i].isPrimaryFor[0],
          isPrimaryFor: primaryConfig[i].isPrimaryFor,
          isStandbyFor: primaryConfig[i].isStandbyFor,
        }
      );

      this.instances.push(postgresConstruct);
    }

    // Monitoring
    const monitoringConstruct = new MonitoringConstruct(this, 'monitoring-construct', {
      instances: this.instances.map((ic) => ic.instance),
      environment: props.environment,
    });

    // Outputs
    this.instances.forEach((instance, index) => {
      new cdk.CfnOutput(this, `Instance-${index}-PublicIP`, {
        value: instance.instance.instancePublicIp,
        description: `Public IP of PostgreSQL shard ${index}`,
        exportName: `PostgreSQL-Shard-${index}-IP`,
      });

      new cdk.CfnOutput(this, `Instance-${index}-PrivateIP`, {
        value: instance.primaryIp,
        description: `Private IP of PostgreSQL shard ${index}`,
        exportName: `PostgreSQL-Shard-${index}-PrivateIP`,
      });
    });

    new cdk.CfnOutput(this, 'BackupBucketName', {
      value: backupConstruct.bucket.bucketName,
      description: 'S3 bucket for PostgreSQL backups',
      exportName: 'PostgreSQL-Backup-Bucket',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpcConstruct.vpc.vpcId,
      description: 'VPC ID for PostgreSQL sharding',
      exportName: 'PostgreSQL-VPC-ID',
    });
  }
}
