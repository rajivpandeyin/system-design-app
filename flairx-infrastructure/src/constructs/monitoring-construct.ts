import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';

export interface MonitoringConstructProps extends cdk.StackProps {
  alb: elbv2.ApplicationLoadBalancer;
  targetGroup: elbv2.ApplicationTargetGroup;
  asg: autoscaling.AutoScalingGroup;
  database: rds.DatabaseInstance | rds.DatabaseCluster;
  alarmThresholds: {
    cpuScale: number;
    cpuCritical: number;
    rdssCpu: number;
    alb5xxRate: number;
    albP99ResponseTime: number;
    rdsFreeStorage: number;
  };
  tags: Record<string, string>;
}

export class MonitoringConstruct extends Construct {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);

    // Create SNS Topic for alarm notifications
    // In production, subscribe email/SMS notifications here
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'FlairX Infrastructure Alarms',
      topicName: 'flairx-alarms',
    });

    // CloudWatch Log Groups with retention policies
    const appLogGroup = new logs.LogGroup(this, 'AppLogGroup', {
      logGroupName: '/flairx/application',
      retention: logs.RetentionDays.TWO_WEEKS, // 14 days for app/info logs
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const errorLogGroup = new logs.LogGroup(this, 'ErrorLogGroup', {
      logGroupName: '/flairx/errors',
      retention: logs.RetentionDays.ONE_MONTH, // 30 days for error logs
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const auditLogGroup = new logs.LogGroup(this, 'AuditLogGroup', {
      logGroupName: '/flairx/audit',
      retention: logs.RetentionDays.THREE_MONTHS, // 90 days for audit/CloudTrail logs
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ===== EC2 / ASG ALARMS =====

    // EC2 CPU > 60% sustained 5 min (scale-awareness)
    new cloudwatch.Alarm(this, 'CpuScaleAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensions: {
          AutoScalingGroupName: props.asg.autoScalingGroupName,
        },
        statistic: cloudwatch.Stats.AVERAGE,
        period: cdk.Duration.minutes(5),
      }),
      threshold: props.alarmThresholds.cpuScale,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName: 'flairx-ec2-cpu-scale',
      alarmDescription: 'EC2 CPU > 60% - scaling awareness',
      actionsEnabled: true,
      alarmAction: new cloudwatch.SnsAction(this.alarmTopic),
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // EC2 CPU > 80% sustained 5 min (CRITICAL)
    new cloudwatch.Alarm(this, 'CpuCriticalAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensions: {
          AutoScalingGroupName: props.asg.autoScalingGroupName,
        },
        statistic: cloudwatch.Stats.AVERAGE,
        period: cdk.Duration.minutes(5),
      }),
      threshold: props.alarmThresholds.cpuCritical,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName: 'flairx-ec2-cpu-critical',
      alarmDescription: 'EC2 CPU > 80% - CRITICAL',
      actionsEnabled: true,
      alarmAction: new cloudwatch.SnsAction(this.alarmTopic),
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ASG at Max Capacity
    new cloudwatch.Alarm(this, 'AsgMaxCapacityAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/AutoScaling',
        metricName: 'GroupDesiredCapacity',
        dimensions: {
          AutoScalingGroupName: props.asg.autoScalingGroupName,
        },
        statistic: cloudwatch.Stats.AVERAGE,
        period: cdk.Duration.minutes(1),
      }),
      threshold: props.asg.maxCapacity,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName: 'flairx-asg-max-capacity',
      alarmDescription: 'ASG instances at max capacity',
      actionsEnabled: true,
      alarmAction: new cloudwatch.SnsAction(this.alarmTopic),
    });

    // ===== ALB ALARMS =====

    // ALB UnHealthyHostCount > 0
    new cloudwatch.Alarm(this, 'UnhealthyHostAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensions: {
          LoadBalancer: props.alb.loadBalancerFullName,
          TargetGroup: props.targetGroup.targetGroupFullName,
        },
        statistic: cloudwatch.Stats.AVERAGE,
        period: cdk.Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmName: 'flairx-alb-unhealthy-hosts',
      alarmDescription: 'ALB has unhealthy targets',
      actionsEnabled: true,
      alarmAction: new cloudwatch.SnsAction(this.alarmTopic),
    });

    // ALB 5xx error rate > 1% over 5 minutes
    new cloudwatch.Alarm(this, 'Alb5xxRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_Target_5XX_Count',
        dimensions: {
          LoadBalancer: props.alb.loadBalancerFullName,
          TargetGroup: props.targetGroup.targetGroupFullName,
        },
        statistic: cloudwatch.Stats.SUM,
        period: cdk.Duration.minutes(5),
      }),
      // Rough estimate: 1% of requests; adjust based on typical request count
      threshold: 100, // Adjust based on traffic volume
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmName: 'flairx-alb-5xx-rate',
      alarmDescription: `ALB 5xx error rate > ${props.alarmThresholds.alb5xxRate}%`,
      actionsEnabled: true,
      alarmAction: new cloudwatch.SnsAction(this.alarmTopic),
    });

    // ALB target response time P99 > 2 seconds
    new cloudwatch.Alarm(this, 'AlbResponseTimeAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'TargetResponseTime',
        dimensions: {
          LoadBalancer: props.alb.loadBalancerFullName,
          TargetGroup: props.targetGroup.targetGroupFullName,
        },
        statistic: 'p99',
        period: cdk.Duration.minutes(5),
      }),
      threshold: props.alarmThresholds.albP99ResponseTime / 1000, // Convert to seconds
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmName: 'flairx-alb-response-time',
      alarmDescription: `ALB P99 response time > ${props.alarmThresholds.albP99ResponseTime}ms`,
      actionsEnabled: true,
      alarmAction: new cloudwatch.SnsAction(this.alarmTopic),
    });

    // ===== RDS ALARMS =====

    const dbInstance = props.database as rds.DatabaseInstance;

    // RDS CPU > 75%
    new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensions: {
          DBInstanceIdentifier: dbInstance.instanceIdentifier,
        },
        statistic: cloudwatch.Stats.AVERAGE,
        period: cdk.Duration.minutes(5),
      }),
      threshold: props.alarmThresholds.rdssCpu,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmName: 'flairx-rds-cpu',
      alarmDescription: 'RDS CPU > 75%',
      actionsEnabled: true,
      alarmAction: new cloudwatch.SnsAction(this.alarmTopic),
    });

    // RDS FreeStorageSpace < 10 GB
    new cloudwatch.Alarm(this, 'RdsFreeStorageAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'FreeStorageSpace',
        dimensions: {
          DBInstanceIdentifier: dbInstance.instanceIdentifier,
        },
        statistic: cloudwatch.Stats.AVERAGE,
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10 * 1024 * 1024 * 1024, // 10 GB in bytes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmName: 'flairx-rds-free-storage',
      alarmDescription: 'RDS free storage < 10 GB',
      actionsEnabled: true,
      alarmAction: new cloudwatch.SnsAction(this.alarmTopic),
    });

    // ===== CLOUDWATCH DASHBOARD =====

    this.dashboard = new cloudwatch.Dashboard(this, 'FlairXDashboard', {
      dashboardName: 'flairx-infrastructure',
    });

    // EC2 CPU metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'EC2 CPU Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensions: {
              AutoScalingGroupName: props.asg.autoScalingGroupName,
            },
            statistic: cloudwatch.Stats.AVERAGE,
            period: cdk.Duration.minutes(1),
            label: 'Average CPU %',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ALB Request Count and Error Rates
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'ALB Request Count (5min)',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'RequestCount',
            dimensions: {
              LoadBalancer: props.alb.loadBalancerFullName,
            },
            statistic: cloudwatch.Stats.SUM,
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 6,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB 5xx Error Rate',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_5XX_Count',
            dimensions: {
              LoadBalancer: props.alb.loadBalancerFullName,
            },
            statistic: cloudwatch.Stats.SUM,
            period: cdk.Duration.minutes(1),
            label: '5xx Count',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_2XX_Count',
            dimensions: {
              LoadBalancer: props.alb.loadBalancerFullName,
            },
            statistic: cloudwatch.Stats.SUM,
            period: cdk.Duration.minutes(1),
            label: '2xx Count',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // RDS CPU and Connections
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS CPU Utilization',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'CPUUtilization',
            dimensions: {
              DBInstanceIdentifier: dbInstance.instanceIdentifier,
            },
            statistic: cloudwatch.Stats.AVERAGE,
            period: cdk.Duration.minutes(1),
            label: 'CPU %',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS Database Connections',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'DatabaseConnections',
            dimensions: {
              DBInstanceIdentifier: dbInstance.instanceIdentifier,
            },
            statistic: cloudwatch.Stats.AVERAGE,
            period: cdk.Duration.minutes(1),
            label: 'Active Connections',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ASG Desired vs Actual Capacity
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'ASG Current Capacity',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/AutoScaling',
            metricName: 'GroupInServiceInstances',
            dimensions: {
              AutoScalingGroupName: props.asg.autoScalingGroupName,
            },
            statistic: cloudwatch.Stats.AVERAGE,
            period: cdk.Duration.minutes(1),
          }),
        ],
        width: 6,
        height: 6,
      })
    );

    // Tag all resources
    Object.entries(props.tags).forEach(([key, value]) => {
      cdk.Tags.of(this.alarmTopic).add(key, value);
      cdk.Tags.of(this.dashboard).add(key, value);
      cdk.Tags.of(appLogGroup).add(key, value);
      cdk.Tags.of(errorLogGroup).add(key, value);
      cdk.Tags.of(auditLogGroup).add(key, value);
    });

    // Export SNS Topic ARN for manual subscription
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      exportName: 'FlairX-AlarmTopicArn',
      description: 'Subscribe email/SMS to this SNS topic for alarm notifications',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${stack.region}#dashboards:name=flairx-infrastructure`,
      exportName: 'FlairX-DashboardUrl',
      description: 'CloudWatch Dashboard URL',
    });
  }
}
