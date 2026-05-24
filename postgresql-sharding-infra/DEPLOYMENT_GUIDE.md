# Deployment Guide - PostgreSQL Sharding Infrastructure

Complete step-by-step guide for deploying the PostgreSQL sharding infrastructure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [AWS Configuration](#aws-configuration)
4. [Deployment](#deployment)
5. [Validation](#validation)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- AWS Account with appropriate permissions
- Node.js 18+ installed
- AWS CLI v2 configured
- Docker (optional, for local testing)
- SSH key pair created in AWS (or locally)

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "s3:*",
        "secretsmanager:*",
        "cloudwatch:*",
        "iam:*",
        "logs:*",
        "kms:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Local Setup

### 1. Clone and Install

```bash
cd postgresql-sharding-infra
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Verify Syntax

```bash
npm run synth
```

## AWS Configuration

### 1. Configure AWS CLI

```bash
aws configure
# Enter:
# AWS Access Key ID: [your-access-key]
# AWS Secret Access Key: [your-secret-key]
# Default region: us-east-1
# Default output format: json
```

### 2. Create/Import EC2 Key Pair

```bash
# Create new key pair
aws ec2 create-key-pair --key-name vockey --region us-east-1 --query 'KeyMaterial' --output text > vockey.pem
chmod 400 vockey.pem

# Or import existing public key
aws ec2 import-key-pair --key-name vockey --public-key-material fileb://~/.ssh/id_rsa.pub --region us-east-1
```

### 3. Bootstrap CDK (first time only)

```bash
cdk bootstrap aws://ACCOUNT_ID/us-east-1

# Or using AWS CLI to get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
cdk bootstrap aws://$ACCOUNT_ID/us-east-1
```

## Deployment

### Step 1: Review Configuration

```bash
# Check cdk.json
cat cdk.json
```

Expected output:

```json
{
  "context": {
    "environment": "production",
    "region": "us-east-1",
    "vpcCidr": "10.0.0.0/16",
    "shardCount": 2,
    "instanceType": "t3.medium",
    "storageSize": 10,
    "storageType": "gp3",
    "postgresVersion": "14.10"
  }
}
```

### Step 2: Synthesize Stack

```bash
npm run synth
# Output: cdk.out/PostgresShardingStack.template.json
```

### Step 3: Review Diff

```bash
npm run diff
```

Check for:
- ✅ VPC with 2 AZs
- ✅ 2 EC2 instances (t3.medium)
- ✅ Security groups
- ✅ S3 bucket
- ✅ Secrets Manager secrets
- ✅ CloudWatch resources

### Step 4: Deploy

```bash
npm run deploy

# Or with auto-approval (use cautiously)
npm run deploy -- --require-approval never
```

**Expected Duration:** 5-10 minutes

### Step 5: Capture Outputs

```bash
# After deployment completes, capture CDK outputs
aws cloudformation describe-stacks \
  --stack-name PostgresShardingStack \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
```

**Example Outputs:**

| Key | Value |
|-----|-------|
| Instance-0-PublicIP | 54.xxx.xxx.xxx |
| Instance-0-PrivateIP | 10.0.x.x |
| Instance-1-PublicIP | 34.xxx.xxx.xxx |
| Instance-1-PrivateIP | 10.0.x.x |
| BackupBucketName | postgres-backup-prod-xxxxx |
| VpcId | vpc-xxxxx |

## Validation

### 1. Verify EC2 Instances

```bash
aws ec2 describe-instances --region us-east-1 \
  --filters "Name=tag:Project,Values=PostgreSQL-Sharding" \
  --query 'Reservations[].Instances[].{
    InstanceId: InstanceId,
    State: State.Name,
    Type: InstanceType,
    PublicIP: PublicIpAddress,
    PrivateIP: PrivateIpAddress,
    Shard: Tags[?Key==`Shard`].Value|[0]
  }' \
  --output table
```

### 2. Verify Security Groups

```bash
aws ec2 describe-security-groups --region us-east-1 \
  --filters "Name=group-name,Values=*postgres*" \
  --query 'SecurityGroups[].{
    GroupId: GroupId,
    GroupName: GroupName,
    IngressRules: IpPermissions
  }' \
  --output json | head -50
```

### 3. Verify S3 Backup Bucket

```bash
aws s3 ls --region us-east-1 | grep postgres-backup
```

### 4. Verify Secrets

```bash
aws secretsmanager list-secrets --region us-east-1 \
  --filters Key=name,Values=postgres \
  --query 'SecretList[].Name' \
  --output table
```

### 5. SSH into Instances

```bash
# Get Instance 0 IP
INSTANCE_0_IP=$(aws ec2 describe-instances \
  --region us-east-1 \
  --filters "Name=tag:Shard,Values=0" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# SSH into instance
ssh -i vockey.pem ec2-user@$INSTANCE_0_IP

# Check PostgreSQL status
sudo systemctl status postgresql-14
```

### 6. Verify PostgreSQL Installation

```bash
# Inside EC2 instance
sudo -u postgres psql --version
sudo -u postgres psql -c "SELECT version();"
```

## Configuration

### Change Instance Type

Edit `cdk.json`:

```json
{
  "context": {
    "instanceType": "m6i.large"
  }
}
```

Then redeploy:

```bash
cdk deploy --require-approval never
```

### Add More Shards

Edit `cdk.json`:

```json
{
  "context": {
    "shardCount": 4
  }
}
```

Update `src/stack.ts` to handle additional instances in `primaryConfig`.

### Change Region

```bash
cdk deploy -c region=us-west-2
```

## Troubleshooting

### Issue: "The provided role was not found"

**Solution:**
```bash
# Ensure IAM role has EC2 permissions
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
cdk bootstrap aws://$ACCOUNT_ID/us-east-1
```

### Issue: "User is not authorized to perform: ec2:DescribeKeyPairs"

**Solution:**
```bash
# Ensure key pair exists
aws ec2 create-key-pair --key-name vockey --region us-east-1 --query 'KeyMaterial' --output text > vockey.pem
chmod 400 vockey.pem
```

### Issue: Instance stuck in "initializing"

**Solution:**
- Wait 5-10 minutes for user data to complete
- Check instance logs:
```bash
INSTANCE_ID=i-xxxxx
aws ec2 get-console-output --instance-id $INSTANCE_ID --region us-east-1 | tail -50
```

### Issue: Cannot SSH into instance

**Solution:**
```bash
# Check security group
aws ec2 describe-security-groups --region us-east-1 \
  --filters "Name=group-name,Values=*postgres*" \
  --query 'SecurityGroups[].IpPermissions' --output json

# Add SSH rule if needed
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --region us-east-1
```

## Post-Deployment

### 1. Configure PostgreSQL Replication

See [README.md](./README.md#post-deployment-steps)

### 2. Test Backup

```bash
# Trigger manual backup
aws s3 sync /var/lib/pgsql/14/data/ s3://postgres-backup-prod-xxxxx/backup/
```

### 3. Monitor Dashboard

```bash
# Open CloudWatch dashboard
aws cloudwatch describe-dashboards --region us-east-1 \
  --query 'DashboardEntries[?contains(DashboardName, `PostgreSQL`)]' \
  --output json
```

## Rollback

To undo deployment:

```bash
npm run destroy
# or
cdk destroy

# Confirm when prompted
```

This will **delete all resources** including:
- EC2 instances
- VPC
- S3 bucket (if configured for retain, manually delete)
- CloudWatch resources
- Secrets Manager secrets

## Next Steps

1. ✅ Deployment complete
2. ⏳ Configure replication between instances
3. ⏳ Setup application sharding logic
4. ⏳ Test failover scenarios
5. ⏳ Enable backups to secondary region

## Support

For issues or questions:
1. Check CloudFormation events: `aws cloudformation describe-stack-events --stack-name PostgresShardingStack`
2. Review instance logs: `/var/log/user-data.log`
3. Check PostgreSQL logs: `/var/log/postgresql/postgresql.log`
