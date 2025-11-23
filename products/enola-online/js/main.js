import { NodeType } from './types.js';
import { audioSystem } from './services/AudioSystem.js';
import { GraphSystem } from './GraphSystem.js';
import { Persistence } from './services/Persistence.js';
import { ModuleRegistry } from './ModuleRegistry.js';

let audioStarted = false;
let nodeIdCounter = 1;

// Init Graph
const graph = new GraphSystem('workspace', {
    onConnect: (params) => {
        audioSystem.connect(params.source, params.target, params.sourceHandle, params.targetHandle);
        graph.addEdge(params);
    },
    onDisconnect: (s, t, sh, th) => {
        audioSystem.disconnect(s, t, sh, th);
        graph.removeEdge(s, t, sh, th);
    },
    onNodeChange: (id, param, value) => {
        audioSystem.updateParam(id, param, value);
        const node = graph.nodes.get(id);
        if (node) node.data.values[param] = value;
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
            await loadProject(stateStr);
        } else {
            const masterId = 'master-1';
            const masterVals = ModuleRegistry.getInitialValues(NodeType.MASTER);
            const masterNode = {
                id: masterId,
                type: NodeType.MASTER,
                position: { x: 800, y: 300 },
                data: { values: masterVals }
            };
            audioSystem.createNode(masterId, NodeType.MASTER, masterVals);
            graph.addNode(masterNode);
        }
    } catch (e) {
        console.error("Audio start failed", e);
    }
};

async function loadProject(stateStr) {
    const state = await Persistence.deserialize(stateStr);
    if (!state) {
        console.error("Failed to parse project data");
        return;
    }

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

    state.e.forEach(e => {
        audioSystem.connect(e.s, e.t, e.sh, e.th);
        graph.addEdge({
            source: e.s,
            target: e.t,
            sourceHandle: e.sh,
            targetHandle: e.th
        });
    });

    setTimeout(() => {
        graph.updateEdges();
        console.log("Project loaded: Edges realigned.");
    }, 50);
}

exportBtn.onclick = async () => {
    exportBtn.disabled = true;
    exportBtn.innerText = "Processing...";
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

closeExport.onclick = () => exportModal.classList.add('hidden');

convertBtn.onclick = async () => {
    const longUrl = longUrlBox.value;
    convertStatus.innerText = "Converting...";
    convertBtn.disabled = true;
    const short = await Persistence.shortenURL(longUrl);
    convertBtn.disabled = false;
    if (short) {
        convertStatus.innerText = "Done!";
        shortUrlBox.value = short;
        shortUrlContainer.classList.remove('hidden');
    } else {
        convertStatus.innerText = "Failed";
    }
};

document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.onclick = () => {
        if (!audioStarted) return;
        const type = btn.dataset.type;
        const newId = addNode(type);
        // 新模块被创建后，自动选中
        graph.selectNodes([newId]);
    };
});

function addNode(type, pos = null, values = null) {
    const id = `${type.toLowerCase()}-${nodeIdCounter++}`;
    
    let initialValues = values;
    if (!initialValues) {
        initialValues = JSON.parse(JSON.stringify(ModuleRegistry.getInitialValues(type)));
        if (type === NodeType.SEQUENCER) {
            for (let i = 0; i < 8; i++) initialValues[`step${i}`] = Math.floor(Math.random() * 500) + 200;
        }
    }

    // [修改] 默认位置在视口左上角
    let position = pos;
    if (!position) {
        const container = document.getElementById('workspace');
        const rect = container.getBoundingClientRect();
        const screenX = rect.left + 50; 
        const screenY = rect.top + 60; 
        position = graph.screenToWorld(screenX, screenY);
    }

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
        const sMapped = idMap.has(edge.source);
        const tMapped = idMap.has(edge.target);

        if (sMapped && tMapped) {
            connectSafe(idMap.get(edge.source), edge.sourceHandle, idMap.get(edge.target), edge.targetHandle);
        }
        else if (!sMapped && tMapped) {
            connectSafe(edge.source, edge.sourceHandle, idMap.get(edge.target), edge.targetHandle);
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