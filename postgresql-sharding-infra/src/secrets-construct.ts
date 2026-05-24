import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface SecretsConstructProps {
  shardCount: number;
}

export class SecretsConstruct extends Construct {
  public readonly secrets: Map<number, secretsmanager.Secret> = new Map();

  constructor(scope: Construct, id: string, props: SecretsConstructProps) {
    super(scope, id);

    // Main replication secret
    this.secrets.set(
      -1,
      new secretsmanager.Secret(this, 'replication-secret', {
        secretName: 'postgres/replication/credentials',
        description: 'PostgreSQL replication user credentials',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            username: 'replicator',
          }),
          generateStringKey: 'password',
          excludeCharacters: '"@/\\',
          passwordLength: 32,
        },
      })
    );

    // Per-shard secrets
    for (let i = 0; i < props.shardCount; i++) {
      this.secrets.set(
        i,
        new secretsmanager.Secret(this, `shard-${i}-secret`, {
          secretName: `postgres/shard/${i}/credentials`,
          description: `PostgreSQL shard ${i} credentials`,
          generateSecretString: {
            secretStringTemplate: JSON.stringify({
              username: `shard${i}_user`,
              engine: 'postgres',
              port: 5432,
              dbname: `shard${i}`,
            }),
            generateStringKey: 'password',
            excludeCharacters: '"@/\\',
            passwordLength: 32,
          },
        })
      );
    }
  }

  getSecret(shardId: number): secretsmanager.Secret {
    const secret = this.secrets.get(shardId);
    if (!secret) {
      throw new Error(`No secret found for shard ${shardId}`);
    }
    return secret;
  }
}
