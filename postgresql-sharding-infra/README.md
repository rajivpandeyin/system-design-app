# PostgreSQL Sharding Infrastructure

AWS CDK project for deploying a hash-based PostgreSQL sharding infrastructure on EC2 with cross-replication, automated backups, and monitoring.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│            AWS VPC (10.0.0.0/16)        │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │    Public Subnets                 │ │
│  │  (2x Availability Zones)          │ │
│  │                                   │ │
│  │  ┌─────────────────┐              │ │
│  │  │  EC2 Instance 0 │ (Shard 0 Primary) │
│  │  │  PostgreSQL 14  │              │ │
│  │  │  t3.medium      │ ◄────────┐  │ │
│  │  │  10GB GP3       │          │  │ │
│  │  └─────────────────┘          │  │ │
│  │           │                   │  │ │
│  │           ▼ (replication)     │  │ │
│  │  ┌─────────────────┐          │  │ │
│  │  │  EC2 Instance 1 │──────────┘  │ │
│  │  │  PostgreSQL 14  │ (Shard 1 Primary) │
│  │  │  t3.medium      │              │ │
│  │  │  10GB GP3       │              │ │
│  │  └─────────────────┘              │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Security Group: PostgreSQL SG         │
│  - Port 5432: Inter-shard + VPC       │
│  - Port 22: SSH                        │
└─────────────────────────────────────────┘
        │
        ▼
   ┌─────────────┐
   │  S3 Bucket  │  (Automated Backups)
   │   GP3/GCS   │
   └─────────────┘
        │
        ▼
   ┌─────────────────────┐
   │ Secrets Manager     │  (DB Credentials)
   │ - Replication Creds │
   │ - Per-Shard Creds   │
   └─────────────────────┘
        │
        ▼
   ┌─────────────────────┐
   │ CloudWatch          │  (Monitoring)
   │ - Dashboard         │
   │ - High CPU Alarms   │
   │ - Network Metrics   │
   └─────────────────────┘
```

## Features

### ✅ Hash-Based Sharding
- **2 shards** distributed across 2 EC2 instances
- Hash-based shard key distribution (extensible for additional shards)
- Application-level routing required

### ✅ Cross-Replication
- **Active-Passive Failover** per shard
  - Shard 0: Primary on Instance 0, Standby on Instance 1
  - Shard 1: Primary on Instance 1, Standby on Instance 0
- WAL-based streaming replication
- Automatic failover capability (manual or with external orchestration)

### ✅ Infrastructure as Code
- AWS CDK with TypeScript
- Modular constructs for easy extension
- Configurable via `cdk.json` context

### ✅ Backup & Recovery
- Automated S3 backups lifecycle:
  - 30 days: Standard
  - 30-90 days: Standard-IA
  - 90-365 days: Glacier
  - > 365 days: Deleted
- Cross-region capable

### ✅ Security
- Encrypted EBS volumes (AES-256)
- AWS Secrets Manager for credentials
- Restricted security groups
- VPC isolation

### ✅ Monitoring & Alerting
- CloudWatch dashboard with 4 metrics per instance:
  - CPU Utilization
  - Network In/Out
- CPU Alarms (threshold: 80%)
- Custom CloudWatch agent integration ready

## Configuration

Edit `cdk.json` to customize:

```json
{
  "context": {
    "environment": "production",
    "region": "us-east-1",
    "vpcCidr": "10.0.0.0/16",
    "shardCount": 2,
    "instanceType": "t3.medium",
    "storageSize": 10,           // GB
    "storageType": "gp3",
    "postgresVersion": "14.10"
  }
}
```

## Prerequisites

```bash
# Install dependencies
npm install

# Configure AWS credentials
aws configure

# Install CDK (if not already)
npm install -g aws-cdk
```

## Deployment

### 1. Synthesize the stack (preview)
```bash
npm run synth
# or
cdk synth
```

### 2. Diff to see changes
```bash
npm run diff
cdk diff
```

### 3. Deploy to AWS
```bash
npm run deploy
cdk deploy

# Deploy with specific parameters
cdk deploy -c environment=staging -c region=us-west-2
```

## Post-Deployment Steps

### 1. Access Instances
```bash
# Get instance IPs from CDK outputs
AWS_REGION=us-east-1
INSTANCE_0_IP=$(aws ec2 describe-instances --region $AWS_REGION \
  --filters "Name=tag:Shard,Values=0" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# SSH into instance
ssh -i /path/to/key.pem ec2-user@$INSTANCE_0_IP
```

### 2. PostgreSQL Setup
```bash
# On Instance 0 (Shard 0 Primary)
sudo -u postgres psql
CREATE TABLE hash_shard (id SERIAL PRIMARY KEY, shard_id INT);
INSERT INTO hash_shard VALUES (1, 0); -- Shard 0 data

# On Instance 1 (Shard 1 Primary)
CREATE TABLE hash_shard (id SERIAL PRIMARY KEY, shard_id INT);
INSERT INTO hash_shard VALUES (2, 1); -- Shard 1 data
```

### 3. Verify Replication
```bash
# On primary instances
sudo -u postgres psql -c "SELECT * FROM pg_stat_replication;"

# On standby instances
sudo -u postgres psql -c "SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();"
```

## Application Integration (Sharding Logic)

### Hash-Based Routing Example (Node.js)

```javascript
const crypto = require('crypto');

// Hash-based shard distribution
function getShard(userId, totalShards = 2) {
  const hash = crypto.createHash('md5').update(userId.toString()).digest('hex');
  const hashInt = parseInt(hash, 16);
  return hashInt % totalShards;
}

// Example: Route user 123 to appropriate shard
const shardId = getShard(123);
const shardInstances = {
  0: { host: 'instance-0-ip', port: 5432 },
  1: { host: 'instance-1-ip', port: 5432 },
};

const shardConfig = shardInstances[shardId];
// Connect to shardConfig.host:shardConfig.port
```

## Monitoring

### View Dashboard
```bash
aws cloudwatch list-dashboards --region us-east-1
# Open in AWS Console: CloudWatch → Dashboards → PostgreSQL-Sharding-production
```

### Check Alarms
```bash
aws cloudwatch describe-alarms --region us-east-1 \
  --alarm-name-prefix PostgreSQL-Shard
```

## Troubleshooting

### Replication Lag
```bash
# On primary
sudo -u postgres psql -c "SELECT client_addr, state, written_lsn FROM pg_stat_replication;"

# On standby
sudo -u postgres psql -c "SELECT now() - pg_last_xact_replay_timestamp();"
```

### High Latency
- Check instance CPU/disk utilization
- Verify network throughput between AZs
- Review PostgreSQL logs: `/var/log/postgresql/`

### Backup Verification
```bash
aws s3 ls s3://postgres-backup-production/ --human-readable --recursive
```

## Cleanup

```bash
# Destroy the stack
npm run destroy
cdk destroy

# Confirm destruction
```

## Cost Estimation

**Monthly Cost (approx, us-east-1):**
- 2x t3.medium: ~$30
- 20 GB EBS GP3: ~$2
- S3 storage (assuming 50GB): ~$1
- Backup transitions: ~$1
- **Total: ~$34/month**

## Next Steps

1. **Add more shards**: Modify `shardCount` in `cdk.json`
2. **Enable RDS replication**: Add RDS read replicas for backups
3. **Setup Lambda backups**: Automate S3 backup scripts
4. **Implement connection pooling**: Use PgBouncer on each instance
5. **Add monitoring agent**: CloudWatch agent for PostgreSQL metrics

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [PostgreSQL Replication](https://www.postgresql.org/docs/14/different-replication-solutions.html)
- [Hash Sharding Strategy](https://en.wikipedia.org/wiki/Consistent_hashing)

## License

MIT
