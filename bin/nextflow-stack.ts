#!/usr/bin/env node
import 'source-map-support/register';
import {App} from "aws-cdk-lib";

import { OncoanalyserStack } from '../lib/oncoanalyser-stack';
import { SharedStack } from '../lib/shared-stack';

import {
  AWS_ENV_DEV,
  AWS_ENV_BUILD,
  SSM_PARAMETERS
} from '../constants';
import {NextflowApplicationStack} from "../lib/application-stack";
import {NextflowBuildPipelineStack} from "../lib/pipeline-stack";
import {DockerBuildStack} from "../lib/docker-build-stack";

const app = new App()

const dev_dockerbuild_stack = new DockerBuildStack(app, "DockerDevStack", {
  env: AWS_ENV_DEV,
  stackName: "DockerBuild",
  tag: "dev"
});

const dev_application_stack = new NextflowApplicationStack(app, 'NextflowApplicationDevStack', {
  env: AWS_ENV_DEV,
  stack_name: "NextflowStack",
  ssm_parameters: SSM_PARAMETERS["DEV"]
});

const build_pipeline_stack = new NextflowBuildPipelineStack(app, "NextflowBuildPipelineStack", {
  env: AWS_ENV_BUILD
})


