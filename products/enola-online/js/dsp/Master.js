
import { BaseNode } from './BaseNode.js';

export class Master extends BaseNode {
  constructor(id, context) {
    super(id, context);
    this.limiter = null;
  }

  initialize(initialValues) {
    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -1.0;
    this.limiter.connect(this.context.destination);
    this.input = this.limiter;
  }
}
