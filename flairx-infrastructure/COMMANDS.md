# FlairX Infrastructure - Command Reference

Quick reference for common operations with the CDK infrastructure.

## 🚀 Core Commands

### Setup & Deployment

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Bootstrap CDK (one-time per AWS account/region)
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1

# Synthesize CloudFormation template
cdk synth

# Preview infrastructure changes
cdk diff

# Deploy infrastructure with approval prompts
cdk deploy --all --require-approval any-change

# Deploy without prompts (for automation)
cdk deploy --all --require-approval never

# Destroy infrastructure (development only)
cdk destroy --all --force
```

### Validation & Quality

```bash
# Run AWS Well-Architected checks (cdk-nag)
npm run cdk:nag

# Watch TypeScript compilation
npm run watch

# Test constructs
npm run test
```

---

## 📊 AWS CLI Queries

### VPC & Networking

```bash
# List VPCs (find flairx VPC)
aws ec2 describe-vpcs --filters Name=tag:Project,Values=flairx

# List subnets by type
aws ec2 describe-subnets --filters Name=tag-key,Values=aws:cloudformation:stack-name

# Check NAT Gateway status
aws ec2 describe-nat-gateways --query 'NatGateways[].{NatGatewayId:NatGatewayId,State:State,Addresses:NatGatewayAddresses[0].PublicIp}'

# List VPC endpoints
aws ec2 describe-vpc-endpoints --query 'VpcEndpoints[].{ServiceName:ServiceName,State:State,VpcEndpointId:VpcEndpointId}'

# Check VPC Flow Logs
aws ec2 describe-flow-logs --query 'FlowLogs[].{DestinationType:DestinationType,Status:FlowLogStatus}'
```

### Load Balancer

```bash
# Get ALB DNS name
aws elbv2 describe-load-balancers --names flairx-alb \
  --query 'LoadBalancers[0].DNSName' --output text

# Check ALB target health
ALB_ARN=$(aws elbv2 describe-load-balancers --names flairx-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)
TG_ARN=$(aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN \
  --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-health --target-group-arn $TG_ARN

# List ALB access logs
aws s3 ls s3://flairx-alb-access-logs-* --recursive
```

### EC2 & Auto Scaling

```bash
# List EC2 instances
aws ec2 describe-instances --filters Name=tag:Project,Values=flairx \
  --query 'Reservations[].Instances[].{ID:InstanceId,Type:InstanceType,State:State.Name,LaunchTime:LaunchTime}'

# Get ASG details
aws autoscaling describe-auto-scaling-groups \
  --filters Name=tag:Project,Values=flairx \
  --query 'AutoScalingGroups[0].{Name:AutoScalingGroupName,MinSize:MinSize,DesiredCapacity:DesiredCapacity,MaxSize:MaxSize,InstanceCount:length(Instances)}'

# Scale ASG manually
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name <asg-name> --desired-capacity 3

# List scaling policy history
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name <asg-name> --max-records 10
```

### RDS Database

```bash
# Get RDS instance details
aws rds describe-db-instances --db-instance-identifier flairx \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Engine:Engine,Class:DBInstanceClass,Endpoint:Endpoint.Address,Port:Endpoint.Port}'

# List RDS backups
aws rds describe-db-snapshots --db-instance-identifier flairx \
  --query 'DBSnapshots[].{SnapshotId:DBSnapshotIdentifier,Size:AllocatedStorage,CreatedTime:SnapshotCreateTime,Status:Status}'

# Get database credentials
aws secretsmanager get-secret-value --secret-id flairx/rds/postgres \
  --query 'SecretString' --output text | jq .

# Check backup retention
aws rds describe-db-instances --db-instance-identifier flairx \
  --query 'DBInstances[0].{BackupRetentionPeriod:BackupRetentionPeriod,LatestRestorableTime:LatestRestorableTime}'
```

### CloudWatch Monitoring

```bash
# List CloudWatch alarms
aws cloudwatch describe-alarms --alarm-name-prefix flairx \
  --query 'MetricAlarms[].[AlarmName,StateValue,MetricName,Threshold]'

# Get specific alarm details
aws cloudwatch describe-alarms --alarm-names flairx-ec2-cpu-scale \
  --query 'MetricAlarms[0]' --output json

# Retrieve CloudWatch Dashboard
aws cloudwatch get-dashboard --dashboard-name flairx-infrastructure

# List CloudWatch Log Groups
aws logs describe-log-groups --query 'logGroups[?logGroupName==`/flairx/*`].[logGroupName,retentionInDays,storedBytes]'

# View recent log entries
aws logs tail /flairx/application --follow
```

### Security & IAM

```bash
# List security groups
aws ec2 describe-security-groups --filters Name=tag:Project,Values=flairx \
  --query 'SecurityGroups[].[GroupId,GroupName,Tags[?Key==`aws:cloudformation:logical-id`].Value[0]]'

# Get security group rules
aws ec2 describe-security-groups --group-ids <sg-id> \
  --query 'SecurityGroups[0].[IpPermissions[], IpPermissionsEgress[]]'

# List IAM roles
aws iam list-roles --query 'Roles[?contains(RoleName, `FlairX`)].{Name:RoleName,CreatedDate:CreateDate}'

# Get EC2 instance role policies
aws iam list-role-policies --role-name <role-name>

# View specific policy
aws iam get-role-policy --role-name <role-name> --policy-name <policy-name> --output json | jq .
```

### Cost Management

```bash
# Get recent cost estimate
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=API

# List cost anomalies (if enabled)
aws ce describe-anomaly-monitors \
  --query 'AnomalyMonitors[].{Name:MonitorName,Status:MonitorStatus}'

# Check EC2 instance costs (on-demand pricing)
aws ec2 describe-instances --filters Name=tag:Project,Values=flairx \
  --query 'Reservations[].Instances[].[InstanceId,InstanceType,LaunchTime]'
```

### Logging & Audit

```bash
# List CloudTrail trails
aws cloudtrail describe-trails --query 'trailList[?Name==`*flairx*`]' --output json

# Check CloudTrail status
aws cloudtrail get-trail-status --name <trail-name>

# List CloudTrail logs in S3
aws s3 ls s3://<cloudtrail-bucket>/AWSLogs/ --recursive | head -20

# Get CloudTrail events
aws cloudtrail lookup-events --lookup-attributes AttributeKey=ResourceName,AttributeValue=<resource-id> --max-results 10
```

---

## 🔌 EC2 Instance Access

### Using AWS Systems Manager Session Manager (SSH Replacement)

```bash
# List running instances
aws ec2 describe-instances --filters Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[0].InstanceId' --output text

# Start interactive session
aws ssm start-session --target <instance-id>

# Run command on instance
aws ssm send-command --instance-ids <instance-id> --document-name "AWS-RunShellScript" \
  --parameters 'commands=["curl http://localhost:3004/health"]'

# View command output
aws ssm get-command-invocation --command-id <command-id> --instance-id <instance-id>
```

### Inside EC2 Instance

```bash
# Check if application is running
pm2 list

# View application logs
pm2 logs flairx-api

# Monitor CPU/memory
top -b -n 1 | head -20

# Test health check
curl http://localhost:3004/health

# Check network connectivity to RDS
psql -h <rds-endpoint> -U flairxadmin -d flairx -c "SELECT version();"

# View CloudWatch Agent status
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a query -m ec2 -c ssm:/cloudwatch-config/flairx-app -s
```

---

## 🔐 Secrets Management

```bash
# List all secrets
aws secretsmanager list-secrets --query 'SecretList[].{Name:Name,LastRotatedDate:LastRotatedDate}'

# Get secret value
aws secretsmanager get-secret-value --secret-id flairx/rds/postgres \
  --query 'SecretString' --output text | jq .

# Create new secret
aws secretsmanager create-secret \
  --name flairx/api/keys \
  --secret-string '{"stripe":"sk_live_...","openai":"sk-..."}'

# Rotate secret manually
aws secretsmanager rotate-secret --secret-id <secret-id>

# Check rotation configuration
aws secretsmanager describe-secret --secret-id <secret-id> \
  --query '{RotationRules:RotationRules,NextRotationDate:NextRotationDate}'
```

---

## 🐛 Troubleshooting Commands

### Diagnose EC2 Issues

```bash
# Check instance system status
aws ec2 describe-instance-status --instance-ids <instance-id> \
  --query 'InstanceStatuses[0].[SystemStatus.Status,InstanceStatus.Status]'

# View EC2 system logs (for launch issues)
aws ec2 get-console-output --instance-id <instance-id>

# Check security group rules
aws ec2 describe-security-groups --group-ids <sg-id> \
  --query 'SecurityGroups[0].[IpPermissions[], IpPermissionsEgress[]]'

# Verify Network ACLs
aws ec2 describe-network-acls --filters Name=association.subnet-id,Values=<subnet-id> \
  --query 'NetworkAcls[0].Entries'
```

### Diagnose RDS Issues

```bash
# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier flairx \
  --query 'DBInstances[0].DBInstanceStatus'

# View RDS events
aws rds describe-events --source-identifier flairx \
  --query 'Events[0:10].[Timestamp,Message]'

# Check enhanced monitoring metrics (if enabled)
aws rds describe-db-instances --db-instance-identifier flairx \
  --query 'DBInstances[0].EnableCloudwatchLogsExports'

# List pending maintenance
aws rds describe-pending-maintenance-actions \
  --resource-identifier <db-arn>
```

### Diagnose ALB Issues

```bash
# Check ALB status
aws elbv2 describe-load-balancers --names flairx-alb \
  --query 'LoadBalancers[0].State'

# View target health details
aws elbv2 describe-target-health --target-group-arn <tg-arn> --output json

# Check ALB access logs
aws s3 ls s3://flairx-alb-access-logs-*/AWSLogs/ --recursive | tail -20

# Monitor ALB connection count
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name ActiveConnectionCount \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## 📈 Performance & Capacity Commands

```bash
# Monitor EC2 CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=AutoScalingGroupName,Value=<asg-name> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Monitor RDS CPU
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=flairx \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# Check RDS free storage
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=flairx \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Minimum \
  --query 'Datapoints[] | sort_by(@, &Timestamp)[-1]'
```

---

## 🔄 Updates & Maintenance

### Update Infrastructure

```bash
# Modify cdk.json and redeploy
# Example: increase ASG max capacity
nano cdk.json  # Edit ec2MaxCapacity

# Compile and deploy
npm run build
cdk deploy

# Or deploy specific stack
cdk deploy FlairXStack --require-approval any-change
```

### Update Application (without redeploying infrastructure)

```bash
# Get instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters Name=tag:Project,Values=flairx \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)

# Connect to instance
aws ssm start-session --target $INSTANCE_ID

# Inside instance:
cd /home/app/api
git pull origin main
npm install --production
pm2 reload flairx-api
```

---

**Keep this file handy for quick reference to common operations!**
