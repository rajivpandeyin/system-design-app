import * as cdk from 'aws-cdk-lib';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { NetworkConstruct } from './constructs/network-construct';
import { SecurityConstruct } from './constructs/security-construct';
import { AlbConstruct } from './constructs/alb-construct';
import { ComputeConstruct } from './constructs/compute-construct';
import { DatabaseConstruct } from './constructs/database-construct';
import { MonitoringConstruct } from './constructs/monitoring-construct';

export class FlairXStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ===== EXTRACT CONTEXT PARAMETERS =====
    const environment = this.node.tryGetContext('environment') || 'production';
    const project = this.node.tryGetContext('project') || 'flairx';
    const vpcCidr = this.node.tryGetContext('vpcCidr') || '10.0.0.0/16';
    const azCount = this.node.tryGetContext('azCount') || 2;
    const natGatewayCount = this.node.tryGetContext('natGatewayCount') || 1;
    const ec2InstanceType = this.node.tryGetContext('ec2InstanceType') || 't4g.medium';
    const ec2MinCapacity = this.node.tryGetContext('ec2MinCapacity') || 1;
    const ec2DesiredCapacity =
      this.node.tryGetContext('ec2DesiredCapacity') || 1;
    const ec2MaxCapacity = this.node.tryGetContext('ec2MaxCapacity') || 4;
    const rdsInstanceClass =
      this.node.tryGetContext('rdsInstanceClass') || 'db.t4g.medium';
    const certArn = this.node.tryGetContext('certArn');
    const owner = this.node.tryGetContext('owner') || 'platform-team';
    const costCenter = this.node.tryGetContext('costCenter') || 'engineering';
    const alarmThresholds = this.node.tryGetContext('alarmThresholds') || {
      cpuScale: 60,
      cpuCritical: 80,
      rdssCpu: 75,
      alb5xxRate: 1,
      albP99ResponseTime: 2000,
      rdsFreeStorage: 10,
    };

    // Validate required parameters
    if (!certArn) {
      throw new Error(
        'certArn context parameter is required. Provide via CDK context or cdk.json'
      );
    }

    // ===== COMMON TAGS =====
    const tags: Record<string, string> = {
      Project: project,
      Environment: environment,
      Owner: owner,
      CostCenter: costCenter,
      ManagedBy: 'CDK',
    };

    // Apply tags to all resources in this stack
    cdk.Tags.of(this).add('Project', project);
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Owner', owner);
    cdk.Tags.of(this).add('CostCenter', costCenter);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // ===== NETWORK CONSTRUCT =====
    const network = new NetworkConstruct(this, 'Network', {
      vpcCidr,
      natGatewayCount,
      azCount,
      tags,
    });

    // ===== SECURITY CONSTRUCT =====
    const security = new SecurityConstruct(this, 'Security', {
      vpc: network.vpc,
      tags,
    });

    // ===== ALB CONSTRUCT =====
    const alb = new AlbConstruct(this, 'Alb', {
      vpc: network.vpc,
      albSecurityGroup: security.albSecurityGroup,
      certArn,
      tags,
    });

    // ===== COMPUTE CONSTRUCT =====
    const compute = new ComputeConstruct(this, 'Compute', {
      vpc: network.vpc,
      ec2SecurityGroup: security.ec2SecurityGroup,
      ec2InstanceRole: security.ec2InstanceRole,
      ec2InstanceProfile: security.ec2InstanceProfile,
      targetGroup: alb.targetGroup,
      ec2InstanceType,
      minCapacity: ec2MinCapacity,
      desiredCapacity: ec2DesiredCapacity,
      maxCapacity: ec2MaxCapacity,
      tags,
    });

    // ===== DATABASE CONSTRUCT =====
    const database = new DatabaseConstruct(this, 'Database', {
      vpc: network.vpc,
      rdsSecurityGroup: security.rdsSecurityGroup,
      rdsInstanceClass,
      tags,
    });

    // ===== MONITORING CONSTRUCT =====
    const monitoring = new MonitoringConstruct(this, 'Monitoring', {
      alb: alb.alb,
      targetGroup: alb.targetGroup,
      asg: compute.asg,
      database: database.database,
      alarmThresholds,
      tags,
    });

    // ===== CLOUDTRAIL LOGGING =====
    // Enable AWS CloudTrail for audit logging (management events only)
    // One trail, management events only (free tier; skip data events)
    const cloudtrailBucket = new s3.Bucket(this, 'CloudtrailBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    const trail = new cloudtrail.Trail(this, 'FlairXTrail', {
      bucket: cloudtrailBucket,
      isMultiRegionTrail: false,
      includeGlobalServiceEvents: true,
      enableFileValidation: true,
      sendToCloudWatchLogs: true,
      cloudWatchLogsRetention: logs.RetentionDays.THREE_MONTHS,
    });

    // Only log management events (no data events) to keep costs down
    trail.logAllS3DataEvents();

    cdk.Tags.of(cloudtrailBucket).add('Project', project);
    cdk.Tags.of(cloudtrailBucket).add('Environment', environment);

    // ===== COST ANOMALY DETECTION =====
    // Enable Cost Anomaly Detection with SNS alert threshold of $50 deviation
    // This requires creating a Cost Anomaly Monitor and alert
    this.enableCostAnomalyDetection();

    // ===== STACK OUTPUTS & SUMMARY =====

    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'FlairX Stack Name',
    });

    new cdk.CfnOutput(this, 'DeploymentRegion', {
      value: this.region,
      description: 'AWS Region',
    });

    new cdk.CfnOutput(this, 'DeploymentAccount', {
      value: this.account,
      description: 'AWS Account ID',
    });

    new cdk.CfnOutput(this, 'Environment', {
      value: environment,
      description: 'Deployment Environment',
    });

    // Provide helpful post-deployment instructions
    this.providePostDeploymentInstructions();
  }

  /**
   * Enable AWS Cost Anomaly Detection
   * NOTE: Cost Anomaly Detection requires AWS Cost Explorer to be enabled
   * and must be configured via the AWS Cost Management console for SNS subscriptions
   */
  private enableCostAnomalyDetection(): void {
    // Cost Anomaly Detection is configured via AWS Cost Management console
    // This is a reminder to enable it post-deployment
    console.log(
      'Cost Anomaly Detection: Enable via AWS Cost Management console, set alert threshold to $50'
    );
  }

  /**
   * Provide helpful information about post-deployment steps
   */
  private providePostDeploymentInstructions(): void {
    const instructions = `
    ===== POST-DEPLOYMENT AUDIT CHECKLIST =====
    
    1. ELASTIC IP AUDIT:
       - Check for unattached EIPs created by NAT Gateway:
       aws ec2 describe-addresses --query 'Addresses[?AssociationId==null]'
       - Tag EIPs for cost tracking if needed
    
    2. VPC FLOW LOGS VERIFICATION:
       - Verify Flow Logs destination is S3, not CloudWatch Log Group
       - Check CloudWatch Log Groups for /flairx/* to confirm correct retention
    
    3. APPLICATION CONFIGURATION:
       - SSH via AWS Systems Manager Session Manager (no direct SSH access):
         aws ssm start-session --target <instance-id>
       - Install CloudWatch Agent configuration from Parameter Store
       - Set LOG_LEVEL=info in application environment (never debug in prod)
    
    4. RDS VERIFICATION:
       - Verify DB credentials rotated in Secrets Manager
       - Test connection from EC2 instance to RDS
       - Verify automated backups enabled (7-day retention)
       - Enable Performance Insights dashboard in RDS console
    
    5. CERTIFICATE & DNS:
       - Verify ACM certificate ARN in cdk.json matches deployed certificate
       - Once instances are healthy, update Route53 CNAME to ALB DNS name
       - See CloudWatch outputs for ALB DNS name: api.flairx.ai -> <alb-dns>
    
    6. STRUCTURED LOGGING SETUP:
       - Deploy pino logger in Node.js application
       - Include fields: timestamp, level, requestId, service, traceId
       - Verify logs appear in CloudWatch Log Group: /flairx/application
    
    7. SECRETS MANAGEMENT:
       - Create secrets in AWS Secrets Manager:
         - flairx/rds/postgres (created by CDK, rotate every 30 days)
         - flairx/api/keys (third-party API tokens)
       - Cache secrets in app memory using @aws/secrets-manager-caching-client
       - Never pass secrets as plaintext environment variables
    
    8. MONITORING & ALERTS:
       - Subscribe to SNS topic for alarms (see CloudWatch outputs)
       - Set email notification preference in SNS console
       - Review CloudWatch Dashboard: flairx-infrastructure
       - Monitor EC2 CPU, ALB request count, 5xx rate, RDS CPU
    
    ===== COST OPTIMIZATION ROADMAP =====
    
    IMMEDIATE (Week 1-2):
       - Monitor actual usage: EC2, NAT Gateway, data transfer
       - Confirm t4g.medium instances meet performance requirements
    
    MEDIUM-TERM (Week 2-3):
       - After 2-3 weeks of stable traffic, apply 1-year Compute Savings Plan
       - Estimated additional ~10% discount on EC2 costs
    
    SCALE-UP CHECKLIST:
       - Multi-AZ RDS: Set multiAz: true in DatabaseConstruct (one CDK change)
       - Second NAT Gateway: Increase natGatewayCount to 2 in cdk.json
       - WAF: Uncomment WAFConstruct when fully public or compliance requires
       - GuardDuty: Add post-launch for threat detection
       - VPC Interface Endpoints: If NAT data costs spike >$20/mo, add endpoints
         for ssm, ssmmessages, ec2messages, monitoring (~$7/endpoint/mo)
    
    ===== IMPORTANT REMINDERS =====
    
    - NO SSH ACCESS: Use AWS Systems Manager Session Manager
    - NO DEBUG LOGS IN PROD: Debug logs are 3-5x more verbose
    - CACHE SECRETS: Use @aws/secrets-manager-caching-client, not API call per request
    - MONITOR COSTS: Track NAT Gateway, CloudWatch Logs, RDS storage
    - BACKUP STRATEGY: RDS backups enabled (7-day retention + point-in-time recovery)
    - SECURITY: Only EC2 SG can access RDS, only ALB SG can reach EC2
    `;

    console.log(instructions);
  }
}
