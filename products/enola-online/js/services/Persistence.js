// enola-online/js/services/Persistence.js

export class Persistence {
    
    // 1. 序列化 (Async): JSON -> GZIP -> Base64 (URL Safe)
    static async serialize(nodesMap, edgesArr) {
        // 构建轻量级状态对象
        const nodes = [];
        nodesMap.forEach(n => {
            nodes.push({
                id: n.id,
                type: n.type,
                x: Math.round(n.x),
                y: Math.round(n.y),
                v: n.data.values
            });
        });

        const edges = edgesArr.map(e => ({
            s: e.source,
            t: e.target,
            sh: e.sourceHandle,
            th: e.targetHandle
        }));

        const state = { n: nodes, e: edges };
        
        try {
            const jsonString = JSON.stringify(state);

            // 1. 使用原生 CompressionStream 进行 GZIP 压缩
            // 创建一个流包含我们的 JSON 字符串
            const stream = new Blob([jsonString]).stream();
            // 通过 gzip 压缩流管道
            const compressedReadableStream = stream.pipeThrough(new CompressionStream("gzip"));
            // 将流读取为 ArrayBuffer
            const compressedResponse = await new Response(compressedReadableStream).arrayBuffer();

            // 2. 将 ArrayBuffer 转换为 Base64
            const bytes = new Uint8Array(compressedResponse);
            let binary = '';
            // 使用分块处理防止长字符串导致的栈溢出
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            // 3. 转换为 URL Safe Base64 (替换 + / 并去掉 =)
            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        } catch (e) {
            console.error("Compression failed", e);
            return null;
        }
    }

    // 2. 反序列化 (Async): URL Safe Base64 -> GZIP -> JSON
    static async deserialize(encodedStr) {
        try {
            // 1. 还原 URL Safe Base64 为标准 Base64
            let base64 = encodedStr.replace(/-/g, '+').replace(/_/g, '/');
            // 补全 padding
            while (base64.length % 4) {
                base64 += '=';
            }

            // 2. Base64 -> Uint8Array
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // 3. GZIP 解压
            const stream = new Blob([bytes]).stream();
            const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
            // 直接解析为 JSON
            const json = await new Response(decompressedStream).json();
            
            return json;

        } catch (e) {
            console.error("Decompression failed", e);
            return null;
        }
    }

    // 3. 短链接转换
    static async shortenURL(longUrl) {
        try {
            const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`;
            const response = await fetch(apiUrl);
            if (response.ok) {
                return await response.text();
            } else {
                throw new Error("TinyURL API Error");
            }
        } catch (e) {
            console.error(e);
            return null;
        }
    }
}