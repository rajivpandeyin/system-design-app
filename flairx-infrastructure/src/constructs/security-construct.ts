import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SecurityConstructProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  tags: Record<string, string>;
}

export class SecurityConstruct extends Construct {
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ec2SecurityGroup: ec2.SecurityGroup;
  public readonly rdsSecurityGroup: ec2.SecurityGroup;
  public readonly ec2InstanceRole: iam.Role;
  public readonly ec2InstanceProfile: iam.InstanceProfile;

  constructor(scope: Construct, id: string, props: SecurityConstructProps) {
    super(scope, id);

    // Create ALB Security Group
    // Allow HTTPS (443) and HTTP (80) from anywhere (IPv4 and IPv6)
    // Restrict outbound to EC2 SG on port 3004 only
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for flairX ALB',
      allowAllOutbound: false,
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from internet (IPv4)'
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet (IPv4)'
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(443),
      'Allow HTTPS from internet (IPv6)'
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet (IPv6)'
    );

    // Create EC2 Security Group
    // Allow inbound only from ALB SG on port 3004 (app server)
    // Allow outbound to RDS on 5432 and to internet for SSM, npm, CloudWatch
    this.ec2SecurityGroup = new ec2.SecurityGroup(this, 'Ec2SecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for flairX EC2 instances',
      allowAllOutbound: false,
    });

    // Inbound: ALB → EC2 on port 3004
    this.ec2SecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3004),
      'Allow traffic from ALB on port 3004'
    );

    // Outbound: EC2 → Internet for SSM, npm, CloudWatch
    // SSM uses HTTPS (443) to Systems Manager endpoints
    this.ec2SecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS for SSM, CloudWatch, npm'
    );

    this.ec2SecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP for npm and package managers'
    );

    // Create RDS Security Group
    // Allow inbound only from EC2 SG on port 5432
    // No public inbound
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for flairX RDS PostgreSQL',
      allowAllOutbound: true,
    });

    this.rdsSecurityGroup.addIngressRule(
      this.ec2SecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from EC2 instances'
    );

    // Now configure ALB → RDS routing (ALB SG should be able to reach EC2 SG)
    this.albSecurityGroup.addEgressRule(
      this.ec2SecurityGroup,
      ec2.Port.tcp(3004),
      'Allow outbound to EC2 on port 3004'
    );

    // EC2 → RDS on 5432
    this.ec2SecurityGroup.addEgressRule(
      this.rdsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL to RDS'
    );

    // Create IAM Role for EC2 instances with least-privilege permissions
    this.ec2InstanceRole = new iam.Role(this, 'Ec2InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'EC2 instance role for flairX application',
    });

    // Policy: AWS Systems Manager Session Manager access (for shell access without SSH)
    // This is included in the AmazonSSMManagedInstanceCore policy
    this.ec2InstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
    );

    // Policy: CloudWatch agent access (for application and system logs)
    this.ec2InstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
    );

    // Policy: Secrets Manager - read-only access to secrets
    // Restrict to flairx-* secrets only
    this.ec2InstanceRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: [
          cdk.Arn.format(
            {
              service: 'secretsmanager',
              resource: 'secret:flairx-*',
            },
            cdk.Stack.of(this)
          ),
        ],
      })
    );

    // Policy: KMS decrypt access for secrets encrypted with KMS
    this.ec2InstanceRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['kms:Decrypt', 'kms:DescribeKey'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'aws:RequestedRegion': cdk.Stack.of(this).region,
          },
        },
      })
    );

    // Policy: S3 read-only access (for application data reads)
    // Restrict to flairx-* buckets only
    this.ec2InstanceRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:ListBucket', 's3:GetObjectVersion'],
        resources: [
          cdk.Arn.format(
            {
              service: 's3',
              resource: 'flairx-*',
            },
            cdk.Stack.of(this)
          ),
          cdk.Arn.format(
            {
              service: 's3',
              resource: 'flairx-*/*',
            },
            cdk.Stack.of(this)
          ),
        ],
      })
    );

    // Policy: SSM Parameter Store - read-only for CloudWatch agent config
    this.ec2InstanceRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
        resources: [
          cdk.Arn.format(
            {
              service: 'ssm',
              resource: 'parameter/flairx/*',
            },
            cdk.Stack.of(this)
          ),
        ],
      })
    );

    // Create instance profile to attach role to EC2 instances
    this.ec2InstanceProfile = new iam.InstanceProfile(
      this,
      'Ec2InstanceProfile',
      {
        role: this.ec2InstanceRole,
      }
    );

    // Tag all security groups
    Object.entries(props.tags).forEach(([key, value]) => {
      cdk.Tags.of(this.albSecurityGroup).add(key, value);
      cdk.Tags.of(this.ec2SecurityGroup).add(key, value);
      cdk.Tags.of(this.rdsSecurityGroup).add(key, value);
    });

    // Output security group IDs for reference
    new cdk.CfnOutput(this, 'AlbSgId', {
      value: this.albSecurityGroup.securityGroupId,
      exportName: 'FlairX-AlbSgId',
    });

    new cdk.CfnOutput(this, 'Ec2SgId', {
      value: this.ec2SecurityGroup.securityGroupId,
      exportName: 'FlairX-Ec2SgId',
    });

    new cdk.CfnOutput(this, 'RdsSgId', {
      value: this.rdsSecurityGroup.securityGroupId,
      exportName: 'FlairX-RdsSgId',
    });
  }
}
