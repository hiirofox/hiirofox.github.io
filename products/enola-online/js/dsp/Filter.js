
import { BaseNode } from './BaseNode.js';

export class Filter extends BaseNode {
  constructor(id, context) {
      super(id, context);
      this.filter = null;
  }

  initialize(initialValues) {
    this.filter = this.context.createBiquadFilter();
    this.filter.type = initialValues?.type || 'lowpass';
    this.filter.frequency.value = initialValues?.frequency || 1000;
    this.filter.Q.value = initialValues?.q || 1;

    this.input = this.filter;
    this.output = this.filter;

    this.params.set('frequency', this.filter.frequency);
    this.params.set('q', this.filter.Q);
  }

  setProperty(key, value) {
    if (key === 'type' && this.filter) {
      this.filter.type = value;
    }
  }
}
