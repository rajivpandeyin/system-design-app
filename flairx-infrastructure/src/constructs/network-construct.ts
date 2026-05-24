import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkConstructProps extends cdk.StackProps {
  vpcCidr: string;
  natGatewayCount: number;
  azCount: number;
  tags: Record<string, string>;
}

export class NetworkConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly publicSubnets: ec2.ISubnet[];
  public readonly privateSubnets: ec2.ISubnet[];
  public readonly isolatedSubnets: ec2.ISubnet[];

  constructor(scope: Construct, id: string, props: NetworkConstructProps) {
    super(scope, id);

    // Create VPC with public, private (app), and isolated (data) subnets across 2 AZs
    // We manually define subnet configuration for precise control
    this.vpc = new ec2.Vpc(this, 'FlairXVpc', {
      cidr: props.vpcCidr,
      maxAzs: props.azCount,
      natGateways: props.natGatewayCount,
      // Manually define subnet configuration
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'Public',
          cidrMask: 24,
          reserved: false,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          name: 'Private-App',
          cidrMask: 24,
          reserved: false,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          name: 'Private-Data',
          cidrMask: 24,
          reserved: false,
        },
      ],
    });

    // Store subnet references for use in other constructs
    this.publicSubnets = this.vpc.publicSubnets;
    this.privateSubnets = this.vpc.privateSubnets;
    this.isolatedSubnets = this.vpc.isolatedSubnets;

    // Add S3 Gateway VPC Endpoint (free) to bypass NAT Gateway for S3 traffic
    // This prevents expensive data transfer costs through the NAT Gateway
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsServices.S3,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // Add DynamoDB Gateway VPC Endpoint if needed in future
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsServices.DYNAMODB,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // Enable VPC Flow Logs to S3 (not CloudWatch for cost efficiency)
    // S3 destination: $0.023/GB vs CloudWatch: $0.50/GB ingestion cost
    this.addVpcFlowLogs();

    // Tag all resources
    Object.entries(props.tags).forEach(([key, value]) => {
      cdk.Tags.of(this.vpc).add(key, value);
    });

    // Output important information
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: 'FlairX-VpcId',
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      exportName: 'FlairX-VpcCidr',
    });
  }

  /**
   * Enable VPC Flow Logs to S3 for network troubleshooting
   * Destination is S3 (not CloudWatch) for cost optimization
   * POST-DEPLOY AUDIT: Verify Flow Logs destination is S3, not CloudWatch Log Group
   */
  private addVpcFlowLogs(): void {
    // Create S3 bucket for VPC Flow Logs
    const flowLogsBucket = new cdk.aws_s3.Bucket(this, 'VpcFlowLogsBucket', {
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: cdk.aws_s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // Add bucket policy to allow VPC Flow Logs service to write
    const flowLogsRole = new cdk.aws_iam.Role(this, 'VpcFlowLogsRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    flowLogsBucket.grantWrite(flowLogsRole);

    this.vpc.addFlowLog('FlowLogsS3', {
      destination: ec2.FlowLogDestination.toS3(flowLogsBucket, 'vpc-flow-logs/'),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // Output bucket name for audit purposes
    new cdk.CfnOutput(this, 'FlowLogsBucketName', {
      value: flowLogsBucket.bucketName,
      exportName: 'FlairX-FlowLogsBucket',
    });
  }

  /**
   * Get security group for ALB to be used by other constructs
   * This is populated after SecurityConstruct creates it
   */
  getAlbSecurityGroup(): ec2.ISecurityGroup | undefined {
    // This will be set by SecurityConstruct or fetched from exports
    return undefined;
  }

  /**
   * Get security group for EC2 instances
   */
  getEc2SecurityGroup(): ec2.ISecurityGroup | undefined {
    return undefined;
  }
}
