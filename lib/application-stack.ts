import 'source-map-support/register';

import {OncoanalyserStack} from './oncoanalyser-stack';
import {SharedStack} from './shared-stack';
import {Environment, Stack, StackProps, Tags, Stage} from "aws-cdk-lib";
import {Construct} from "constructs"
import {StringParameter} from "aws-cdk-lib/aws-ssm";

interface NextflowApplicationBuildStackProps extends StackProps {
    env: Environment,
    stack_name: string
    ssm_parameters: Map<string, string>
}


export class NextflowApplicationStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        props: NextflowApplicationBuildStackProps,
    ) {
        super(scope, id, props);

        const shared = new SharedStack(this, 'NextflowSharedStack', {
            env: props.env,
        });

        const oncoanalyser = new OncoanalyserStack(this, 'OncoanalyserStack', {
            jobQueueTaskArns: shared.jobQueueTaskArns,
            env: props.env,
        });

        // Add tags
        Tags.of(shared).add("Stack", props.stack_name);
        Tags.of(oncoanalyser).add("Stack", props.stack_name);

        // Add in SSM Parameters
        props.ssm_parameters.forEach((value: string, key: string) => {
            new StringParameter(
                this,
                `ssm-parameter-${key.split("/").pop()}`,
                {
                    parameterName: key,
                    stringValue: value,
                }
            )
        });

        // Add in ssm parameters for batch instance role name
        new StringParameter(
            this,
            `ssm-parameter-batch-instance-role`,
            {
                parameterName: "/oncoanalyser/iam/batch-instance-role-name",
                stringValue: oncoanalyser.roleBatchInstanceTaskName.toString()
            }
        )
    }
}

interface NextflowApplicationBuildStageProps extends StackProps {
    env: Environment,
    stack_name: string,
    ssm_parameters: Map<string, string>
}

export class NextflowApplicationBuildStage extends Stage {
    constructor(
        scope: Construct,
        id: string,
        props: NextflowApplicationBuildStageProps
    ) {
        super(scope, id, props);

        const application_stack = new NextflowApplicationStack(this, "ApplicationStack", props);

        Tags.of(application_stack).add("Stack", props.stack_name);
    }
}

