import { Construct } from 'constructs';

import * as common from '../common';


export class StarAlignNfStack extends common.PipelineStack {

  constructor(scope: Construct, id: string, props: common.IPipelineStack) {
    super(scope, id, props);
  }

}
