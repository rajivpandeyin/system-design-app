import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ComputeConstructProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  ec2SecurityGroup: ec2.SecurityGroup;
  ec2InstanceRole: iam.Role;
  ec2InstanceProfile: iam.InstanceProfile;
  targetGroup: elbv2.ApplicationTargetGroup;
  ec2InstanceType: string;
  minCapacity: number;
  desiredCapacity: number;
  maxCapacity: number;
  tags: Record<string, string>;
}

export class ComputeConstruct extends Construct {
  public readonly asg: autoscaling.AutoScalingGroup;
  public readonly launchTemplate: ec2.LaunchTemplate;

  constructor(scope: Construct, id: string, props: ComputeConstructProps) {
    super(scope, id);

    // Create Launch Template (not Launch Configuration — deprecated)
    // Instance type: t4g.medium (ARM Graviton3, ~19% cheaper than t3.medium)
    // Uses ARM64 Amazon Linux 2023 AMI
    this.launchTemplate = new ec2.LaunchTemplate(this, 'AppLaunchTemplate', {
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64, // ARM Graviton processor
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MEDIUM
      ),
      securityGroup: props.ec2SecurityGroup,
      role: props.ec2InstanceRole,
      blockDevices: [
        {
          // Root volume: 20 GB gp3 (not default 30 GB)
          // Node.js + PM2 app uses under 8 GB
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true,
            iops: 3000, // gp3 free baseline
            throughput: 125, // gp3 default
          }),
        },
      ],
      // Enforce IMDSv2-only (no IMDSv1)
      allowAllOutbound: false,
      httpTokens: ec2.LaunchTemplateHttpTokens.REQUIRED,
      httpPutResponseHopLimit: 1,
      spotPrice: undefined, // Use on-demand by default; can be changed to spot for more cost savings
      associatePublicIpAddress: false, // Instances in private subnets, no public IP
    });

    // Add user data to install Node.js v20 LTS and PM2
    this.launchTemplate.addUserData(
      `#!/bin/bash
set -e

# Update system packages
yum update -y

# Install Node.js v20 LTS from Amazon Linux Extras
amazon-linux-extras install -y nodejs20

# Install PM2 globally
npm install -g pm2@latest

# Create app user and home directory
useradd -m -s /bin/bash app || true
mkdir -p /home/app/api
chown -R app:app /home/app

# Install CloudWatch Agent (optional, but recommended)
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/arm64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm
rm ./amazon-cloudwatch-agent.rpm

# Log successful setup
echo "User data script completed at \$(date)" >> /var/log/user-data.log
`
    );

    // Create Auto Scaling Group
    // Min: 1, Desired: 1, Max: 4 instances
    // Deploy in private (app) subnets only
    this.asg = new autoscaling.AutoScalingGroup(this, 'AppAsg', {
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      launchTemplate: this.launchTemplate,
      minCapacity: props.minCapacity,
      desiredCapacity: props.desiredCapacity,
      maxCapacity: props.maxCapacity,
      healthCheck: autoscaling.HealthCheck.elb({
        grace: cdk.Duration.seconds(300),
      }),
      spinUpTime: cdk.Duration.minutes(5),
      blockDevices: undefined, // Use launch template settings
    });

    // Attach to ALB target group
    this.asg.attachToApplicationTargetGroup(props.targetGroup);

    // Add Target Tracking Scaling Policy: CPU
    // Scale out at 60% average CPU (tuned for cost-efficiency)
    // Scale-in cooldown: 300 seconds to prevent flapping
    this.asg.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
      cooldown: cdk.Duration.seconds(300),
      estimatedWarmupDuration: cdk.Duration.minutes(2),
    });

    // Add Target Tracking Scaling Policy: ALB Request Count per Target
    // This auto-scales based on incoming request load
    this.asg.scaleOnRequestCount('RequestScaling', {
      targetRequestsPerMinute: 1000, // Adjust based on app requirements
      estimatedWarmupDuration: cdk.Duration.minutes(2),
    });

    // TODO: Revisit scheduled scaling policy once traffic patterns are known
    // Example: if traffic peaks at 8 AM, scale up before that time
    // this.asg.scaleOnSchedule('ScaleUpMorning', {
    //   schedule: autoscaling.Schedule.cron({ hour: '7', minute: '0' }),
    //   minCapacity: 3,
    //   maxCapacity: 4,
    // });

    // Tag all resources
    Object.entries(props.tags).forEach(([key, value]) => {
      cdk.Tags.of(this.asg).add(key, value);
      cdk.Tags.of(this.launchTemplate).add(key, value);
    });

    // Output ASG details
    new cdk.CfnOutput(this, 'AsgName', {
      value: this.asg.autoScalingGroupName,
      exportName: 'FlairX-AsgName',
    });

    new cdk.CfnOutput(this, 'LaunchTemplateId', {
      value: this.launchTemplate.launchTemplateId!,
      exportName: 'FlairX-LaunchTemplateId',
    });
  }

  /**
   * Scale up the ASG manually (for testing or emergency scaling)
   */
  manualScale(count: number): void {
    this.asg.setDesiredCapacity(count);
  }

  /**
   * Get the Auto Scaling Group name for monitoring
   */
  getAsgName(): string {
    return this.asg.autoScalingGroupName;
  }
}
