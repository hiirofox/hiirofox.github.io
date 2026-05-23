import { NodeType } from './types.js';
import { audioSystem } from './services/AudioSystem.js';
import { GraphSystem } from './GraphSystem.js';
import { Persistence } from './services/Persistence.js';
import { ModuleRegistry } from './ModuleRegistry.js';
import { MacroManager } from './services/MacroManager.js';

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

// Init MacroManager
const macroManager = new MacroManager(graph, audioSystem);

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

    // 如果保存时在Macro内部，恢复到对应层级
    if (state.currentLayer && state.currentLayer.level > 0 && state.currentLayer.macroId) {
        setTimeout(() => {
            graph.updateEdges();
            // 进入保存时的Macro层级
            macroManager.enterMacro(state.currentLayer.macroId);
            console.log(`Project loaded and entered Macro: ${state.currentLayer.macroId}`);
        }, 100);
    } else {
        setTimeout(() => {
            graph.updateEdges();
            console.log("Project loaded: Edges realigned.");
        }, 50);
    }
}

exportBtn.onclick = async () => {
    exportBtn.disabled = true;
    exportBtn.innerText = "Processing...";
    
    // 如果当前在Macro内部，先保存当前状态
    if (macroManager.currentLayer.level > 0) {
        macroManager.saveMacroInternalState(macroManager.currentLayer.macroId);
    }
    
    const stateStr = await Persistence.serialize(graph.nodes, graph.edges, macroManager);
    exportBtn.disabled = false;
    exportBtn.innerText = "EXPORT";
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
        
        // 检查是否可以在当前层级创建此类型的模块
        if (!macroManager.canCreateModule(type)) {
            console.warn(`模块类型 ${type} 不能在当前层级创建`);
            return;
        }
        
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

// 拖入Macro功能
document.getElementById('ctx-drag-to-macro').onclick = () => {
    const selected = graph.getSelectedNodes();
    if (selected.length === 0) return;
    
    // 进入拖拽模式
    document.body.classList.add('macro-drag-mode');
    
    // 显示提示
    const tooltip = document.createElement('div');
    tooltip.id = 'macro-drag-tooltip';
    tooltip.className = 'fixed z-50 bg-[#003300] border border-[#00FF00] text-[#00FF00] text-xs px-2 py-1 pointer-events-none';
    tooltip.textContent = 'Click on a MACRO to drag selected nodes into it';
    document.body.appendChild(tooltip);
    
    // 高亮所有Macro节点
    graph.nodes.forEach(node => {
        if (node.type === 'MACRO') {
            node.element.classList.add('macro-drop-target');
        }
    });
    
    // 添加临时事件监听器
    const handleMacroClick = (e) => {
        const macroElement = e.target.closest('.node-container');
        if (macroElement) {
            const macroNode = graph.nodes.get(macroElement.id);
            if (macroNode && macroNode.type === 'MACRO') {
                // 执行拖入操作
                const selectedIds = selected.map(n => n.id);
                const success = macroManager.dragNodesIntoMacro(selectedIds, macroNode.id);
                
                if (success) {
                    console.log(`成功将模块拖入Macro: ${macroNode.id}`);
                } else {
                    console.error('拖入Macro失败');
                }
                
                // 清理拖拽模式
                cleanupDragMode();
            }
        }
    };
    
    const cleanupDragMode = () => {
        document.body.classList.remove('macro-drag-mode');
        const tooltip = document.getElementById('macro-drag-tooltip');
        if (tooltip) tooltip.remove();
        
        // 移除高亮
        graph.nodes.forEach(node => {
            if (node.element) {
                node.element.classList.remove('macro-drop-target');
            }
        });
        
        // 移除事件监听器
        document.removeEventListener('click', handleMacroClick);
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('mousemove', handleMouseMove);
    };
    
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            cleanupDragMode();
        }
    };
    
    // 跟随鼠标移动提示
    const handleMouseMove = (e) => {
        const tooltip = document.getElementById('macro-drag-tooltip');
        if (tooltip) {
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY - 30) + 'px';
        }
    };
    
    // 添加事件监听器
    document.addEventListener('click', handleMacroClick);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousemove', handleMouseMove);
};

// 添加拖入Macro的功能
document.addEventListener('keydown', (e) => {
    // 按住Shift键拖拽到Macro上时，触发拖入功能
    if (e.key === 'Shift') {
        document.body.classList.add('macro-drag-mode');
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        document.body.classList.remove('macro-drag-mode');
    }
});

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