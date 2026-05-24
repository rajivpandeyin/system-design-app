import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export interface PostgresInstanceConstructProps {
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  backupBucket: s3.Bucket;
  shardId: number;
  primaryShardId: number;
  isPrimaryFor: number[];
  isStandbyFor: number[];
}

export class PostgresInstanceConstruct extends Construct {
  public readonly instance: ec2.Instance;
  public readonly primaryIp: string;

  constructor(scope: Construct, id: string, props: PostgresInstanceConstructProps) {
    super(scope, id);

    // IAM Role for EC2 instance
    const role = new iam.Role(this, `postgres-role-${props.shardId}`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    // Permissions for S3 backups
    props.backupBucket.grantReadWrite(role);

    // CloudWatch agent permissions
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
    );

    // User data script for PostgreSQL setup
    const userDataScript = this.generateUserData(
      props.shardId,
      props.primaryShardId,
      props.isPrimaryFor,
      props.isStandbyFor
    );

    this.instance = new ec2.Instance(this, `postgres-instance-${props.shardId}`, {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM
      ),
      machineImage: ec2.AmazonLinuxImage.latestVersions().amzn2,
      key: ec2.KeyPair.fromKeyPairName(this, `key-pair-${props.shardId}`, 'vockey'),
      securityGroup: props.securityGroup,
      role: role,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(10, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true,
            encrypted: true,
          }),
        },
      ],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    this.instance.addUserData(userDataScript);

    this.primaryIp = this.instance.instancePrivateIp;

    // Tags
    cdk.Tags.of(this.instance).add('Name', `postgres-shard-${props.shardId}`);
    cdk.Tags.of(this.instance).add('Shard', props.shardId.toString());
  }

  private generateUserData(
    shardId: number,
    primaryShardId: number,
    isPrimaryFor: number[],
    isStandbyFor: number[]
  ): string {
    const isPrimary = isPrimaryFor.includes(shardId);
    const roles = `Primary for shard(s): ${isPrimaryFor.join(', ')}, Standby for shard(s): ${isStandbyFor.join(', ')}`;

    const script = `#!/bin/bash
set -e

# Logging
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "Starting PostgreSQL setup for shard ${shardId}"
echo "${roles}"

# Update system
yum update -y
yum install -y postgresql14-server postgresql14-contrib

# Initialize PostgreSQL
/usr/pgsql-14/bin/postgresql-14-setup initdb

# Create main data directory
mkdir -p /data/postgres/shard${shardId}
chown postgres:postgres /data/postgres/shard${shardId}
chmod 700 /data/postgres/shard${shardId}

# Update PostgreSQL configuration for replication and sharding
cat >> /var/lib/pgsql/14/data/postgresql.conf << 'EOF'
# Replication settings
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
wal_keep_size = 1GB

# Performance tuning for t3.medium
shared_buffers = 256MB
effective_cache_size = 768MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4194kB
min_wal_size = 1GB
max_wal_size = 4GB

# Sharding configuration
server_encoding = 'UTF8'
EOF

# Configure pg_hba.conf for replication
cat >> /var/lib/pgsql/14/data/pg_hba.conf << 'EOF'
# Replication connections
host    replication     all             0.0.0.0/0               md5
host    replication     all             ::/0                    md5
EOF

# Start PostgreSQL
systemctl enable postgresql-14
systemctl start postgresql-14

# Create replication user
sudo -u postgres psql << 'EOSQL'
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator_secret_${shardId}';
EOSQL

# Create sharding database
sudo -u postgres createdb shard${shardId}

echo "PostgreSQL setup completed for shard ${shardId}"
`;

    return script;
  }
}
