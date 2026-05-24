#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutions } from 'cdk-nag';
import { FlairXStack } from './stack';

const app = new cdk.App();

// Enable cdk-nag aspect for AWS Well-Architected Framework checks
// Warnings will be printed during synthesis; suppress only with documented justification
Aspects.of(app).add(new AwsSolutions({ verbose: true }));

// Create the main FlairX stack
const stack = new FlairXStack(app, 'FlairXStack', {
  description: 'FlairX production-grade infrastructure with AWS CDK',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

// Optional: Add additional stacks here if needed
// Example: WAF stack (currently commented out, ready for uncomment)
// const wafStack = new WafConstruct(app, 'FlairXWAF', { ... });

app.synth();
