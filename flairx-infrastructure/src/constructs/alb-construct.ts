import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface AlbConstructProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  albSecurityGroup: ec2.SecurityGroup;
  certArn: string;
  tags: Record<string, string>;
}

export class AlbConstruct extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly accessLogsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AlbConstructProps) {
    super(scope, id);

    // Create S3 bucket for ALB access logs
    // Transition to Intelligent-Tiering after 30 days, expire after 90 days
    this.accessLogsBucket = new s3.Bucket(this, 'AlbAccessLogsBucket', {
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

    // Get the AWS account ID for ALB service principal
    // Different regions have different ALB service principals
    const stack = cdk.Stack.of(this);
    const albAccountIds: Record<string, string> = {
      'us-east-1': '127311923021',
      'us-east-2': '033677994240',
      'us-west-1': '027434742980',
      'us-west-2': '797873946194',
      'eu-west-1': '156460612806',
      'eu-central-1': '054676820928',
      'ap-southeast-1': '114774131450',
      'ap-southeast-2': '783225319266',
      'ap-northeast-1': '582318560864',
    };

    const albAccountId = albAccountIds[stack.region] || '127311923021';

    // ALB service principal to write logs to bucket
    const albServicePrincipal = new cdk.aws_iam.AccountPrincipal(albAccountId);
    this.accessLogsBucket.grantWrite(albServicePrincipal);

    // Create Application Load Balancer in public subnets
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'FlairXAlb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      loadBalancerName: 'flairx-alb',
    });

    // Enable ALB access logs
    this.alb.logAccessLogs(this.accessLogsBucket, 'alb-logs');

    // Enable deletion protection to prevent accidental deletion
    this.alb.setAttribute('deletion_protection.enabled', 'true');

    // Create target group for EC2 instances
    // Health checks: path /health, interval 30s, timeout 10s, healthy threshold 2, unhealthy 3
    this.targetGroup = new elbv2.ApplicationTargetGroup(
      this,
      'AppTargetGroup',
      {
        vpc: props.vpc,
        protocol: elbv2.ApplicationProtocol.HTTP,
        port: 3004,
        targetType: elbv2.TargetType.INSTANCE,
        deregistrationDelay: cdk.Duration.seconds(30),
        healthCheck: {
          enabled: true,
          path: '/health',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3,
          port: '3004',
          protocol: elbv2.Protocol.HTTP,
        },
      }
    );

    // Add HTTPS listener (port 443) using provided ACM certificate
    const httpsListener = this.alb.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [
        elbv2.ListenerCertificate.fromArn(props.certArn),
      ],
      defaultTargetGroups: [this.targetGroup],
    });

    // Add HTTP listener (port 80) that redirects all traffic to HTTPS (301)
    const httpListener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    // Tag all resources
    Object.entries(props.tags).forEach(([key, value]) => {
      cdk.Tags.of(this.alb).add(key, value);
      cdk.Tags.of(this.targetGroup).add(key, value);
      cdk.Tags.of(this.accessLogsBucket).add(key, value);
    });

    // Export ALB DNS name for use with Route53 CNAME record
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS name to be used with CNAME record (api.flairx.ai)',
      exportName: 'FlairX-AlbDnsName',
    });

    new cdk.CfnOutput(this, 'AlbUrl', {
      value: `https://${this.alb.loadBalancerDnsName}`,
      description: 'ALB URL (before DNS cutover)',
      exportName: 'FlairX-AlbUrl',
    });

    new cdk.CfnOutput(this, 'AccessLogsBucket', {
      value: this.accessLogsBucket.bucketName,
      exportName: 'FlairX-AccessLogsBucket',
    });
  }
}
