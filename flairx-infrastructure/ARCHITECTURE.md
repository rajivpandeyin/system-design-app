# FlairX Infrastructure - Project Structure & Summary

## 📂 Project Directory Structure

```
flairx-infrastructure/
├── bin/
│   ├── app.ts                          # CDK app entry point with cdk-nag enforcement
├── src/
│   ├── app.ts                          # Main application bootstrap
│   ├── stack.ts                        # Main FlairXStack orchestrator
│   └── constructs/
│       ├── index.ts                    # Exports for all constructs
│       ├── network-construct.ts        # VPC, subnets, NAT, VPC endpoints, Flow Logs
│       ├── security-construct.ts       # Security groups, IAM roles, instance profiles
│       ├── alb-construct.ts            # ALB, listeners, target groups, access logs
│       ├── compute-construct.ts        # EC2, Launch Template, ASG, scaling policies
│       ├── database-construct.ts       # RDS PostgreSQL, KMS, Secrets Manager
│       ├── monitoring-construct.ts     # CloudWatch, alarms, dashboard
│       ├── waf-construct.ts.disabled   # WAF (commented out, ready to enable)
│       └── guardduty-construct.ts.disabled  # GuardDuty (commented out, ready to enable)
├── cdk.json                            # CDK context parameters (environment variables)
├── package.json                        # Dependencies & build scripts
├── tsconfig.json                       # TypeScript configuration
├── .gitignore                          # Git ignore patterns
├── README.md                           # Comprehensive documentation
├── DEPLOYMENT_GUIDE.md                 # Step-by-step deployment & audit guide
└── ARCHITECTURE.md                     # This file

```

## 🏗️ Architecture Overview

### Layered Design

The infrastructure is organized into **7 independent constructs**, each responsible for a specific layer:

```
┌─────────────────────────────────────────────────────────┐
│  FlairXStack (Orchestrator)                            │
│  - Combines all constructs                             │
│  - CloudTrail logging                                  │
│  - Cost Anomaly Detection                              │
│  - Stack outputs & post-deploy instructions            │
└─────────────────────────────────────────────────────────┘
        ↓
┌────────────┬──────────────┬──────────────┬──────────────┐
│            │              │              │              │
↓            ↓              ↓              ↓              ↓
Network   Security         ALB          Compute       Database
│            │              │              │              │
├─ VPC       ├─ ALB SG      ├─ ALB         ├─ Launch TML  ├─ RDS Postgres
├─ Subnets   ├─ EC2 SG      ├─ Listeners   ├─ ASG         ├─ KMS Encryption
├─ NAT GW    ├─ RDS SG      ├─ Target GRP  ├─ Scaling     ├─ Secrets Manager
├─ VPC Endpt ├─ EC2 Role    ├─ Access Logs ├─ Policies    ├─ Backups
├─ Flow Logs └─ IAM Profile └─ S3 logs     └─ User Data   ├─ Performance Insights
                                                           └─ Automatic rotation
```

### Dependency Graph

```
FlairXStack
    ├─ NetworkConstruct
    │   └─ VPC (prerequisite for all others)
    │
    ├─ SecurityConstruct (depends on VPC)
    │   ├─ Security Groups
    │   └─ IAM Roles
    │
    ├─ AlbConstruct (depends on VPC + Security groups)
    │   └─ ALB + Target Group
    │
    ├─ ComputeConstruct (depends on VPC + ALB + Security)
    │   └─ ASG + Launch Template
    │
    ├─ DatabaseConstruct (depends on VPC + Security)
    │   └─ RDS + KMS + Secrets Manager
    │
    └─ MonitoringConstruct (depends on ALB + ASG + RDS)
        └─ CloudWatch alarms + Dashboard + SNS
```

## 📦 Construct Details

### 1. NetworkConstruct
**File**: `src/constructs/network-construct.ts`

**Responsibility**: Networking infrastructure layer

**Creates**:
- VPC (10.0.0.0/16)
- 3 subnet tiers × 2 AZs = 6 subnets:
  - Public (10.0.{0,1}.0/24)
  - Private App (10.0.{2,3}.0/24)
  - Private Data (10.0.{4,5}.0/24)
- 1 NAT Gateway (cost-optimized, shared)
- S3 Gateway VPC Endpoint (free)
- DynamoDB Gateway VPC Endpoint (free)
- VPC Flow Logs → S3 (cost opt vs CloudWatch)

**Exports**:
- VPC reference
- Subnet arrays (public, private, isolated)

**Cost**: $32/month (NAT Gateway)

---

### 2. SecurityConstruct
**File**: `src/constructs/security-construct.ts`

**Responsibility**: All access control and permissions

**Creates**:
- **ALB Security Group**: HTTPS/HTTP (443/80) inbound
- **EC2 Security Group**: Inbound from ALB (3004), egress to RDS (5432) + internet (443/80)
- **RDS Security Group**: Inbound from EC2 (5432) only
- **EC2 Instance Role** with least-privilege:
  - Systems Manager Session Manager (no SSH)
  - CloudWatch Agent
  - Secrets Manager read (KMS decrypt)
  - S3 read (flairx-* buckets only)
  - SSM Parameter Store read

**Exports**:
- Security group references
- EC2 instance profile (for ASG)

**Cost**: No additional costs (AWS best practices)

---

### 3. AlbConstruct
**File**: `src/constructs/alb-construct.ts`

**Responsibility**: Load balancing and traffic distribution

**Creates**:
- Application Load Balancer (public subnets, 2 AZs)
- HTTPS listener (443) with ACM certificate
- HTTP listener (80) with 301 redirect to HTTPS
- Target Group (port 3004, health check `/health`)
- Access logs bucket (S3):
  - 30-day Intelligent-Tiering transition
  - 90-day expiration
- Deletion protection (prevent accidents)

**Exports**:
- ALB DNS name (for Route53 CNAME)
- Target group reference

**Cost**: ~$16/month (ALB hourly + data processing)

---

### 4. ComputeConstruct
**File**: `src/constructs/compute-construct.ts`

**Responsibility**: EC2 instance lifecycle and auto-scaling

**Creates**:
- Launch Template:
  - t4g.medium (ARM Graviton3, ~19% cheaper)
  - Amazon Linux 2023 ARM64
  - 20 GB gp3 root volume
  - IMDSv2 enforced, no IMDSv1
  - User Data: Node.js v20 + PM2 + CloudWatch Agent
- Auto Scaling Group (Min:1, Desired:1, Max:4):
  - Private subnets only (no public IPs)
  - Registered with ALB target group
  - ELB health checks
- Target Tracking Policies:
  - CPU: scale out at 60%
  - ALB request count per target
  - Scale-in cooldown: 300s (prevent flapping)

**Exports**:
- ASG reference
- Launch Template ID

**Cost**: ~$25/month (1× t4g.medium on-demand)

---

### 5. DatabaseConstruct
**File**: `src/constructs/database-construct.ts`

**Responsibility**: Data layer persistence and secrets

**Creates**:
- RDS PostgreSQL 16.1:
  - db.t4g.medium (ARM Graviton, ~10% cheaper)
  - Isolated subnets (no internet access)
  - Single-AZ (architected for Multi-AZ: one change)
  - 100 GB gp3 storage (3000 IOPS baseline free)
  - Encrypted at rest with KMS CMK
  - Performance Insights (7-day free retention)
  - 7-day automated backups + PITR
- KMS CMK for encryption
- Secrets Manager:
  - Credential storage (flairx/rds/postgres)
  - 30-day automatic rotation
  - Accessible only to EC2 via IAM role

**Exports**:
- DB endpoint, port, name
- Secrets Manager ARN

**Cost**: ~$50/month (db.t4g.medium + storage)

---

### 6. MonitoringConstruct
**File**: `src/constructs/monitoring-construct.ts`

**Responsibility**: Observability, alerting, and dashboards

**Creates**:
- CloudWatch Log Groups (with retention):
  - `/flairx/application` (14 days)
  - `/flairx/errors` (30 days)
  - `/flairx/audit` (90 days CloudTrail)
- CloudWatch Alarms (8 total):
  - EC2 CPU > 60% (scale awareness) + > 80% (CRITICAL)
  - RDS CPU > 75%
  - ALB 5xx error rate > 1%
  - ALB P99 response time > 2s
  - ALB UnHealthyHostCount > 0
  - RDS storage < 10 GB free
  - ASG at Max capacity
- SNS Topic for alarm notifications
- CloudWatch Dashboard:
  - EC2 CPU, ALB requests, 5xx rate
  - RDS CPU, connections
  - ASG capacity, health status

**Exports**:
- SNS Topic ARN (for email/SMS subscription)
- Dashboard URL

**Cost**: ~$5-10/month (CloudWatch Logs)

---

### 7. FlairXStack (Orchestrator)
**File**: `src/stack.ts`

**Responsibility**: Coordinate all constructs and cross-cutting concerns

**Creates**:
- CloudTrail (management events only):
  - Logs to S3 with 30-day Intelligent-Tiering, 90-day expiration
  - CloudWatch Logs export (90-day retention)
- Resource tagging:
  - Project, Environment, Owner, CostCenter, ManagedBy=CDK
- cdk-nag enforcement (AWS Well-Architected checks)
- Cost control reminders (Savings Plans, scheduled scaling)

**Exports**:
- All construct outputs
- Post-deployment checklist

**Cost**: Negligible (CloudTrail free tier, S3 ~$0.12/month)

---

## 🔗 Inter-Construct Communication

### Data Flow

1. **NetworkConstruct** → Creates VPC foundation
2. **SecurityConstruct** → Uses VPC, creates security groups + roles
3. **AlbConstruct** → Uses VPC + security groups, creates ALB
4. **ComputeConstruct** → Uses VPC + roles + security groups + ALB target group
5. **DatabaseConstruct** → Uses VPC + security groups + KMS + Secrets
6. **MonitoringConstruct** → Monitors outputs from ALB, ASG, RDS

### CloudFormation Dependencies

CDK automatically manages dependencies:
- VPC is created first (prerequisite for all)
- Security groups created after VPC
- ALB created after security groups
- Compute and Database created after prerequisites
- Monitoring created last (monitors the above)

## 📊 Configuration Hierarchy

```
cdk.json (Environment Parameters)
    ↓
FlairXStack (reads context via this.node.tryGetContext())
    ├─ NetworkConstruct
    │   └─ Uses: vpcCidr, azCount, natGatewayCount
    ├─ ComputeConstruct
    │   └─ Uses: ec2InstanceType, ec2MinCapacity, ec2DesiredCapacity, ec2MaxCapacity
    ├─ DatabaseConstruct
    │   └─ Uses: rdsInstanceClass
    ├─ AlbConstruct
    │   └─ Uses: certArn
    └─ MonitoringConstruct
        └─ Uses: alarmThresholds
```

All configuration is externalized to `cdk.json` for easy management without code changes.

## 🚀 Build & Deploy Pipeline

```
1. npm install            → Install dependencies
2. npm run build          → Compile TypeScript → lib/*.js
3. cdk bootstrap          → Setup CloudFormation+S3 (one-time)
4. cdk synth              → Generate CloudFormation template
5. npm run cdk:nag        → AWS Well-Architected validation
6. cdk diff               → Preview changes
7. cdk deploy             → Execute CloudFormation stack
```

## 📈 Infrastructure Metrics

### Resource Count
- **Compute**: 1-4 EC2 instances (auto-scaling)
- **Networking**: 1 VPC, 6 subnets, 1 NAT, 2 VPC endpoints
- **Load Balancing**: 1 ALB, 1 target group
- **Database**: 1 RDS instance, 1 KMS key, 1 secret
- **Storage**: 3 S3 buckets (ALB logs, Flow Logs, CloudTrail)
- **Monitoring**: 1 SNS topic, 1 dashboard, 8 alarms
- **Logging**: 3 CloudWatch Log Groups, 1 CloudTrail

### Total Estimated Cost
- **Monthly**: ~$130-140 (with 1 running instance)
- **Scaling**: +$25 per additional EC2 instance, +$50 for Multi-AZ RDS

### Cost Optimization Levers
1. Switch to Spot instances (test/dev): -70% EC2
2. Add Savings Plan after 2-3 weeks: -10% compute
3. Enable Multi-AZ RDS when needed: +$50/month
4. Add second NAT Gateway for HA: +$32/month
5. VPC Interface Endpoints: Break-even at 150 GB/mo NAT data

## 🔒 Security Features

✅ **Network Security**
- VPC isolated from internet (except ALB)
- Private subnets for EC2 (no public IPs)
- Isolated subnet for RDS (no routes to internet)
- NACLs on all subnets

✅ **Instance Security**
- IMDSv2 enforced (no IMDSv1)
- No direct SSH (IAM Session Manager only)
- Least-privilege IAM roles
- All secrets in Secrets Manager (never env vars)

✅ **Data Security**
- RDS encrypted at rest (KMS CMK)
- RDS encrypted in transit (HTTPS)
- Secrets rotation (30 days)
- EBS volume encryption
- S3 bucket encryption

✅ **Audit & Compliance**
- CloudTrail logging (all API calls)
- VPC Flow Logs (all network traffic)
- CloudWatch Logs (14-90 day retention)
- ALB access logs (for compliance)

⏳ **Future Security**
- WAF (commented, ready to enable)
- GuardDuty (commented, ready to enable)
- Shield Standard (always on)

## 📋 Quality Assurance

✅ **Infrastructure as Code**
- All infrastructure defined in TypeScript
- Version controlled (Git)
- Code review process available
- Repeatable deployments

✅ **Testing**
- cdk-nag validates AWS Well-Architected
- CloudFormation/CDK type safety
- Manual testing checklist in DEPLOYMENT_GUIDE.md

✅ **Documentation**
- README.md (comprehensive overview)
- DEPLOYMENT_GUIDE.md (step-by-step)
- ARCHITECTURE.md (this file)
- Inline code comments (every construct)

## 🎯 Next Steps

### Immediate (Week 1)
1. Review cdk.json parameters
2. Run `cdk deploy`
3. Follow post-deployment audit checklist
4. Deploy application to EC2 instances

### Short-term (Week 2-3)
1. Apply 1-year Compute Savings Plan (~10% discount)
2. Monitor CloudWatch dashboards
3. Test failover scenarios
4. Validate backup/restore procedures

### Medium-term (Week 3+)
1. Enable Multi-AZ RDS (for SLA)
2. Add second NAT Gateway (for HA)
3. Uncomment and enable WAF (if public)
4. Uncomment and enable GuardDuty (threat detection)

### Long-term (Month 2+)
1. Evaluate Spot instances for non-prod
2. Implement scheduled scaling
3. Add VPC Interface Endpoints (if NAT costs high)
4. Consider Reserved Instances for stable baseline

---

**Project Version**: 1.0.0  
**Status**: Production-Ready  
**Last Updated**: April 28, 2026
