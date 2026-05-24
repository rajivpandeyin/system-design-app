# FlairX Infrastructure - Deployment & Audit Guide

## Pre-Deployment Checklist

### 1. AWS Account Setup

- [ ] AWS account active and in good standing
- [ ] IAM user/role with administrative permissions
- [ ] AWS CLI configured: `aws sts get-caller-identity`
- [ ] Default region set: `export AWS_REGION=us-east-1`
- [ ] Default account ID set: `export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)`

### 2. ACM Certificate Preparation

**REQUIRED**: Create or obtain an ACM certificate for `api.flairx.ai` before deployment.

```bash
# Option A: Create new ACM certificate (if domain already verified)
aws acm request-certificate \
  --domain-name api.flairx.ai \
  --subject-alternative-names "*.flairx.ai" \
  --validation-method DNS \
  --region us-east-1 \
  --tags Key=Project,Value=flairx

# Option B: Use existing certificate (recommended for production)
# Get the ARN of your existing certificate:
aws acm list-certificates --region us-east-1 \
  --query 'CertificateSummaryList[?DomainName==`api.flairx.ai`].CertificateArn'

# Copy the certificate ARN and update cdk.json: certArn field
```

**Validation Steps for DNS**:
1. In AWS Console: ACM → Pending Certificates
2. Add DNS CNAME record to Route53 (or your DNS provider)
3. Wait for validation (usually 5-10 minutes)
4. Certificate status changes from "Pending validation" to "Issued"

### 3. Route53 Hosted Zone

- [ ] Route53 hosted zone for `flairx.ai` exists
- [ ] Zone ID noted (for post-deployment CNAME record)
- [ ] NS records configured in domain registrar (if required)

### 4. Environment Variables

```bash
# Set environment variables for AWS CLI
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
export CERTIFICATE_ARN="arn:aws:acm:us-east-1:$AWS_ACCOUNT_ID:certificate/YOUR_CERT_ID"
export PROJECT_NAME=flairx
```

## Deployment Steps

### Step 1: Clone or Create Project

```bash
cd /var/www/html/project/flairx-infrastructure

# If cloning from Git:
git clone <repo-url> flairx-infrastructure
cd flairx-infrastructure
```

### Step 2: Install Dependencies

```bash
npm install

# Verify CDK CLI is available
npx cdk --version
```

### Step 3: Update Configuration

Edit `cdk.json` with your specific values:

```bash
# Use a template or sed to replace placeholders
sed -i "s|ACCOUNT_ID|${AWS_ACCOUNT_ID}|g" cdk.json
sed -i "s|CERT_ID|YOUR_CERT_ID|g" cdk.json
sed -i "s|your-team|your-actual-team|g" cdk.json
sed -i "s|your-cost-center|your-actual-cost-center|g" cdk.json

# Verify changes
cat cdk.json | grep -E "certArn|owner|costCenter"
```

### Step 4: Bootstrap CDK (One-time)

```bash
# Bootstrap CloudFormation stack for CDK in your account/region
# This creates S3 bucket, IAM roles, etc.
npx cdk bootstrap aws://${AWS_ACCOUNT_ID}/us-east-1

# Verify bootstrap completed
aws s3 ls | grep cdk-assets
```

### Step 5: Build TypeScript

```bash
npm run build

# Verify no errors
echo "Build exit code: $?"
```

### Step 6: Generate Cloudformation Template

```bash
# Synthesize CloudFormation template
npx cdk synth

# Review generated template (optional)
cat cdk.out/FlairXStack.template.json | head -100

# Run cdk-nag checks for AWS Well-Architected
npm run cdk:nag
```

### Step 7: Review Diff

```bash
# Preview all infrastructure changes before applying
npx cdk diff --max-width 300

# Review the output carefully, looking for:
# - [+] New resources (expected)
# - [~] Modified resources (review carefully)
# - [-] Deleted resources (unexpected unless intentional)
```

### Step 8: Deploy Infrastructure

```bash
# Deploy with approval for each resource
npx cdk deploy --all --require-approval any-change

# Or deploy without approval (for automated pipelines)
npx cdk deploy --all --require-approval never

# Monitor progress (takes 15-20 minutes)
# Watch CloudFormation in AWS Console: https://console.aws.amazon.com/cloudformation
```

**Deployment Progress Indicators**:
- 0-2 min: S3 buckets creation
- 2-5 min: VPC, subnets, security groups
- 5-10 min: RDS database (longest step)
- 10-15 min: ALB, ASG, EC2 instances
- 15-20 min: CloudWatch, alarms, final outputs

### Step 9: Verify Deployment Success

```bash
# Check stack outputs
aws cloudformation describe-stacks \
  --stack-name FlairXStack \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
  --output table

# Expected outputs:
# - VpcId
# - AlbDnsName  <-- IMPORTANT for Route53 CNAME
# - DbEndpoint
# - DbSecretArn
# - AlarmTopicArn
# - DashboardUrl
```

### Step 10: Save Key Information

Create a `.env.generated` file with important values:

```bash
# Create environment file with deployment outputs
aws cloudformation describe-stacks \
  --stack-name FlairXStack \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
  --output text > deployment-outputs.txt

# Manually create .env file or parse the outputs
cat > .env.generated << EOF
# FlairX Infrastructure Deployment Outputs
# Generated at $(date)

VPC_ID=$(grep VpcId deployment-outputs.txt | awk '{print $2}')
ALB_DNS_NAME=$(grep AlbDnsName deployment-outputs.txt | awk '{print $2}')
ALB_URL=$(grep AlbUrl deployment-outputs.txt | awk '{print $2}')
DB_ENDPOINT=$(grep DbEndpoint deployment-outputs.txt | awk '{print $2}')
DB_PORT=$(grep DbPort deployment-outputs.txt | awk '{print $2}')
DB_NAME=$(grep DbName deployment-outputs.txt | awk '{print $2}')
DB_SECRET_ARN=$(grep DbSecretArn deployment-outputs.txt | awk '{print $2}')
ALARM_TOPIC_ARN=$(grep AlarmTopicArn deployment-outputs.txt | awk '{print $2}')
DASHBOARD_URL=$(grep DashboardUrl deployment-outputs.txt | awk '{print $2}')
EOF

# Source the file for later use
source .env.generated
```

## Post-Deployment Audit

### 1. EC2 Instance Health Verification

```bash
# Check that ASG instances are healthy in ALB target group
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names flairx-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
  --load-balancer-arn $ALB_ARN \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# List target health
aws elbv2 describe-target-health \
  --target-group-arn $TARGET_GROUP_ARN \
  --query 'TargetHealthDescriptions[].{InstanceId:Target.Id,Health:TargetHealth.State,Reason:TargetHealth.Reason}' \
  --output table

# Expected: Status = healthy for at least 1 instance
# May take 5-10 minutes after deployment
```

### 2. RDS Database Availability

```bash
# Verify RDS instance status
aws rds describe-db-instances \
  --db-instance-identifier flairx \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Engine:Engine,Class:DBInstanceClass,Storage:AllocatedStorage}' \
  --output table

# Expected: Status = available

# Verify Secrets Manager credential storage
aws secretsmanager describe-secret \
  --secret-id flairx/rds/postgres \
  --query '{Name:Name,CreatedDate:CreatedDate,RotationEnabled:RotationEnabled,RotationRules:RotationRules}' \
  --output table
```

### 3. Network Configuration Audit

```bash
# Verify VPC Flow Logs destination is S3 (not CloudWatch)
VPC_ID=$(aws ec2 describe-vpcs \
  --filters Name=tag:Project,Values=flairx \
  --query 'Vpcs[0].VpcId' \
  --output text)

aws ec2 describe-flow-logs \
  --filter Name=resource-id,Values=$VPC_ID \
  --query 'FlowLogs[].{DestinationType:DestinationType,ResourceId:ResourceId,Status:FlowLogStatus}' \
  --output table

# Expected: DestinationType = S3Bucket, Status = ACTIVE

# Verify S3 bucket exists for flow logs
aws s3 ls | grep vpc-flow-logs
```

### 4. Security Group Verification

```bash
# Verify ALB security group (allows HTTPS/HTTP inbound)
ALB_SG=$(aws ec2 describe-security-groups \
  --filters Name=tag:aws:cloudformation:logical-id,Values=AlbSecurityGroup \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

aws ec2 describe-security-groups \
  --group-ids $ALB_SG \
  --query 'SecurityGroups[0].IpPermissions[].[FromPort,ToPort,IpProtocol,IpRanges[0].CidrIp]' \
  --output table

# Expected: 
# - 443 (HTTPS) from 0.0.0.0/0
# - 80 (HTTP) from 0.0.0.0/0

# Verify EC2 security group (allows inbound from ALB only)
EC2_SG=$(aws ec2 describe-security-groups \
  --filters Name=tag:aws:cloudformation:logical-id,Values=Ec2SecurityGroup \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

aws ec2 describe-security-groups \
  --group-ids $EC2_SG \
  --query 'SecurityGroups[0].IpPermissions[].[FromPort,ToPort,UserIdGroupPairs[0].GroupId]' \
  --output table

# Expected:
# - 3004 from ALB_SG (no public inbound)

# Verify RDS security group (allows inbound from EC2 only)
RDS_SG=$(aws ec2 describe-security-groups \
  --filters Name=tag:aws:cloudformation:logical-id,Values=RdsSecurityGroup \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

aws ec2 describe-security-groups \
  --group-ids $RDS_SG \
  --query 'SecurityGroups[0].IpPermissions[].[FromPort,ToPort,UserIdGroupPairs[0].GroupId]' \
  --output table

# Expected:
# - 5432 (PostgreSQL) from EC2_SG only
```

### 5. Elastic IP Audit

```bash
# List all Elastic IPs (created by NAT Gateway)
aws ec2 describe-addresses \
  --query 'Addresses[?AssociationId!=null].{PublicIp:PublicIp,AssociationId:AssociationId,InstanceId:InstanceId,AllocationId:AllocationId,Tags:Tags}' \
  --output table

# Check for unattached EIPs (potential waste)
aws ec2 describe-addresses \
  --query 'Addresses[?AssociationId==null].{PublicIp:PublicIp,AllocationId:AllocationId}' \
  --output table

# Delete unattached EIPs if not needed
aws ec2 release-address --allocation-id <eip-allocation-id>

# Expected: 1 EIP attached to NAT Gateway
```

### 6. IAM Role Verification

```bash
# Verify EC2 instance role has correct permissions
EC2_ROLE=$(aws iam get-role \
  --role-name FlairXStack-Ec2InstanceRole* \
  --query 'Role.RoleName' \
  --output text 2>/dev/null || echo "Not found")

if [ ! -z "$EC2_ROLE" ]; then
  # List attached managed policies
  aws iam list-attached-role-policies \
    --role-name $EC2_ROLE \
    --query 'AttachedPolicies[].[PolicyName,PolicyArn]' \
    --output table

  # List inline policies
  aws iam list-role-policies \
    --role-name $EC2_ROLE \
    --query 'PolicyNames' \
    --output table
fi

# Expected policies:
# - AmazonSSMManagedInstanceCore (for Session Manager)
# - CloudWatchAgentServerPolicy (for CloudWatch)
# - Custom policy for Secrets Manager, S3, KMS
```

### 7. KMS Key Audit

```bash
# Verify KMS keys are created for RDS and Secrets encryption
aws kms list-keys --query 'Keys[]' --output table

# Find flairx-related KMS keys
aws kms describe-key \
  --key-id $(aws kms list-keys --query 'Keys[0].KeyId' --output text) \
  --query 'KeyMetadata.{KeyId:KeyId,KeyState:KeyState,Description:Description}' \
  --output table

# Verify key rotation is enabled
aws kms get-key-rotation-status \
  --key-id <key-id>
```

### 8. CloudWatch Alarms Verification

```bash
# List all CloudWatch alarms for flairx
aws cloudwatch describe-alarms \
  --alarm-name-prefix flairx \
  --query 'MetricAlarms[].[AlarmName,StateValue,MetricName,Threshold]' \
  --output table

# Expected alarms (8 total):
# - flairx-ec2-cpu-scale (60%)
# - flairx-ec2-cpu-critical (80%)
# - flairx-rds-cpu (75%)
# - flairx-alb-unhealthy-hosts (0)
# - flairx-alb-5xx-rate
# - flairx-alb-response-time
# - flairx-rds-free-storage (10 GB)
# - flairx-asg-max-capacity
```

### 9. CloudWatch Dashboard Verification

```bash
# Open CloudWatch Dashboard
echo "Open: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=flairx-infrastructure"

# List dashboard details (CLI)
aws cloudwatch get-dashboard \
  --dashboard-name flairx-infrastructure \
  --query 'DashboardBody' \
  --output text | jq '.widgets[].[.properties.title]'
```

### 10. CloudTrail Logging Verification

```bash
# Verify CloudTrail is logging
aws cloudtrail describe-trails \
  --query 'trailList[?Name==`flairx*`].[Name,IsLogging,S3BucketName]' \
  --output table

# Expected: IsLogging = true

# Verify CloudTrail logs are being written to S3
TRAIL_BUCKET=$(aws cloudtrail describe-trails \
  --query 'trailList[0].S3BucketName' \
  --output text)

aws s3 ls s3://$TRAIL_BUCKET/AWSLogs/ --recursive | head -10

# Expected: CloudTrail log files should appear after 15-30 minutes
```

### 11. Tagging Compliance Verification

```bash
# Verify all resources are properly tagged
aws ec2 describe-instances \
  --filters Name=tag:Project,Values=flairx \
  --query 'Reservations[].Instances[].[InstanceId,Tags[?Key==`Project`].Value[0],Tags[?Key==`Environment`].Value[0],Tags[?Key==`Owner`].Value[0]]' \
  --output table

# Verify RDS is tagged
aws rds describe-db-instances \
  --query 'DBInstances[].[DBInstanceIdentifier,TagList[?Key==`Project`].Value[0],TagList[?Key==`Environment`].Value[0]]' \
  --output table

# Verify ALB and security groups are tagged
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[].[LoadBalancerName,Tags[?Key==`Project`].Value[0],Tags[?Key==`Environment`].Value[0]]' \
  --output table
```

### 12. Cost Analysis

```bash
# Estimate current infrastructure costs
echo "Checking cost estimate..."

# List EC2 instances and their usage
aws ec2 describe-instances \
  --filters Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].[InstanceId,InstanceType,LaunchTime,State.Name]' \
  --output table

# Calculate hours running (for cost projection)
echo "Cost estimate (us-east-1, example):"
echo "- 1x t4g.medium (on-demand): ~$25/month"
echo "- ALB: ~$16/month"
echo "- 1x NAT Gateway: ~$32/month"
echo "- RDS db.t4g.medium: ~$50/month"
echo "- CloudWatch / Logs: ~$5-10/month"
echo "- Storage & transfer: ~$5/month"
echo "- VPC Flow Logs (S3): ~$0.12/month"
echo "Total Estimated: ~$130-140/month"

# Enable AWS Cost Explorer for actual spend
echo "Enable AWS Cost Explorer: https://console.aws.amazon.com/cost-management/home"
```

## Post-Deployment Configuration

### 1. Application Deployment

```bash
# Get EC2 instance details for deployment
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters Name=tag:aws:cloudformation:logical-id,Values=AppAsg \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

# Start Session Manager session
aws ssm start-session --target $INSTANCE_ID

# Inside the instance:
sudo su - app
cd /home/app/api

# Clone your application repo
git clone <your-app-repo> .

# Install dependencies
npm install --production

# Create PM2 ecosystem config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'flairx-api',
    script: './src/server.ts',
    exec_mode: 'cluster',
    instances: 'max',
    env: {
      NODE_ENV: 'production',
      PORT: 3004,
      LOG_LEVEL: 'info',
    },
    error_file: '/var/log/pm2/error.log',
    out_file: '/var/log/pm2/out.log',
  }],
};
EOF

# Start application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Verify application is running
pm2 status
curl http://localhost:3004/health
```

### 2. Setup SNS Email Notifications

```bash
# Subscribe email to alarm topic
SNS_ARN=$(source .env.generated && echo $ALARM_TOPIC_ARN)

aws sns subscribe \
  --topic-arn $SNS_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com

# Check email for confirmation link
# Click confirmation link (check spam folder!)
```

### 3. Configure Route53 CNAME

```bash
# Get ALB DNS name
ALB_DNS=$(source .env.generated && echo $ALB_DNS_NAME)
ZONE_ID=<your-route53-zone-id>

# Create CNAME record
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"CREATE\",
      \"ResourceRecordSet\": {
        \"Name\": \"api.flairx.ai\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$ALB_DNS\"}]
      }
    }]
  }"

# Verify DNS resolution
nslookup api.flairx.ai

# Test HTTPS endpoint (after deployment and warmup)
curl -I https://api.flairx.ai/health
```

## Ongoing Monitoring & Maintenance

### Weekly Checks

```bash
# Monitor infrastructure costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=API \
  --query 'ResultsByTime[].EstimatedTotal.BlendedCost.Amount' \
  --output table

# Check CloudWatch alarms for any breaches
aws cloudwatch describe-alarms \
  --alarm-name-prefix flairx \
  --state-value ALARM \
  --query 'MetricAlarms[].[AlarmName,StateValue,StateReason]' \
  --output table

# Review recent RDS backups
aws rds describe-db-snapshots \
  --db-instance-identifier flairx \
  --query 'DBSnapshots[0:5].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
  --output table
```

### Monthly Checks

```bash
# Verify backup retention and restore capabilities
aws rds describe-db-instances \
  --db-instance-identifier flairx \
  --query 'DBInstances[0].{BackupRetentionPeriod,LatestRestorableTime,PreferredBackupWindow}' \
  --output table

# Check log retention policies
aws logs describe-log-groups \
  --query 'logGroups[?logGroupName==`/flairx/*`].[logGroupName,retentionInDays,storedBytes]' \
  --output table

# Review IAM permissions (least-privilege validation)
aws iam get-role-policy \
  --role-name FlairXStack-Ec2InstanceRole* \
  --policy-name <policy-name> --output json | jq '.RolePolicy.PolicyDocument.Statement[]'
```

### Quarterly Scale Review

```bash
# After 2-3 weeks of stable traffic:
# 1. Apply 1-year Compute Savings Plan (~10% discount)
aws savingsplans-pricing get-savings-plans-offering-index \
  --filters name=region,values=us-east-1

# 2. Review Multi-AZ & second NAT Gateway requirements
# 3. Evaluate WAF/GuardDuty enablement
# 4. Assess Spot instance feasibility for non-prod
```

## Troubleshooting Deployment Issues

### CloudFormation Rollback

If deployment fails and rolls back:

```bash
# Check CloudFormation events for the specific error
aws cloudformation describe-stack-events \
  --stack-name FlairXStack \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`].[Timestamp,LogicalResourceId,ResourceStatusReason]' \
  --output table

# Common failures:
# - ACM certificate not found: Verify certArn in cdk.json
# - IAM permissions: Check AWS account permissions
# - Subnet exhaustion: VPC CIDR conflict with existing infrastructure
```

### Rollback to Previous Version

```bash
# If needed, destroy and redeploy
npx cdk destroy --force

# Note: This deletes all resources (ALB, RDS database, etc.)
# Data in RDS automated backups will be retained
```

---

**Deployment Completed!** ✅

Your production-grade FlairX infrastructure is now running. Proceed to post-deployment configuration steps above.
