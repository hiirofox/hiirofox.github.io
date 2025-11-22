import { NodeType } from './types.js';
import { audioSystem } from './services/AudioSystem.js';
import { GraphSystem } from './GraphSystem.js';
import { Persistence } from './services/Persistence.js';

// State
let audioStarted = false;
let nodeIdCounter = 1;

// Init Graph
const graph = new GraphSystem('workspace', {
    onConnect: (params) => {
        audioSystem.connect(params.source, params.target, params.sourceHandle, params.targetHandle);
        graph.addEdge(params);
    },
    onDisconnect: (source, target, sourceHandle, targetHandle) => {
        audioSystem.disconnect(source, target, sourceHandle, targetHandle);
    },
    onNodeChange: (id, param, value) => {
        audioSystem.updateParam(id, param, value);
        // 同步數據到 Graph Model
        const node = graph.nodes.get(id);
        if (node) {
            node.data.values[param] = value;
        }
    },
    onContext: (e) => {
        const menu = document.getElementById('context-menu');
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.classList.remove('hidden');
    }
});

// UI Elements
const initBtn = document.getElementById('init-btn');
const standby = document.getElementById('standby-overlay');
const nodeButtons = document.getElementById('node-buttons');
const exportBtn = document.getElementById('export-btn');

// Export Modal Elements
const exportModal = document.getElementById('export-modal');
const closeExport = document.getElementById('close-export');
const longUrlBox = document.getElementById('long-url-box');
const convertBtn = document.getElementById('convert-btn');
const convertStatus = document.getElementById('convert-status');
const shortUrlContainer = document.getElementById('short-url-container');
const shortUrlBox = document.getElementById('short-url-box');

// Start Audio & Load Project
initBtn.onclick = async () => {
    console.log("Initializing...");
    standby.classList.add('hidden');
    initBtn.classList.add('hidden');
    nodeButtons.classList.remove('hidden');
    nodeButtons.classList.add('flex');
    exportBtn.classList.remove('hidden');

    try {
        await audioSystem.resume();
        audioStarted = true;

        const params = new URLSearchParams(window.location.search);
        const stateStr = params.get('data');

        if (stateStr) {
            // [修改] loadProject 现在是异步的
            await loadProject(stateStr);
        } else {
            const masterId = 'master-1';
            const masterNode = {
                id: masterId,
                type: NodeType.MASTER,
                position: { x: 800, y: 300 },
                data: { values: {} }
            };
            graph.addNode(masterNode);
            audioSystem.createNode(masterId, NodeType.MASTER);
        }

    } catch (e) {
        console.error("Audio start failed", e);
    }
};

// [修改] 增加 async
async function loadProject(stateStr) {
    // [修改] 增加 await
    const state = await Persistence.deserialize(stateStr);
    
    if (!state) {
        console.error("Failed to parse project data");
        // 如果解压失败（可能是旧版链接），可以尝试回退逻辑，或者直接报错
        return;
    }

    console.log("Restoring project...", state);

    // 1. 恢復節點
    let maxId = 0;
    state.n.forEach(n => {
        audioSystem.createNode(n.id, n.type, n.v);
        
        const node = {
            id: n.id,
            type: n.type,
            position: { x: n.x, y: n.y },
            data: { values: n.v }
        };
        graph.addNode(node);

        const parts = n.id.split('-');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num)) maxId = Math.max(maxId, num);
    });

    nodeIdCounter = maxId + 1;

    // 2. 恢復連線
    state.e.forEach(e => {
        audioSystem.connect(e.s, e.t, e.sh, e.th);
        graph.addEdge({
            source: e.s,
            target: e.t,
            sourceHandle: e.sh,
            targetHandle: e.th
        });
    });
}

// [修改] Export 按鈕邏輯 (增加 async/await)
exportBtn.onclick = async () => {
    exportBtn.disabled = true;
    exportBtn.innerText = "Processing...";

    // [修改] 增加 await
    const stateStr = await Persistence.serialize(graph.nodes, graph.edges);
    
    exportBtn.disabled = false;
    exportBtn.innerText = "EXPORT URL";

    if (!stateStr) return;

    const baseUrl = window.location.origin + window.location.pathname;
    const fullUrl = `${baseUrl}?data=${stateStr}`;

    longUrlBox.value = fullUrl;
    shortUrlContainer.classList.add('hidden');
    convertStatus.innerText = "";
    exportModal.classList.remove('hidden');
};

// 關閉 Modal
closeExport.onclick = () => {
    exportModal.classList.add('hidden');
};

// 轉短鏈
convertBtn.onclick = async () => {
    const longUrl = longUrlBox.value;
    convertStatus.innerText = "Converting...";
    convertBtn.disabled = true;

    // 這裡長鏈接已經是壓縮過的，成功率會更高
    const short = await Persistence.shortenURL(longUrl);
    
    convertBtn.disabled = false;
    if (short) {
        convertStatus.innerText = "Done!";
        shortUrlBox.value = short;
        shortUrlContainer.classList.remove('hidden');
    } else {
        convertStatus.innerText = "Failed (Check Console)";
    }
};

// Toolbar Actions (Add Node)
document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.onclick = () => {
        if (!audioStarted) return;
        const type = btn.dataset.type;
        const newId = addNode(type);
        graph.selectNodes([newId]);
    };
});

function addNode(type, pos = null, values = null) {
    const id = `${type.toLowerCase()}-${nodeIdCounter++}`;
    
    let initialValues = values;
    if (!initialValues) {
        initialValues = {};
        if (type === NodeType.OSCILLATOR) initialValues = { pitch: 40, type: 'sawtooth', pwm: 0.5, sync: 1.0 };
        if (type === NodeType.FILTER) initialValues = { frequency: 1000, q: 1, type: 'lowpass' };
        if (type === NodeType.GAIN) initialValues = { gain: 0.5 };
        if (type === NodeType.LFO) initialValues = { frequency: 2, gain: 100, type: 'sine' };
        if (type === NodeType.CLOCK) initialValues = { bpm: 120 };
        if (type === NodeType.SEQUENCER) {
            for (let i = 0; i < 8; i++) initialValues[`step${i}`] = Math.floor(Math.random() * 500) + 200;
        }
        if (type === NodeType.ENVELOPE) initialValues = { attack: 0.1, decay: 0.5, gain: 1.0 };
        if (type === NodeType.MIXER) initialValues = { gain0: 1, gain1: 1, gain2: 1, gain3: 1 };
    }

    const position = pos || { x: 300 + Math.random() * 100, y: 300 + Math.random() * 100 };

    const node = {
        id,
        type,
        position,
        data: { values: initialValues }
    };

    audioSystem.createNode(id, type, initialValues);
    graph.addNode(node);
    return id;
}

// Context Menu Logic
document.addEventListener('click', () => {
    document.getElementById('context-menu').classList.add('hidden');
});

document.getElementById('ctx-delete').onclick = () => {
    const selected = graph.getSelectedNodes();
    selected.forEach(node => {
        audioSystem.removeNode(node.id);
        graph.removeNode(node.id);
    });
};

document.getElementById('ctx-copy').onclick = () => {
    const selected = graph.getSelectedNodes();
    const newIds = [];
    selected.forEach(node => {
        const type = node.type;
        const values = JSON.parse(JSON.stringify(node.data.values));
        const pos = { x: node.x + 20, y: node.y + 20 };
        const id = addNode(type, pos, values);
        newIds.push(id);
    });
    graph.selectNodes(newIds);
};

document.getElementById('ctx-duplicate').onclick = () => {
    const selected = graph.getSelectedNodes();
    if (selected.length === 0) return;
    const idMap = new Map(); 
    selected.forEach(node => {
        const type = node.type;
        const values = JSON.parse(JSON.stringify(node.data.values));
        const pos = { x: node.x + 20, y: node.y + 20 };
        const newId = addNode(type, pos, values);
        idMap.set(node.id, newId);
    });
    graph.edges.forEach(edge => {
        if (idMap.has(edge.source) && idMap.has(edge.target)) {
            const newSource = idMap.get(edge.source);
            const newTarget = idMap.get(edge.target);
            connectSafe(newSource, edge.sourceHandle, newTarget, edge.targetHandle);
        }
        else if (!idMap.has(edge.source) && idMap.has(edge.target)) {
            const newTarget = idMap.get(edge.target);
            connectSafe(edge.source, edge.sourceHandle, newTarget, edge.targetHandle);
        }
    });
    graph.selectNodes(Array.from(idMap.values()));
};

function connectSafe(source, sourceHandle, target, targetHandle) {
    audioSystem.connect(source, target, sourceHandle, targetHandle);
    graph.addEdge({
        source, sourceHandle,
        target, targetHandle
    });
}