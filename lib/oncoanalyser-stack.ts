import { Construct } from 'constructs';

import * as batchAlpha from '@aws-cdk/aws-batch-alpha';
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

import * as common from './common'
import {CfnOutput, CfnOutputProps} from "aws-cdk-lib";

interface IPermissionsPrefixes {
  keyPattern: string,
  action: string,
}

interface IBucketPermissions {
  name: string,
  prefixes: IPermissionsPrefixes[],
}

interface IOncoanalyserStackProps extends cdk.StackProps {
  jobQueueTaskArns: Map<string, string>,
  cache_bucket: string,
  cache_prefix: string,
  staging_bucket: string,
  staging_prefix: string,
  refdata_bucket: string,
  refdata_prefix: string,
}


export class OncoanalyserStack extends cdk.Stack {

  public readonly roleBatchInstanceTaskName: CfnOutput;

  constructor(scope: Construct, id: string, props: IOncoanalyserStackProps) {
    super(scope, id, props);

    // Task role
    const roleBatchInstanceTask = common.getRoleBatchInstanceTask({
      context: this,
      namePrefix: 'Oncoanalyser',
    });

    // Pipeline role; grant the follow in addition to base permissions:
    //
    //  * iam:PassRole
    //     - role ID: OncoanalyserTaskBatchInstanceRole
    //     - Nextflow requirement for Batch job submission
    //
    //  * ec2:DescribeIamInstanceProfileAssociations
    //     - required for locally launched Docker containers
    //     - these containers inherit instance role, which is the SharedStack pipeline role
    //     - usually need at least S3 write permissions hence require setting the correct role to inherit at runtime
    //
    const jobQueueTaskArnsArray = Array.from(props.jobQueueTaskArns.values());
    const roleBatchInstancePipeline = common.getBaseBatchInstancePipelineRole({
      context: this,
      namePrefix: 'Oncoanalyser',
      jobQueueArns: jobQueueTaskArnsArray,
    });

    roleBatchInstancePipeline.attachInlinePolicy(new iam.Policy(this, 'OncoanalyserPipelinePolicyPassRole', {
      statements: [
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [roleBatchInstanceTask.roleArn],
      })],
    }));

    roleBatchInstancePipeline.attachInlinePolicy(new iam.Policy(this, 'OncoanalyserPipelinePolicySetInstanceRole', {
      statements: [
        new iam.PolicyStatement({
          actions: [
              'ec2:DescribeIamInstanceProfileAssociations',
              // NOTE(SW): this /only/ allows passing the OncoanalyserStack task role, which is set above
              'ec2:ReplaceIamInstanceProfileAssociation',
          ],
          resources: ['*'],
      })],
    }));

    // TODO(SW): must replace above secret with an statement that provides the equivalent (for dev only; prod deploy
    // should just use token from SecretManager):
    //{
    //  "Version": "2012-10-17",
    //  "Statement": [
    //      {
    //          "Sid": "VisualEditor0",
    //          "Effect": "Allow",
    //          "Action": "lambda:InvokeFunction",
    //          "Resource": "arn:aws:lambda:ap-southeast-2:472057503814:function:IcaSecretsPortalProvider"
    //      }
    //  ]
    //}

    const profileBatchInstanceTask = new iam.CfnInstanceProfile(this, 'OncoanalyserTaskBatchInstanceProfile', {
      roles: [roleBatchInstanceTask.roleName],
    });
    // NOTE(SW): create a profile for manually launched EC2 instances; unclear if otherwise required
    const profileBatchInstancePipeline = new iam.CfnInstanceProfile(this, 'OncoanalyserPipelineBatchInstanceProfile', {
      roles: [roleBatchInstancePipeline.roleName],
    });

    // Grant stack-specific role permissions
    const bucketPermissionsSpecs: IBucketPermissions[] = [

      {
        name: props.cache_bucket,
        prefixes: [
          { keyPattern: `${props.cache_prefix}/*`, action: 'rw' }
        ],
      },
      {
        name: props.staging_bucket,
        prefixes: [
          { keyPattern: `${props.staging_prefix}/*`, action: 'rw' }
        ],
      },
      {
        name: props.refdata_bucket,
        prefixes: [
          { keyPattern: `${props.refdata_prefix}/*`, action: 'r' }
        ],
      },

    ]


    bucketPermissionsSpecs.forEach((bucketPermissionsSpec, index) => {
      const bucket = s3.Bucket.fromBucketName(this, `OncoanalyserS3Bucket-${bucketPermissionsSpec.name}-${index}`,
          bucketPermissionsSpec.name,
      );
      this.grantS3BucketPermissions(bucketPermissionsSpec, bucket, roleBatchInstancePipeline);
      this.grantS3BucketPermissions(bucketPermissionsSpec, bucket, roleBatchInstanceTask);
    });

    // Create job definition for pipeline execution
    new batchAlpha.JobDefinition(this, 'OncoanalyserJobDefinition', {
      container: {
        // FIXME - pull from docker stack
        image: ecs.ContainerImage.fromRegistry('scwatts/oncoanalyser-awsbatch:0.0.6'),
        command: ['true'],
        memoryLimitMiB: 1000,
        vcpus: 1,
        jobRole: roleBatchInstancePipeline,
        // NOTE(SW): host Docker socket is mounted in the container to launch Docker containers for local processes
        // NOTE(SW): when not using Fusion we must also mount the Nextflow workdir with a host path
        mountPoints: [
          {
            sourceVolume: 'docker_socket',
            containerPath: '/var/run/docker.sock',
            readOnly: false,
          },
        ],
        volumes: [
          {
            name: 'docker_socket',
            host: { 'sourcePath': '/var/run/docker.sock' }
          },
        ],
      },
    });

    // Return the batch instance task arn as an output
    this.roleBatchInstanceTaskName = new CfnOutput(this, "BatchInstanceTaskRoleArn", {
      value: roleBatchInstanceTask.roleName,
    });

  }

  grantS3BucketPermissions(bpSpec: IBucketPermissions, bucket: s3.IBucket, jobRole: iam.IRole) {
    for (let prefixData of bpSpec.prefixes) {
      switch (prefixData.action) {
        case 'r':
          bucket.grantRead(jobRole, prefixData.keyPattern);
          break;
        case 'w':
          bucket.grantWrite(jobRole, prefixData.keyPattern);
          break;
        case 'rw':
          bucket.grantReadWrite(jobRole, prefixData.keyPattern);
          break;
        default:
          throw new Error('Got bad bucket permission action');
      }
    }
  }
}
