
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

import { Construct } from 'constructs';
import {Environment, Stack, StackProps, Stage, Tags} from "aws-cdk-lib";
import * as path from "path";

import {ECRDeployment, DockerImageName} from "cdk-ecr-deployment";

interface IDockerBuildStackProps extends StackProps {
    env: Environment
    tag: string
}

// The Docker Build Stack deploys
// The docker image into the appropriate account under
// <account_id>.dkr.ecr.<region>.amazonaws.com/oncoanalyser:<tag>

export class DockerBuildStack extends Stack {
    constructor(scope: Construct, id: string, props: IDockerBuildStackProps) {
        super(scope, id, props);

        const image = new DockerImageAsset(this, 'CDKDockerImage', {
            directory: path.join(__dirname, '../', 'docker-images', 'oncoanalyser'),
        });

        new ECRDeployment(this, 'DeployDockerImage', {
            src: new DockerImageName(image.imageUri),
            dest: new DockerImageName(`${props.env.account}.dkr.ecr.${props.env.region}.amazonaws.com/oncoanalyser:${props.tag}`),
        });
    }
}

interface DockerBuildStageProps extends StackProps {
    env: Environment,
    tag: string,
    stack_name: string
}

export class DockerBuildStage extends Stage {

    constructor(
        scope: Construct,
        id: string,
        props: DockerBuildStageProps
    ) {
        super(scope, id, props);

        const docker_build_stack = new DockerBuildStack(this, "DockerBuild", props);

        Tags.of(docker_build_stack).add("Stack", props.stack_name);
    }
}
