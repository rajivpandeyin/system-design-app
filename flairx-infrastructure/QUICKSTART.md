# FlairX Infrastructure - Quick Start Guide

## 🚀 TL;DR - Deploy in 5 Steps

### 1. Prerequisites
```bash
# Verify AWS CLI is configured
aws sts get-caller-identity

# Download and extract project
cd flairx-infrastructure

# Get your ACM certificate ARN
aws acm list-certificates --region us-east-1 \
  --query 'CertificateSummaryList[?DomainName==`api.flairx.ai`].CertificateArn'

# Copy the ARN, update it in cdk.json: certArn field
```

### 2. Configure
```bash
# Edit cdk.json with your values:
# - certArn: <your-acm-certificate-arn>
# - owner: your-team-name
# - costCenter: your-cost-center-code

# Verify configuration
cat cdk.json | grep -E "certArn|owner|costCenter"
```

### 3. Install & Build
```bash
npm install
npm run build

# Bootstrap CDK (one-time)
npx cdk bootstrap
```

### 4. Deploy
```bash
# Preview changes
cdk diff

# Deploy infrastructure
cdk deploy --all

# Takes ~15-20 minutes
# Watch progress in CloudFormation console
```

### 5. Post-Deployment
```bash
# Get outputs
aws cloudformation describe-stacks \
  --stack-name FlairXStack \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
  --output table

# Create Route53 CNAME: api.flairx.ai → <AlbDnsName>
# Subscribe email to SNS topic for alarms
# Deploy your application to EC2 instances
```

---

## 📊 What Gets Deployed

| Component | Details | Cost |
|-----------|---------|------|
| **VPC** | 10.0.0.0/16 with public/private/isolated subnets | Free |
| **EC2** | 1-4 t4g.medium instances, auto-scaling | ~$25/mo base |
| **ALB** | Application Load Balancer, HTTPS termination | ~$16/mo |
| **RDS** | PostgreSQL 16.1 db.t4g.medium, 100 GB gp3 | ~$50/mo |
| **NAT** | 1 NAT Gateway (shared across 2 AZs) | ~$32/mo |
| **Monitoring** | CloudWatch alarms, dashboard, SNS notifications | ~$5/mo |
| **Storage** | S3 for ALB logs, Flow Logs, CloudTrail | ~$1/mo |
| **Total** | All components running 24/7 | **~$130/mo** |

---

## 🔍 Verify Deployment

```bash
# Check ALB target health (instances should be healthy)
aws elbv2 describe-target-health \
  --target-group-arn <tg-arn> \
  --query 'TargetHealthDescriptions[].{InstanceId:Target.Id,Health:TargetHealth.State}'

# Check RDS availability
aws rds describe-db-instances \
  --db-instance-identifier flairx \
  --query 'DBInstances[0].DBInstanceStatus'

# Open CloudWatch dashboard
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=flairx-infrastructure"
```

---

## 🆘 Troubleshooting

### Issue: Deployment fails with certificate not found
```bash
# Verify certificate exists and is in same region
aws acm list-certificates --region us-east-1

# Update cdk.json with correct ARN
```

### Issue: EC2 instances not healthy
```bash
# SSH to instance
aws ssm start-session --target <instance-id>

# Check if application is running
curl http://localhost:3004/health

# View logs
pm2 logs
```

### Issue: RDS connection fails
```bash
# Get DB password from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id flairx/rds/postgres \
  --query 'SecretString' | jq .password

# Test from EC2 instance
psql -h <rds-endpoint> -U flairxadmin -d flairx
```

---

## 📚 Full Documentation

- **[README.md](./README.md)** - Comprehensive architecture & operations guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Step-by-step with audit checklists
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical design & construct details

---

## 🎯 Scale-Up Checklist

As traffic grows, enable these features:

- [ ] **Week 2-3**: Apply 1-year Compute Savings Plan (~10% savings)
- [ ] **Week 3+**: Enable Multi-AZ RDS (one CDK change: `multiAz: true`)
- [ ] **When needed**: Add second NAT Gateway (high-availability)
- [ ] **If compliance requires**: Uncomment WAF & GuardDuty constructs

---

## 💰 Cost Optimization

| Strategy | Savings | Timeline |
|----------|---------|----------|
| Compute Savings Plan | -10% | Week 2-3 |
| Multi-AZ pause (single-AZ) | -$50/mo | Already done |
| NAT Gateway sharing | -$32/mo | Already done |
| VPC endpoints (S3) | -$0.045/GB NAT | Already done |
| gp3 storage | -10% vs gp2 | Already done |

---

## 📋 Architecture at a Glance

```
🌍 Internet
    ↓
🔐 Route53 (api.flairx.ai)
    ↓
⚖️ ALB (HTTPS + HTTP→HTTPS redirect)
    ↓
🖥️ EC2 Auto Scaling Group (1-4 instances)
    ├─ Node.js v20 + PM2
    ├─ CloudWatch Agent
    └─ SSM Session Manager
    ↓
🗄️ RDS PostgreSQL (encrypted, 7-day backups)
```

**Security**: No public IPs on EC2 or RDS. SSH access via Systems Manager only (no exposed ports).

---

## ⚡ Key Features

✅ **Cost Optimized**: ARM t4g.medium instances, gp3 storage, no Multi-AZ yet
✅ **Highly Available**: 2 AZs, ALB, auto-scaling (1-4 instances)
✅ **Secure**: IMDSv2, encrypted at rest/transit, least-privilege IAM, no SSH
✅ **Observable**: CloudWatch alarms, dashboards, structured JSON logging
✅ **Scalable**: Ready to add Multi-AZ RDS, second NAT, WAF in one CDK change

---

## 🔗 Useful Commands

```bash
# View all stack outputs
cdk deploy --all --require-approval never

# Update configuration without redeploy
# (Just edit cdk.json and re-run deploy)
cdk deploy

# Destroy everything (development only!)
cdk destroy --force

# View CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name FlairXStack --max-results 10

# Monitor costs weekly
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-08 \
  --granularity DAILY \
  --metrics BlendedCost
```

---

**Ready?** Follow the 5-step deployment above. For issues, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#troubleshooting-deployment-issues).
