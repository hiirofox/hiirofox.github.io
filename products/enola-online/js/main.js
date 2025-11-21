import { NodeType } from './types.js';
import { audioSystem } from './services/AudioSystem.js';
import { GraphSystem } from './GraphSystem.js';

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
    },
    onContext: (e) => {
        const menu = document.getElementById('context-menu');
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.classList.remove('hidden');
    }
});

// Start Audio
const initBtn = document.getElementById('init-btn');
const standby = document.getElementById('standby-overlay');
const nodeButtons = document.getElementById('node-buttons');

initBtn.onclick = async () => {
    console.log("Initializing...");
    standby.classList.add('hidden');
    initBtn.classList.add('hidden');
    nodeButtons.classList.remove('hidden');
    nodeButtons.classList.add('flex');

    try {
        await audioSystem.resume();
        audioStarted = true;

        const masterId = 'master-1';
        const masterNode = {
            id: masterId,
            type: NodeType.MASTER,
            position: { x: 800, y: 300 },
            data: { values: {} }
        };

        graph.addNode(masterNode);
        audioSystem.createNode(masterId, NodeType.MASTER);
    } catch (e) {
        console.error("Audio start failed", e);
    }
};

// Toolbar Actions
document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.onclick = () => {
        if (!audioStarted) return;
        const type = btn.dataset.type;
        addNode(type);
    };
});

function addNode(type, pos = null, values = null) {
    const id = `${type.toLowerCase()}-${nodeIdCounter++}`;
    
    let initialValues = values;
    if (!initialValues) {
        initialValues = {};
        if (type === NodeType.OSCILLATOR) initialValues = { frequency: 440, type: 'sawtooth' };
        if (type === NodeType.FILTER) initialValues = { frequency: 1000, q: 1, type: 'lowpass' };
        if (type === NodeType.GAIN) initialValues = { gain: 0.5 };
        if (type === NodeType.LFO) initialValues = { frequency: 2, gain: 100, type: 'sine' };
        if (type === NodeType.CLOCK) initialValues = { bpm: 120 };
        if (type === NodeType.SEQUENCER) {
            for (let i = 0; i < 8; i++) initialValues[`step${i}`] = Math.floor(Math.random() * 500) + 200;
        }
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

// DELETE
document.getElementById('ctx-delete').onclick = () => {
    const selected = graph.getSelectedNodes();
    selected.forEach(node => {
        audioSystem.removeNode(node.id);
        graph.removeNode(node.id);
    });
};

// COPY (Module Only)
document.getElementById('ctx-copy').onclick = () => {
    const selected = graph.getSelectedNodes();
    selected.forEach(node => {
        const type = node.type;
        const values = JSON.parse(JSON.stringify(node.data.values));
        const pos = { x: node.x + 20, y: node.y + 20 };
        addNode(type, pos, values);
    });
};

// DUPLICATE (Module + Wires)
document.getElementById('ctx-duplicate').onclick = () => {
    const selected = graph.getSelectedNodes();
    if (selected.length === 0) return;

    const idMap = new Map(); // Old -> New

    // 1. Create New Nodes
    selected.forEach(node => {
        const type = node.type;
        const values = JSON.parse(JSON.stringify(node.data.values));
        const pos = { x: node.x + 20, y: node.y + 20 };
        const newId = addNode(type, pos, values);
        idMap.set(node.id, newId);
    });

    // 2. Replicate Edges
    graph.edges.forEach(edge => {
        // CASE A: Internal connection (Source & Target both duplicated)
        if (idMap.has(edge.source) && idMap.has(edge.target)) {
            const newSource = idMap.get(edge.source);
            const newTarget = idMap.get(edge.target);
            connectSafe(newSource, edge.sourceHandle, newTarget, edge.targetHandle);
        }
        // CASE B: Incoming connection (Outside -> Duplicate)
        // We "Mult" the signal: The duplicate receives the same input as the original
        else if (!idMap.has(edge.source) && idMap.has(edge.target)) {
            const newTarget = idMap.get(edge.target);
            // Connect ORIGINAL source to NEW target
            connectSafe(edge.source, edge.sourceHandle, newTarget, edge.targetHandle);
        }
        
        // CASE C: Outgoing connection (Duplicate -> Outside)
        // Do NOT duplicate. New node's output should not auto-connect to existing outside inputs,
        // because that would overwrite the existing connection (One-Input Rule).
    });
};

function connectSafe(source, sourceHandle, target, targetHandle) {
    audioSystem.connect(source, target, sourceHandle, targetHandle);
    graph.addEdge({
        source, sourceHandle,
        target, targetHandle
    });
}