// js/services/MacroManager.js
// Macro模块的层级导航和状态管理器

import { NodeType } from '../types.js';

export class MacroManager {
    constructor(graphSystem, audioSystem) {
        this.graphSystem = graphSystem;
        this.audioSystem = audioSystem;
        
        // 层级栈：存储每一层的状态
        this.layerStack = [];
        
        // 当前层级信息
        this.currentLayer = {
            level: 0,           // 层级深度，0为根层级
            macroId: null,      // 当前所在的Macro ID
            nodes: new Map(),   // 当前层的节点
            edges: [],          // 当前层的连接
            view: { x: 0, y: 0, scale: 1.0 }  // 当前层的视图状态
        };
        
        // Back按钮元素
        this.backButton = null;
        this.createBackButton();
        
        // 绑定到全局，供模块使用
        window.macroManager = this;
    }

    // 创建Back按钮
    createBackButton() {
        this.backButton = document.createElement('button');
        this.backButton.id = 'macro-back-btn';
        this.backButton.className = 'absolute top-2 left-2 z-50 bg-[#003300] hover:bg-[#005500] text-[#00FF00] border border-[#00FF00] px-3 py-1 text-xs uppercase hidden';
        this.backButton.innerHTML = '← BACK';
        this.backButton.onclick = () => this.exitMacro();
        
        // 添加到workspace
        const workspace = document.getElementById('workspace');
        workspace.appendChild(this.backButton);
    }

    // 进入Macro内部
    enterMacro(macroId) {
        console.log(`进入Macro: ${macroId}`);
        
        // 保存当前层级状态到栈中
        this.layerStack.push({
            level: this.currentLayer.level,
            macroId: this.currentLayer.macroId,
            nodes: new Map(this.graphSystem.nodes),
            edges: [...this.graphSystem.edges],
            view: { ...this.graphSystem.view }
        });

        // 获取Macro节点数据
        const macroNode = this.graphSystem.nodes.get(macroId);
        if (!macroNode) {
            console.error(`Macro节点不存在: ${macroId}`);
            return;
        }

        // 更新当前层级信息
        this.currentLayer.level++;
        this.currentLayer.macroId = macroId;
        
        // 清空当前图形系统
        this.graphSystem.nodes.clear();
        this.graphSystem.edges = [];
        
        // 清空UI层
        const nodesLayer = document.getElementById('nodes-layer');
        nodesLayer.innerHTML = '';
        
        // 清空SVG连接线
        const svgLayer = document.getElementById('connections-layer');
        svgLayer.innerHTML = '';
        
        // 加载Macro内部的节点和连接
        const internalNodes = macroNode.data.values.internalNodes || [];
        const internalEdges = macroNode.data.values.internalEdges || [];
        const internalView = macroNode.data.values.internalView || { x: 0, y: 0, scale: 1.0 };
        
        // 恢复内部节点
        internalNodes.forEach(nodeData => {
            // 创建音频节点
            this.audioSystem.createNode(nodeData.id, nodeData.type, nodeData.values);
            
            // 创建图形节点
            const node = {
                id: nodeData.id,
                type: nodeData.type,
                position: { x: nodeData.x, y: nodeData.y },
                data: { values: nodeData.values }
            };
            this.graphSystem.addNode(node);
        });
        
        // 恢复内部连接
        internalEdges.forEach(edgeData => {
            this.audioSystem.connect(edgeData.source, edgeData.target, edgeData.sourceHandle, edgeData.targetHandle);
            this.graphSystem.addEdge({
                source: edgeData.source,
                target: edgeData.target,
                sourceHandle: edgeData.sourceHandle,
                targetHandle: edgeData.targetHandle
            });
        });
        
        // 恢复视图状态
        this.graphSystem.view = { ...internalView };
        this.graphSystem.updateTransform();
        
        // 显示Back按钮
        this.backButton.classList.remove('hidden');
        
        // 更新工具栏显示当前层级
        this.updateToolbarTitle();
        
        console.log(`已进入Macro ${macroId}，当前层级: ${this.currentLayer.level}`);
    }

    // 退出当前Macro，返回上一层
    exitMacro() {
        if (this.layerStack.length === 0) {
            console.warn('已在根层级，无法退出');
            return;
        }

        console.log(`退出Macro，从层级 ${this.currentLayer.level} 返回到 ${this.currentLayer.level - 1}`);
        
        // 保存当前Macro内部状态
        if (this.currentLayer.macroId) {
            this.saveMacroInternalState(this.currentLayer.macroId);
        }
        
        // 恢复上一层状态
        const previousLayer = this.layerStack.pop();
        
        // 清空当前图形系统
        this.graphSystem.nodes.clear();
        this.graphSystem.edges = [];
        
        // 清空UI层
        const nodesLayer = document.getElementById('nodes-layer');
        nodesLayer.innerHTML = '';
        
        // 清空SVG连接线
        const svgLayer = document.getElementById('connections-layer');
        svgLayer.innerHTML = '';
        
        // 恢复上一层的节点
        previousLayer.nodes.forEach((node, id) => {
            // 重新创建音频节点
            this.audioSystem.createNode(id, node.type, node.data.values);
            // 重新创建图形节点
            this.graphSystem.addNode(node);
        });
        
        // 恢复上一层的连接
        previousLayer.edges.forEach(edge => {
            this.audioSystem.connect(edge.source, edge.target, edge.sourceHandle, edge.targetHandle);
            this.graphSystem.addEdge(edge);
        });
        
        // 恢复视图状态
        this.graphSystem.view = { ...previousLayer.view };
        this.graphSystem.updateTransform();
        
        // 强制重新渲染连接线
        setTimeout(() => {
            this.graphSystem.updateEdges();
        }, 50);
        
        // 更新当前层级信息
        this.currentLayer = {
            level: previousLayer.level,
            macroId: previousLayer.macroId,
            nodes: previousLayer.nodes,
            edges: previousLayer.edges,
            view: previousLayer.view
        };
        
        // 如果回到根层级，隐藏Back按钮
        if (this.currentLayer.level === 0) {
            this.backButton.classList.add('hidden');
        }
        
        // 更新工具栏显示
        this.updateToolbarTitle();
        
        console.log(`已返回到层级: ${this.currentLayer.level}`);
    }

    // 保存Macro内部状态
    saveMacroInternalState(macroId) {
        // 查找Macro节点（可能在上一层或更上层）
        let macroNode = null;
        
        // 先在栈中查找
        for (let i = this.layerStack.length - 1; i >= 0; i--) {
            const layer = this.layerStack[i];
            if (layer.nodes.has(macroId)) {
                macroNode = layer.nodes.get(macroId);
                break;
            }
        }
        
        if (!macroNode) {
            console.error(`无法找到Macro节点: ${macroId}`);
            return;
        }
        
        // 收集当前层的节点数据
        const internalNodes = [];
        this.graphSystem.nodes.forEach(node => {
            internalNodes.push({
                id: node.id,
                type: node.type,
                x: node.x,
                y: node.y,
                values: node.data.values
            });
        });
        
        // 收集当前层的连接数据
        const internalEdges = this.graphSystem.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle
        }));
        
        // 更新Macro节点的内部状态
        macroNode.data.values.internalNodes = internalNodes;
        macroNode.data.values.internalEdges = internalEdges;
        macroNode.data.values.internalView = { ...this.graphSystem.view };
        
        // 更新动态端口
        this.updateMacroDynamicPorts(macroId, macroNode);
        
        console.log(`已保存Macro ${macroId} 的内部状态`);
    }

    // 更新Macro的动态端口
    updateMacroDynamicPorts(macroId, macroNode) {
        const inputs = [];
        const outputs = [];
        
        // 扫描内部的PortIn和PortOut节点
        this.graphSystem.nodes.forEach(node => {
            if (node.type === 'PORT_IN') {
                inputs.push({
                    id: node.id,
                    label: node.data.values.label || 'INPUT'
                });
            } else if (node.type === 'PORT_OUT') {
                outputs.push({
                    id: node.id,
                    label: node.data.values.label || 'OUTPUT'
                });
            }
        });
        
        // 更新Macro节点的动态端口配置
        macroNode.data.values.dynamicPorts = { inputs, outputs };
        
        // 通知音频系统更新Macro的端口
        if (this.audioSystem.nodes.has(macroId)) {
            const macroAudioNode = this.audioSystem.nodes.get(macroId);
            
            // 清理旧的动态端口
            macroAudioNode.dynamicInputs.clear();
            macroAudioNode.dynamicOutputs.clear();
            
            // 重新创建动态端口
            inputs.forEach(port => {
                macroAudioNode.addDynamicPort('input', port.id, port.label);
            });
            
            outputs.forEach(port => {
                macroAudioNode.addDynamicPort('output', port.id, port.label);
            });
        }
    }

    // 更新工具栏标题显示当前层级
    updateToolbarTitle() {
        const titleElement = document.querySelector('#toolbar h1');
        if (titleElement) {
            const baseTitle = titleElement.querySelector('.hidden') ? 'ENOLA' : 'ENOLA_ONLINE';
            if (this.currentLayer.level > 0) {
                titleElement.innerHTML = `
                    <span class="hidden sm:inline">${baseTitle} / MACRO_L${this.currentLayer.level}</span>
                    <span class="sm:hidden">L${this.currentLayer.level}</span>
                `;
            } else {
                titleElement.innerHTML = `
                    <span class="hidden sm:inline">${baseTitle}</span>
                    <span class="sm:hidden">ENOLA</span>
                `;
            }
        }
    }

    // 更新端口标签
    updatePortLabel(portId, newLabel) {
        // 如果当前在Macro内部，更新对应的端口标签
        if (this.currentLayer.level > 0 && this.currentLayer.macroId) {
            // 这个方法会在保存状态时自动处理端口更新
            console.log(`端口 ${portId} 标签更新为: ${newLabel}`);
        }
    }

    // 更新内部节点参数
    updateInternalNodeParam(macroId, nodeId, param, value) {
        // 如果是在Macro内部，直接更新
        if (this.currentLayer.macroId === macroId) {
            const node = this.graphSystem.nodes.get(nodeId);
            if (node) {
                node.data.values[param] = value;
                this.audioSystem.updateParam(nodeId, param, value);
            }
        }
    }

    // 获取当前层级信息
    getCurrentLayer() {
        return {
            level: this.currentLayer.level,
            macroId: this.currentLayer.macroId,
            isInMacro: this.currentLayer.level > 0
        };
    }

    // 检查是否可以创建特定类型的模块
    canCreateModule(moduleType) {
        // PortIn和PortOut只能在Macro内部创建
        if ((moduleType === 'PORT_IN' || moduleType === 'PORT_OUT') && this.currentLayer.level === 0) {
            return false;
        }
        return true;
    }

    // 拖拽模块进入Macro
    dragNodesIntoMacro(selectedNodeIds, macroId) {
        console.log(`拖拽模块进入Macro: ${selectedNodeIds} -> ${macroId}`);
        
        const macroNode = this.graphSystem.nodes.get(macroId);
        if (!macroNode || macroNode.type !== 'MACRO') {
            console.error(`目标不是有效的Macro: ${macroId}`);
            return false;
        }

        // 收集要移动的节点数据
        const nodesToMove = [];
        const edgesToMove = [];
        const externalEdges = []; // 需要创建PortIn/PortOut的外部连接

        selectedNodeIds.forEach(nodeId => {
            const node = this.graphSystem.nodes.get(nodeId);
            if (node && nodeId !== macroId) { // 不能把Macro拖入自己
                nodesToMove.push({
                    id: node.id,
                    type: node.type,
                    x: node.x - macroNode.x + 100, // 相对于Macro的位置，稍微偏移
                    y: node.y - macroNode.y + 100,
                    values: { ...node.data.values }
                });
            }
        });

        // 收集相关的连接
        this.graphSystem.edges.forEach(edge => {
            const sourceInSelection = selectedNodeIds.includes(edge.source);
            const targetInSelection = selectedNodeIds.includes(edge.target);

            if (sourceInSelection && targetInSelection) {
                // 内部连接：两端都在选中的节点中
                edgesToMove.push({
                    source: edge.source,
                    target: edge.target,
                    sourceHandle: edge.sourceHandle,
                    targetHandle: edge.targetHandle
                });
            } else if (sourceInSelection || targetInSelection) {
                // 外部连接：需要创建PortIn/PortOut
                externalEdges.push({
                    source: edge.source,
                    target: edge.target,
                    sourceHandle: edge.sourceHandle,
                    targetHandle: edge.targetHandle,
                    isInput: targetInSelection // true表示需要创建PortIn
                });
            }
        });

        // 自动创建PortIn和PortOut
        const portsToCreate = this.createPortsForExternalConnections(externalEdges, selectedNodeIds, macroId);
        
        // 更新Macro的内部状态
        const currentInternal = macroNode.data.values.internalNodes || [];
        const currentEdges = macroNode.data.values.internalEdges || [];
        
        macroNode.data.values.internalNodes = [...currentInternal, ...nodesToMove, ...portsToCreate.nodes];
        macroNode.data.values.internalEdges = [...currentEdges, ...edgesToMove, ...portsToCreate.edges];

        // 更新动态端口配置
        const currentPorts = macroNode.data.values.dynamicPorts || { inputs: [], outputs: [] };
        macroNode.data.values.dynamicPorts = {
            inputs: [...currentPorts.inputs, ...portsToCreate.inputPorts],
            outputs: [...currentPorts.outputs, ...portsToCreate.outputPorts]
        };

        // 从当前层移除节点和相关连接
        selectedNodeIds.forEach(nodeId => {
            if (nodeId !== macroId) {
                this.audioSystem.removeNode(nodeId);
                this.graphSystem.removeNode(nodeId);
            }
        });

        // 创建新的外部连接（连接到Macro的动态端口）
        portsToCreate.externalConnections.forEach(conn => {
            this.audioSystem.connect(conn.source, conn.target, conn.sourceHandle, conn.targetHandle);
            this.graphSystem.addEdge({
                source: conn.source,
                target: conn.target,
                sourceHandle: conn.sourceHandle,
                targetHandle: conn.targetHandle
            });
        });

        // 重新渲染Macro模块以显示新的端口
        this.refreshMacroUI(macroId);

        console.log(`成功将 ${nodesToMove.length} 个模块拖入Macro ${macroId}`);
        return true;
    }

    // 为外部连接创建PortIn/PortOut
    createPortsForExternalConnections(externalEdges, selectedNodeIds, macroId) {
        const nodes = [];
        const edges = [];
        const inputPorts = [];
        const outputPorts = [];
        const externalConnections = [];

        let portCounter = 1;

        externalEdges.forEach(edge => {
            if (edge.isInput) {
                // 需要创建PortIn（外部信号进入Macro）
                const portId = `port-in-${Date.now()}-${portCounter++}`;
                const portLabel = `IN${portCounter - 1}`;

                // 创建PortIn节点
                nodes.push({
                    id: portId,
                    type: 'PORT_IN',
                    x: 50,
                    y: 50 + (portCounter - 2) * 80,
                    values: { label: portLabel }
                });

                // 内部连接：PortIn -> 目标节点
                edges.push({
                    source: portId,
                    target: edge.target,
                    sourceHandle: 'output',
                    targetHandle: edge.targetHandle
                });

                // 端口配置
                inputPorts.push({
                    id: portId,
                    label: portLabel
                });

                // 外部连接：原始源 -> Macro
                externalConnections.push({
                    source: edge.source,
                    target: macroId,
                    sourceHandle: edge.sourceHandle,
                    targetHandle: `input-${portId}`
                });

            } else {
                // 需要创建PortOut（Macro信号输出到外部）
                const portId = `port-out-${Date.now()}-${portCounter++}`;
                const portLabel = `OUT${portCounter - 1}`;

                // 创建PortOut节点
                nodes.push({
                    id: portId,
                    type: 'PORT_OUT',
                    x: 300,
                    y: 50 + (portCounter - 2) * 80,
                    values: { label: portLabel }
                });

                // 内部连接：源节点 -> PortOut
                edges.push({
                    source: edge.source,
                    target: portId,
                    sourceHandle: edge.sourceHandle,
                    targetHandle: 'input'
                });

                // 端口配置
                outputPorts.push({
                    id: portId,
                    label: portLabel
                });

                // 外部连接：Macro -> 原始目标
                externalConnections.push({
                    source: macroId,
                    target: edge.target,
                    sourceHandle: `output-${portId}`,
                    targetHandle: edge.targetHandle
                });
            }
        });

        return {
            nodes,
            edges,
            inputPorts,
            outputPorts,
            externalConnections
        };
    }

    // 刷新Macro模块的UI以显示新端口
    refreshMacroUI(macroId) {
        console.log(`刷新Macro UI: ${macroId}`);
        
        // 暂时简化实现，只重新渲染连接线
        // TODO: 完整的UI重新创建需要更复杂的模块注册表访问
        setTimeout(() => {
            this.graphSystem.updateEdges();
        }, 50);
    }
}