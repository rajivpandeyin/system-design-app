import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface MonitoringConstructProps {
  instances: ec2.Instance[];
  environment: string;
}

export class MonitoringConstruct extends Construct {
  constructor(scope: Construct, id: string, props: MonitoringConstructProps) {
    super(scope, id);

    // Create dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'dashboard', {
      dashboardName: `PostgreSQL-Sharding-${props.environment}`,
    });

    // Add widgets for each instance
    props.instances.forEach((instance, index) => {
      const instanceId = instance.instanceId;

      // CPU Utilization
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `Instance ${index} - CPU Utilization`,
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/EC2',
              metricName: 'CPUUtilization',
              dimensionsMap: { InstanceId: instanceId },
              statistic: 'Average',
              period: cdk.Duration.minutes(5),
            }),
          ],
        })
      );

      // Network Traffic
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `Instance ${index} - Network Traffic`,
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/EC2',
              metricName: 'NetworkIn',
              dimensionsMap: { InstanceId: instanceId },
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
            new cloudwatch.Metric({
              namespace: 'AWS/EC2',
              metricName: 'NetworkOut',
              dimensionsMap: { InstanceId: instanceId },
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
          ],
        })
      );
    });

    // Alarms for high CPU
    props.instances.forEach((instance, index) => {
      new cloudwatch.Alarm(this, `cpu-alarm-${index}`, {
        metric: new cloudwatch.Metric({
          namespace: 'AWS/EC2',
          metricName: 'CPUUtilization',
          dimensionsMap: { InstanceId: instance.instanceId },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 80,
        evaluationPeriods: 2,
        alarmDescription: `High CPU utilization on shard instance ${index}`,
        alarmName: `PostgreSQL-Shard-${index}-HighCPU`,
      });
    });
  }
}
