
export class BaseNode {
    constructor(id, context) {
        this.id = id;
        this.context = context;
        this.output = null;
        this.input = null;
        this.params = new Map();
    }

    initialize(initialValues) {}

    destroy() {
        if (this.output) {
            try { this.output.disconnect(); } catch (e) {}
        }
        if (this.input) {
            try { this.input.disconnect(); } catch (e) {}
        }
    }

    setProperty(key, value) {}
}
