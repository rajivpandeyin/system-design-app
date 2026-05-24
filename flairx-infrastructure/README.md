# FlairX Production-Grade Infrastructure - AWS CDK

A comprehensive, production-ready AWS infrastructure stack for the flairX application using AWS CDK with TypeScript. This stack implements cost-optimized, scalable, and highly available infrastructure following AWS Well-Architected Framework principles.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation & Deployment](#installation--deployment)
- [Stack Components](#stack-components)
- [Configuration](#configuration)
- [Cost Optimization](#cost-optimization)
- [Post-Deployment Steps](#post-deployment-steps)
- [Monitoring & Alerts](#monitoring--alerts)
- [Security](#security)
- [Scaling Checklist](#scaling-checklist)
- [Troubleshooting](#troubleshooting)

## 📐 Overview

This infrastructure stack deploys a complete, production-grade AWS infrastructure optimized for cost and performance:

### Key Features

- **High Availability**: Multi-AZ deployment with load balancing
- **Cost Optimized**: ARM Graviton instances (t4g.medium), gp3 storage, cost anomaly detection
- **Secure**: IMDSv2 enforcement, security groups with least privilege, encrypted storage
- **Observable**: CloudWatch dashboards, alarms with SNS, structured JSON logging
- **Scalable**: Auto Scaling Groups, target tracking policies, architected for Multi-AZ migration
- **Compliant**: CloudTrail logging, VPC Flow Logs, infrastructure-as-code approach

### Technology Stack

- **Compute**: EC2 with Auto Scaling Groups (t4g.medium ARM Graviton)
- **Load Balancing**: Application Load Balancer (ALB) with HTTPS termination
- **Database**: RDS PostgreSQL Single-AZ (architected for Multi-AZ upgrade)
- **Networking**: VPC with public/private/isolated subnets, VPC endpoints, NAT Gateway
- **Secrets**: AWS Secrets Manager with automatic rotation
- **Monitoring**: CloudWatch Logs, CloudWatch Dashboards, SNS alarms, CloudTrail
- **Cost Management**: Cost Anomaly Detection, Savings Plans integration

## 🏗️ Architecture Diagram

```
Internet
    ↓
┌─────────────────────────────────────────────┐
│  Route53 (api.flairx.ai CNAME to ALB)       │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  ALB (Public Subnets, AZ-1 & AZ-2)          │
│  - HTTPS (443) + HTTP → HTTPS redirect      │
│  - ACM Certificate                          │
│  - Access Logs → S3 + Intelligently Tier    │
└──────────────┬──────────────────────────────┘
               ↓
       ┌───────────────────┐
       │  Target Group     │
       │  (Port 3004)      │
       └─────────┬─────────┘
               ↓
┌──────────────────────────────────────────┐
│     ASG (Private Subnets)                │
│  ┌──────────────┬─────────────────┐     │
│  │ EC2 Instance │ EC2 Instance    │ ...│
│  │ (1-4 total)  │ (Auto Scaling)  │     │
│  └──────────────┴─────────────────┘     │
│  t4g.medium, ARM64, Node.js v20 + PM2  │
│  - CloudWatch Logs                      │
│  - SSM Session Manager (no SSH)         │
│  - Secrets Manager access               │
└──────────────┬───────────────────────────┘
               │
       ┌───────┴──────────┐
       ↓                  ↓
┌────────────────┐  ┌──────────────┐
│  VPC Endpoint  │  │  NAT Gateway │
│  S3 (free)     │  │  (1, or 2)   │
│  DynamoDB      │  │  for egress  │
└────────────────┘  └──────────────┘
       ↓                  ↓
    Internet          Internet
     (S3)            (SSM, npm, CW)
    
    ┌────────────────────────────────────┐
    │  RDS PostgreSQL (Isolated Subnet)  │
    │  - Single-AZ (Multi-AZ ready)      │
    │  - db.t4g.medium (ARM Graviton)    │
    │  - gp3 storage (20 GB)             │
    │  - Encrypted at rest (KMS)         │
    │  - 7-day backup retention          │
    │  - Performance Insights enabled    │
    │  - Secrets Manager credentials     │
    └────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. **AWS Account**: Active AWS account with appropriate IAM permissions
2. **AWS CLI**: v2 installed and configured
3. **Node.js**: v18+ LTS
4. **CDK CLI**: `npm install -g aws-cdk@latest`
5. **TypeScript**: Compiled JavaScript or ts-node runtime

### Installation & Deployment

#### Step 1: Prepare Your Environment

```bash
cd flairx-infrastructure

# Bootstrap CDK in your AWS account (one-time)
cdk bootstrap aws://ACCOUNT_ID/us-east-1

# Install dependencies
npm install

# Build TypeScript
npm run build
```

#### Step 2: Update Configuration

Edit `cdk.json` with your environment-specific values:

```json
{
  "context": {
    "certArn": "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID",
    "awsRegion": "us-east-1",
    "owner": "your-team",
    "costCenter": "your-cost-center"
  }
}
```

**⚠️ Note**: The `certArn` must be an existing ACM certificate in the same region. [Create an ACM certificate](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html) first.

#### Step 3: Review & Deploy

```bash
# Preview infrastructure changes
cdk diff

# Deploy (with approval prompts)
cdk deploy --all --require-approval any-change
```

The deployment takes approximately **15-20 minutes**.

#### Step 4: Verify Deployment

```bash
# Check stack outputs
aws cloudformation describe-stacks --stack-name FlairXStack \
  --query 'Stacks[0].Outputs'

# Verify EC2 instances are healthy
aws ec2 describe-instances --filters Name=tag:aws:cloudformation:logical-id,Values=AppAsg \
  --query 'Reservations[].Instances[].{ID:InstanceId,State:State.Name,PrivateIP:PrivateIpAddress}'

# Verify RDS database is available
aws rds describe-db-instances --db-instance-identifier <db-id> \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Engine:Engine,Storage:AllocatedStorage}'
```

## 📦 Stack Components

### 1. NetworkConstruct

**Responsibility**: VPC, subnets, routing, VPC endpoints, VPC Flow Logs

**Features**:
- VPC with 3 subnet types across 2 AZs:
  - **Public Subnets**: ALB placement, internet-facing traffic
  - **Private (App) Subnets**: EC2 instances with NAT egress
  - **Isolated (Data) Subnets**: RDS, no internet access
- Single NAT Gateway (cost-optimized; one CDK change to add second)
- S3 Gateway VPC Endpoint (free) to bypass NAT for S3 traffic
- DynamoDB Gateway VPC Endpoint
- VPC Flow Logs → S3 (cost-efficient: $0.023/GB vs CloudWatch $0.50/GB)

**Outputs**:
- VpcId, VpcCidr, Flow Logs bucket name

### 2. SecurityConstruct

**Responsibility**: Security groups, IAM roles, instance profiles, least-privilege access

**Features**:
- **ALB SG**: HTTPS/HTTP inbound from 0.0.0.0/0 and ::/0, restricted egress to EC2 SG port 3004
- **EC2 SG**: Inbound from ALB SG (port 3004), egress to RDS (5432) and internet (SSM/npm)
- **RDS SG**: Inbound from EC2 SG (5432) only, no public inbound
- **EC2 Instance Role**: Least-privilege permissions:
  - Systems Manager Session Manager (SSH replacement)
  - CloudWatch Agent (application & system logs)
  - Secrets Manager read-only (DB credentials, API keys)
  - S3 read-only (flairx-* buckets only)
  - KMS decrypt for secret encryption

**Outputs**:
- Security group IDs for reference

### 3. AlbConstruct

**Responsibility**: Application Load Balancer, HTTPS termination, target groups, access logging

**Features**:
- ALB in public subnets across 2 AZs
- HTTPS listener (port 443) using ACM certificate
- HTTP listener (port 80) with 301 redirect to HTTPS
- Target group with health checks:
  - Path: `/health`
  - Interval: 30s, Timeout: 10s
  - Healthy threshold: 2, Unhealthy: 3
- Access logs → S3 with 30-day Intelligent-Tiering, 90-day expiration
- Deletion protection enabled

**Outputs**:
- ALB DNS name (for Route53 CNAME record: api.flairx.ai)
- Access logs bucket name

### 4. ComputeConstruct

**Responsibility**: EC2 Launch Template, Auto Scaling Groups, scaling policies

**Features**:
- **Launch Template** (not deprecated Launch Configuration):
  - **Instance**: t4g.medium (ARM Graviton3, ~19% cheaper than t3.medium)
  - **AMI**: Amazon Linux 2023 ARM64
  - **Root Volume**: 20 GB gp3 (not default 30 GB; Node.js app <8 GB)
  - **IMDSv2**: Enforced (no IMDSv1)
- **Auto Scaling Group**:
  - Min: 1, Desired: 1, Max: 4 instances
  - Deployed in private (app) subnets only
  - Registered with ALB target group (port 3004)
  - Health check grace period: 5 minutes
- **Scaling Policies**:
  - Target tracking on average CPU: scale out at 60%
  - Target tracking on ALB request count per target
  - Scale-in cooldown: 300 seconds (prevent flapping)
- **User Data**:
  - Node.js v20 LTS installation
  - PM2 installation for process management
  - CloudWatch Agent installation
  - App user creation

**Outputs**:
- ASG name, Launch Template ID

### 5. DatabaseConstruct

**Responsibility**: RDS PostgreSQL, KMS encryption, Secrets Manager, automated backups

**Features**:
- **RDS Instance**:
  - Engine: PostgreSQL 16.1
  - Class: db.t4g.medium (ARM Graviton, ~10% cheaper)
  - Storage: 100 GB gp3 (3000 IOPS baseline free)
  - Single-AZ (Multi-AZ ready: one CDK change `multiAz: true`)
  - Encrypted at rest with KMS CMK
  - Performance Insights enabled (7-day retention free)
  - CloudWatch Logs: PostgreSQL error logs
- **Backup Strategy**:
  - Automated backups: 7-day retention
  - Point-in-time recovery enabled
  - Backup window: 03:00-04:00 UTC
  - Copy tags to snapshots
- **Credentials**:
  - Stored in AWS Secrets Manager (name: `flairx/rds/postgres`)
  - Automatic rotation every 30 days
  - Referenced by applications via caching client
- **Access**:
  - No public access
  - Accessible only from EC2 security group (port 5432)
  - Isolated subnet (no internet route)

**Outputs**:
- DB endpoint, port, name, secret ARN

### 6. MonitoringConstruct

**Responsibility**: CloudWatch Logs, alarms, dashboards, SNS notifications

**Features**:
- **Log Groups** with retention policies:
  - `/flairx/application`: 14 days (app/info logs)
  - `/flairx/errors`: 30 days (error logs)
  - `/flairx/audit`: 90 days (CloudTrail/audit logs)
- **CloudWatch Alarms** with SNS notifications:
  - EC2 CPU > 60% (scale-awareness)
  - EC2 CPU > 80% (CRITICAL)
  - RDS CPU > 75%
  - ALB 5xx error rate > 1% over 5 min
  - ALB P99 response time > 2 seconds
  - ALB UnHealthyHostCount > 0
  - RDS FreeStorageSpace < 10 GB
  - ASG instance count at Max capacity
- **CloudWatch Dashboard** (`flairx-infrastructure`):
  - EC2 CPU utilization
  - ALB request count, 5xx rate
  - RDS CPU, connections
  - ASG current capacity
- **SNS Topic**:
  - Endpoint for alarm notifications
  - Manual subscription required (email/SMS)

**Outputs**:
- SNS Topic ARN, CloudWatch Dashboard URL

### 7. FlairXStack (Orchestrator)

**Responsibility**: Coordinate all constructs, CloudTrail logging, cost controls

**Features**:
- Orchestrates all constructs in proper order
- **CloudTrail** (one trail, management events only):
  - Audit logging to S3 with 30-day Intelligent-Tiering, 90-day expiration
  - CloudWatch Logs export (90-day retention)
  - File validation enabled
- **Resource Tagging**: All resources tagged with:
  - Project, Environment, Owner, CostCenter, ManagedBy=CDK
- **Stack Outputs**: Key information for post-deployment steps
- **cdk-nag Integration**: AWS Well-Architected Framework checks

## ⚙️ Configuration

### CDK Context Parameters (`cdk.json`)

All configuration is externalized to `cdk.json` for easy management:

```json
{
  "context": {
    "environment": "production",
    "project": "flairx",
    "awsRegion": "us-east-1",
    "vpcCidr": "10.0.0.0/16",
    "azCount": 2,
    "natGatewayCount": 1,
    "ec2InstanceType": "t4g.medium",
    "ec2MinCapacity": 1,
    "ec2DesiredCapacity": 1,
    "ec2MaxCapacity": 4,
    "rdsInstanceClass": "db.t4g.medium",
    "certArn": "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID",
    "owner": "platform-team",
    "costCenter": "engineering",
    "logRetentionDays": {
      "app": 14,
      "error": 30,
      "audit": 90
    },
    "alarmThresholds": {
      "cpuScale": 60,
      "cpuCritical": 80,
      "rdssCpu": 75,
      "alb5xxRate": 1,
      "albP99ResponseTime": 2000,
      "rdsFreeStorage": 10
    }
  }
}
```

### Common Configuration Changes

#### Change Instance Type

```bash
# Edit cdk.json
{
  "context": {
    "ec2InstanceType": "t4g.large"  # or t3.medium, t4g.small, etc.
  }
}

cdk deploy
```

#### Add Second NAT Gateway (for HA)

```bash
{
  "context": {
    "natGatewayCount": 2  # One per AZ for redundancy
  }
}

cdk deploy
```

#### Enable Multi-AZ RDS

```bash
# In src/constructs/database-construct.ts, line ~39:
multiAz: true,  // Change from false

npm run build
cdk deploy
```

#### Increase ASG Max Capacity

```bash
{
  "context": {
    "ec2MaxCapacity": 8
  }
}

cdk deploy
```

## 💰 Cost Optimization

### Infrastructure Costs (Example, us-east-1, 730 hours/month)

| Component | Size | Cost/Month | Optimization |
|-----------|------|-----------|--------------|
| EC2 (t4g.medium, ASG 1 instance) | 1 @ $0.0336/hr | ~$25 | ARM Graviton (19% cheaper), Spot for dev |
| ALB | Shared | ~$16 | Hourly + data processing |
| NAT Gateway | 1 | ~$32 | Shared across 2 AZs; S3 endpoint bypass |
| RDS (db.t4g.medium, gp3) | 100 GB | ~$50 | ARM Graviton, gp3 (free 3000 IOPS), Single-AZ |
| CloudWatch Logs | ~10 GB/month | ~$5 | 14-30 day retention, filter noisy logs |
| VPC Flow Logs (S3) | ~5 GB/month | ~$0.12 | S3 vs CloudWatch (50x cheaper) |
| **Total Estimated** | | **~$128/month** | With 1 running instance |

### Cost Trade-offs & Rationale

1. **t4g.medium (ARM Graviton) over t3.medium**
   - 19% cheaper ($0.0336 vs $0.0416/hr)
   - Node.js v20 LTS runs natively on ARM64 (no code changes)
   - Better price-to-performance ratio

2. **gp3 over gp2 storage**
   - RDS: gp3 provides free 3000 IOPS baseline (vs gp2 @ 100 IOPS)
   - Lower storage cost ($0.10/GB vs $0.115/GB for RDS)
   - Can customize IOPS separately

3. **Single NAT Gateway (cost-optimized)**
   - Shared across both private subnets ($32/month)
   - HA trade-off: No automatic failover to second AZ
   - **Scale plan**: Add second NAT Gateway when SLA requires HA (one CDK change)

4. **S3 Gateway VPC Endpoint (free)**
   - Bypasses NAT for S3 traffic (no $0.045/GB data transfer cost)
   - EC2 ↔ S3 traffic stays within AWS network (free)

5. **VPC Flow Logs to S3 (not CloudWatch)**
   - S3: $0.023/GB ($5/200 GB/month)
   - CloudWatch: $0.50/GB ($100/200 GB/month)
   - **50x cost difference**

6. **Single-AZ RDS (cost-optimized)**
   - HA trade-off: No automatic failover
   - **Scale plan**: Enable `multiAz: true` in one CDK change
   - Saves ~$50/month via elimination of second instance

7. **14-day app log retention**
   - Adequate for troubleshooting
   - Reduces CloudWatch Logs storage cost
   - Error logs retained 30 days for incident analysis

### Cost Control Mechanisms

1. **Cost Anomaly Detection**
   - Enabled with $50 deviation alert
   - Detects unusual spending spikes
   - SNS notification for investigation

2. **Savings Plans**
   - **Recommendation**: Apply 1-year Compute Savings Plan after 2-3 weeks of stable baseline
   - Estimated **~10% additional discount** on EC2 costs
   - No upfront payment required

3. **Reserved Capacity (Future)**
   - Consider 3-year RDS Reserved Instances if traffic stabilizes
   - Estimated **~40% discount** on RDS compute

4. **Scheduled Scaling (Future)**
   - Once traffic patterns are known, add scheduled scaling
   - Example: Scale up at 8 AM, scale down at 8 PM
   - Further optimize EC2 costs for predictable workloads

5. **Spot Instances (Development)**
   - Replace on-demand with Spot for dev/test environments
   - Estimated **70% savings** on EC2 compute

### Audit Unattached Resources

```bash
# Check for unattached Elastic IPs (NAT Gateway creates one)
aws ec2 describe-addresses --query 'Addresses[?AssociationId==null]'

# Tag unattached EIPs for cost tracking
aws ec2 create-tags --resources <eip-allocation-id> \
  --tags Key=Name,Value="unattached-nat-eip" Key=Alert,Value=true
```

## 📋 Post-Deployment Steps

### 1. Verify Infrastructure Health

```bash
# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn <tg-arn> \
  --query 'TargetHealthDescriptions[].{Target:Target.Id,Health:TargetHealth.State}'

# Monitor EC2 instance status
aws ec2 describe-instance-status \
  --filters Name=instance-state-name,Values=running \
  --query 'InstanceStatuses[].{ID:InstanceId,System:SystemStatus.Status,Instance:InstanceStatus.Status}'

# Check RDS database status
aws rds describe-db-instances --db-instance-identifier <db-id> \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Engine:Engine,Class:DBInstanceClass}'
```

### 2. Setup Secrets Management

```bash
# The DB secret is created automatically, but add application secrets:

# API Keys
aws secretsmanager create-secret \
  --name flairx/api/keys \
  --secret-string '{"stripe":"sk_live_...","openai":"sk-..."}'

# Cache secrets in application using @aws/secrets-manager-caching-client
npm install @aws/secrets-manager-caching-client
```

**Application code example** (Node.js):

```javascript
const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
const { CachedSecretClient } = require('@aws/secrets-manager-caching-client');

const client = new SecretsManagerClient({ region: 'us-east-1' });
const cachedClient = new CachedSecretClient({ client });

// Cache secrets in-memory (default refresh every 5 minutes)
async function getDbCredentials() {
  const secret = await cachedClient.getSecretString('flairx/rds/postgres');
  return JSON.parse(secret);
}
```

### 3. Setup SSH Access (via Systems Manager Session Manager)

```bash
# NO DIRECT SSH ACCESS — Use Systems Manager Session Manager

# Start interactive shell on EC2 instance
aws ssm start-session --target <instance-id>

# One-time setup: Install Session Manager plugin
# macOS: brew install --cask session-manager-plugin
# Linux: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
```

### 4. Deploy CloudWatch Agent Configuration

```bash
# Create CloudWatch Agent config in Parameter Store
aws ssm put-parameter \
  --name /cloudwatch-config/flairx-app \
  --value '{"agent":{"metrics_collection_interval":60,"run_as_user":"root"},"logs":{"logs_collected":{"files":{"collect_list":[{"file_path":"/var/log/app/*.log","log_group_name":"/flairx/application","log_stream_name":"{instance_id}","retention_in_days":14}]}}}}' \
  --type String

# Fetch config from Parameter Store on EC2 instance
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c ssm:/cloudwatch-config/flairx-app
```

### 5. Configure Application Logging (Structured JSON via pino)

**In your Node.js application** (`src/logger.ts`):

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'flairx-api',
  },
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
});

// Usage in request handler
logger.info({
  requestId: req.id,
  traceId: req.headers['x-trace-id'],
  method: req.method,
  path: req.path,
  statusCode: res.statusCode,
});
```

**⚠️ Critical**: Set `LOG_LEVEL=info` in production (never debug):
- Debug logs are 3-5× more verbose
- CloudWatch Logs ingestion cost: $0.50/GB
- Info logs only: ~$5/month; Debug logs: ~$20+/month

### 6. Setup Route53 CNAME Record

Once ALB is healthy, create a CNAME record:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.flairx.ai",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "<alb-dns-name>"}]
      }
    }]
  }'
```

**In cdk.json output**, find `AlbDnsName` (e.g., `flairx-alb-1234567.us-east-1.elb.amazonaws.com`).

### 7. Subscribe to Alarm Notifications

```bash
# Get SNS topic ARN from stack outputs
SNS_ARN=$(aws cloudformation describe-stacks \
  --stack-name FlairXStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AlarmTopicArn`].OutputValue' \
  --output text)

# Subscribe email notifications
aws sns subscribe \
  --topic-arn $SNS_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription in email link (check spam folder!)
```

### 8. Verify VPC Flow Logs

```bash
# Confirm Flow Logs destination is S3 (not CloudWatch)
aws ec2 describe-flow-logs \
  --query 'FlowLogs[0].{DestinationType:DestinationType,Destination:ResourceId,Status:FlowLogStatus}'

# List flow logs in S3
aws s3 ls s3://flairx-vpc-flow-logs-bucket/vpc-flow-logs/ --recursive
```

### 9. Verify RDS Backups

```bash
# List automated backups
aws rds describe-db-snapshots \
  --db-instance-identifier <db-id> \
  --snapshot-type automated \
  --query 'DBSnapshots[].{SnapshotId:DBSnapshotIdentifier,CreateTime:SnapshotCreateTime,Status:Status}'

# Test restore capability (one-time)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier flairx-restore-test \
  --db-snapshot-identifier <snapshot-id>
```

## 📊 Monitoring & Alerts

### CloudWatch Dashboard

Access the `flairx-infrastructure` dashboard in CloudWatch Console:

- **EC2 CPU Utilization**: Scale-in/out indicator
- **ALB Request Count**: Traffic volume
- **ALB 5xx Error Rate**: Application health
- **RDS CPU & Connections**: Database load
- **ASG Capacity**: Current instance count vs. desired

### Alarm Thresholds & Actions

| Alarm | Threshold | Action | Adjust If |
|-------|-----------|--------|-----------|
| EC2 CPU > 60% | 60% avg | Scale awareness (no action) | False alarms → ↑ to 70% |
| EC2 CPU > 80% | 80% avg | SNS alert (CRITICAL) | Frequent → Investigate app |
| RDS CPU > 75% | 75% avg | SNS alert | Sustained → Optimize queries |
| ALB 5xx > 1% | 1% rate | SNS alert | Too many → Tune threshold |
| ALB P99 > 2s | 2 seconds | SNS alert | Frequent → Scale up |
| RDS Storage < 10 GB | 10 GB free | SNS alert | Add storage immediately |

### Custom Metrics

To add application custom metrics:

```typescript
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cw = new CloudWatch({ region: 'us-east-1' });

await cw.putMetricData({
  Namespace: 'flairx/application',
  MetricData: [
    {
      MetricName: 'RequestLatency',
      Value: duration,
      Unit: 'Milliseconds',
      Timestamp: new Date(),
      Dimensions: [
        { Name: 'Endpoint', Value: '/api/users' },
        { Name: 'Method', Value: 'GET' },
      ],
    },
  ],
});
```

## 🔒 Security

### Network Security

- ✅ Public ALB accepts HTTPS/HTTP only (no SSH, telnet, etc.)
- ✅ EC2 instances in private subnet (no public IP)
- ✅ RDS in isolated subnet (no internet route)
- ✅ All egress restricted to necessary ports (443, 5432)
- ✅ VPC endpoints for S3 (bypass internet for cost)

### Instance Security

- ✅ **IMDSv2 enforced**: No IMDSv1 attacks possible
- ✅ **No SSH access**: Only via SSM Session Manager
- ✅ **Least-privilege IAM**: Specific resource ARNs (not wildcards)
- ✅ **Secrets in Secrets Manager**: Never plaintext env vars
- ✅ **CloudTrail logging**: Audit all API calls

### Data Security

- ✅ **RDS encryption at rest**: KMS CMK (not S3-managed)
- ✅ **RDS encryption in transit**: HTTPS only
- ✅ **Secrets encryption**: KMS-protected (rotated every 30 days)
- ✅ **S3 encryption**: S3-managed for access logs
- ✅ **No public RDS access**: Private isolated subnet only

### Compliance & Logging

- ✅ **VPC Flow Logs**: All network traffic captured
- ✅ **CloudTrail**: Management event audit logging
- ✅ **CloudWatch Logs**: Application & system logs (14-30-90 day retention)
- ✅ **Access Logs**: ALB logs to S3 with 90-day retention
- ✅ **RDS Logs**: PostgreSQL error logs to CloudWatch

### Future: WAF & GuardDuty

- ⏳ **WAF** (Web Application Firewall): Currently commented in `src/constructs/waf-construct.ts`
  - Uncomment when app goes fully public or compliance requires
  - Protects against SQLi, XSS, DDoS, rate limiting
- ⏳ **GuardDuty** (Threat Detection): Add post-launch as separate stack
  - Analyzes CloudTrail, VPC Flow Logs, DNS logs
  - Detects anomalous access patterns

## 📈 Scaling Checklist

As traffic and requirements grow, follow this checklist to scale the infrastructure:

### Phase 1: Baseline (Week 1-2)
- [ ] Deploy infrastructure
- [ ] Application deployed and tested
- [ ] Alarms and SNS subscriptions active
- [ ] Monitor actual costs & traffic

### Phase 2: Cost Optimization (Week 2-3)
- [ ] Apply 1-year Compute Savings Plan (~10% discount)
- [ ] Confirm baseline traffic patterns
- [ ] Review CloudWatch metrics for anomalies

### Phase 3: High Availability (Week 3-4+)
- [ ] Enable **Multi-AZ RDS**: Set `multiAz: true` in `database-construct.ts`
  ```bash
  # Edit src/constructs/database-construct.ts, line ~39
  multiAz: true  // Enable automatic failover
  npm run build && cdk deploy
  ```
  - Cost: +~$50/month (second database instance)
  - Benefit: Automatic failover, 99.95% SLA

- [ ] Add **second NAT Gateway**: Update `cdk.json`
  ```json
  {"context": {"natGatewayCount": 2}}
  ```
  - Cost: +~$32/month (second EIP + NAT GW)
  - Benefit: Multi-AZ NAT redundancy, zonal fault tolerance

### Phase 4: DDoS & WAF Protection (Week 4+)
- [ ] Enable **AWS Shield Standard** (always on, no cost)
- [ ] Uncomment and enable **WAF** in `src/constructs/waf-construct.ts`
  - Rate limiting (e.g., 2000 req/5 min per IP)
  - String matching rules (SQLi, XSS patterns)
  - Geo-blocking if applicable
  - Cost: ~$2/month (WAF rules) + ~$0.60/million requests

- [ ] Enable **GuardDuty** for threat detection
  - Analyzes CloudTrail + VPC Flow Logs + DNS logs
  - Detects compromised instances, unauthorized API calls
  - Cost: ~$3-5/month

### Phase 5: Advanced Monitoring (Week 4+)
- [ ] Add **scheduled scaling** for known traffic patterns
  - Example: Scale to 4 instances at 8 AM, back to 1 at 8 PM
- [ ] Revisit **alarm thresholds** based on actual patterns
  - Prevent alert fatigue (too many false positives)
- [ ] Add **application custom metrics** to dashboards

### Phase 6: Cost Recovery (Week 3+)
- [ ] Apply **3-year RDS Reserved Instance** (~40% discount)
  - Requires 3-month stable baseline
  - Requires upfront commitment
  - Estimated savings: ~$20/month on db.t4g.medium

- [ ] Evaluate **Spot instances** for dev/test environments
  - 70% savings vs. on-demand
  - Not suitable for prod (manual restart required if spot interrupted)

### Phase 7: Interface Endpoints (If needed)
- [ ] If NAT Gateway data costs exceed $20/month, add VPC Interface Endpoints:
  ```bash
  # Current cost: SSM/CloudWatch agent → NAT Gateway → Internet
  # ~$0.045/GB data transfer + NAT processing
  
  # Interface Endpoint costs: $7/endpoint/mo + $0.01/GB data processing
  # Break-even: ~150 GB/mo per endpoint
  
  # Endpoints to add:
  # - ssm (for Session Manager)
  # - ssmmessages (WebSocket for Session Manager)
  # - ec2messages (EC2 message service)
  # - monitoring (CloudWatch agent)
  # - logs (CloudWatch Logs agent)
  ```

  Steps:
  1. Create VPC Interface Endpoints for each service
  2. Allow EC2 → endpoint on HTTPS (443)
  3. Monitor before/after NAT data costs

## 🔧 Troubleshooting

### ALB Targets Unhealthy

```bash
# 1. Check target health
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# 2. SSH to EC2 instance to debug
aws ssm start-session --target <instance-id>

# 3. Check if application is running
pm2 list

# 4. View application logs
journalctl -u app.service -n 100

# 5. Test health check endpoint
curl http://localhost:3004/health

# 6. Check network connectivity to ALB
curl -I http://<alb-private-ip>:3004/health

# 7. Check security group rules
aws ec2 describe-security-groups --group-ids <ec2-sg-id>
```

### RDS Connection Fails

```bash
# 1. Verify RDS is available
aws rds describe-db-instances --db-instance-identifier <db-id> \
  --query 'DBInstances[0].DBInstanceStatus'

# 2. Check security group allows EC2 → RDS
aws ec2 describe-security-groups --group-ids <rds-sg-id>

# 3. Test connectivity from EC2
aws ssm start-session --target <instance-id>
psql -h <rds-endpoint> -U flairxadmin -d flairx

# 4. Retrieve DB password from Secrets Manager
aws secretsmanager get-secret-value --secret-id flairx/rds/postgres \
  --query 'SecretString' --output text | jq .password

# 5. Check RDS credentials rotation
aws secretsmanager describe-secret --secret-id flairx/rds/postgres \
  --query 'RotationRules'
```

### High CloudWatch Logs Costs

```bash
# 1. Check log ingestion rate
aws logs describe-log-groups --query 'logGroups[].logGroupName'

# 2. Calculate monthly costs
# Cost Formula: GB ingested × $0.50/GB
# Example: 100 GB/month = $50/month

# 3. Reduce verbose logging
# - Set LOG_LEVEL=info (never debug in prod)
# - Filter noisy logs (ALB health checks, SSM heartbeats)
# - Reduce retention period (14 days for app logs)

# 4. Add CloudWatch Logs filter
aws logs put-metric-filter \
  --log-group-name /flairx/application \
  --filter-name IgnoreHealthChecks \
  --filter-pattern '[... , ua != "*ELB-HealthChecker*", ...]' \
  --metric-transformations metricName=FilteredLogCount,metricValue=1
```

### High NAT Gateway Costs

```bash
# If data processing > $20/month:

# 1. Identify traffic sources
aws ec2 describe-nat-gateway-attributes --nat-gateway-id <nat-gw-id>

# 2. Check VPC Flow Logs to S3 for source IPs
aws s3 ls s3://flairx-vpc-flow-logs-bucket/vpc-flow-logs/

# 3. If CloudWatch agent traffic is high, add VPC Interface Endpoints
# Cost trade-off: $7/endpoint/mo + $0.01/GB processing vs. $0.045/GB NAT

# 4. Verify S3 endpoint is being used
aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values=<vpc-id> \
  --query 'VpcEndpoints[?ServiceName==`com.amazonaws.us-east-1.s3`]'
```

### CDK Deployment Issues

```bash
# Synthesis fails: cdk synth error
# → Check cdk.json context parameters, especially certArn

# Deployment timeout
→ Monitor CloudFormation events
aws cloudformation describe-stack-events --stack-name FlairXStack \
  --query 'StackEvents[0:10].{Time:Timestamp,Status:ResourceStatus,Reason:ResourceStatusReason}'

# Rollback errors
# → Check IAM permissions, security group circular dependencies

# Unable to delete stack
# → Check deletion protection (ALB), snapshot backups (RDS)
aws cloudformation delete-stack --stack-name FlairXStack --no-retain-data-on-delete
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/)
- [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/userguide/)
- [RDS PostgreSQL Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.PostgreSQL.html)
- [EC2 Auto Scaling User Guide](https://docs.aws.amazon.com/autoscaling/ec2/userguide/)
- [CloudWatch Logs Pricing](https://aws.amazon.com/cloudwatch/pricing/)
- [NAT Gateway vs. VPC Endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html)

## 📝 License

[Your License Here]

## 👥 Support

For issues, questions, or contributions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [CloudWatch Dashboards](#monitoring--alerts) for metrics
3. Contact your platform engineering team

---

**Last Updated**: April 28, 2026  
**Version**: 1.0.0  
**Status**: Production-Ready
