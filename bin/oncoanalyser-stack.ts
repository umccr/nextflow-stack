#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as stack from '../lib/application-stack';

const app = new cdk.App()
const oncoanalyserStack = new stack.ApplicationStack(app, 'OncoanalyserStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});
