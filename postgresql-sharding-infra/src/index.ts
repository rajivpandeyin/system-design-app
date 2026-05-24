import * as cdk from 'aws-cdk-lib';
import { PostgresShardingStack } from './stack';

const app = new cdk.App();

const config = {
  environment: app.node.tryGetContext('environment') || 'production',
  region: app.node.tryGetContext('region') || 'us-east-1',
  vpcCidr: app.node.tryGetContext('vpcCidr') || '10.0.0.0/16',
  shardCount: app.node.tryGetContext('shardCount') || 2,
  instanceType: app.node.tryGetContext('instanceType') || 't3.medium',
  storageSize: app.node.tryGetContext('storageSize') || 10,
  storageType: app.node.tryGetContext('storageType') || 'gp3',
  postgresVersion: app.node.tryGetContext('postgresVersion') || '14.10',
};

new PostgresShardingStack(app, 'PostgresShardingStack', {
  environment: config.environment,
  region: config.region,
  vpcCidr: config.vpcCidr,
  shardCount: config.shardCount,
  instanceType: config.instanceType,
  storageSize: config.storageSize,
  storageType: config.storageType,
  postgresVersion: config.postgresVersion,
  description: 'PostgreSQL Hash-Based Sharding Infrastructure with Cross-Replication',
  tags: {
    Project: 'PostgreSQL-Sharding',
    Environment: config.environment,
    ManagedBy: 'CDK',
  },
});

app.synth();
