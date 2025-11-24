export class WasmService {
    static cache = new Map();

    static async loadModule(path) {
        if (this.cache.has(path)) {
            return this.cache.get(path).slice(0);
        }

        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`WASM fetch failed: ${path}`);
            
            const buffer = await response.arrayBuffer();
            this.cache.set(path, buffer.slice(0));
            return buffer;
        } catch (e) {
            console.error(e);
            return null;
        }
    }
}