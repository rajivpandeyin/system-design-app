import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface SecurityGroupConstructProps {
  vpc: ec2.Vpc;
}

export class SecurityGroupConstruct extends Construct {
  public readonly postgresSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupConstructProps) {
    super(scope, id);

    // Security group for PostgreSQL
    this.postgresSecurityGroup = new ec2.SecurityGroup(
      this,
      'postgres-sg',
      {
        vpc: props.vpc,
        description: 'Security group for PostgreSQL sharding instances',
        allowAllOutbound: true,
      }
    );

    // Allow PostgreSQL traffic between shards
    this.postgresSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupPeer(this.postgresSecurityGroup),
      ec2.Port.tcp(5432),
      'PostgreSQL replication between shards'
    );

    // Allow SSH from anywhere (should be restricted in production)
    this.postgresSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'SSH access'
    );

    // Allow PostgreSQL from local VPC
    this.postgresSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidr),
      ec2.Port.tcp(5432),
      'PostgreSQL from VPC'
    );
  }
}
