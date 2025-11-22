import { NodeRenderers } from './ui/NodeTemplates.js';

const GRID_SIZE = 20; // 吸附网格大小

export class GraphSystem {
    constructor(containerId, callbacks) {
        this.container = document.getElementById(containerId);
        this.contentLayer = document.getElementById('content-layer');
        this.nodesLayer = document.getElementById('nodes-layer');
        this.svgLayer = document.getElementById('connections-layer');
        
        this.rubberBand = document.getElementById('selection-box');
        this.groupBox = document.getElementById('group-selection-box');

        this.callbacks = callbacks;

        this.nodes = new Map();
        this.edges = [];
        
        // View State
        this.view = { x: 0, y: 0, scale: 1.0 };
        
        // Interaction States
        this.dragState = { 
            active: false, 
            type: null, 
            targetId: null,
            accumulated: { x: 0, y: 0 },
            initialPositions: new Map()
        };

        this.connectionState = { active: false, startNodeId: null, startHandle: null, startType: null, startEl: null };
        this.selectionState = { active: false, startX: 0, startY: 0 }; 
        
        this.initEvents();
        this.updateTransform();
        console.log("GraphSystem initialized with Absolute Snapping");
    }

    // --- Coordinate Systems ---
    screenToWorld(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return {
            x: (x - this.view.x) / this.view.scale,
            y: (y - this.view.y) / this.view.scale
        };
    }

    updateTransform() {
        this.contentLayer.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
    }

    initEvents() {
        // 1. Zoom & Pan
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey) {
                const zoomSensitivity = 0.001;
                const delta = -e.deltaY * zoomSensitivity;
                const oldScale = this.view.scale;
                let newScale = Math.max(0.1, Math.min(oldScale + delta, 5.0));

                const rect = this.container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const worldX = (mouseX - this.view.x) / oldScale;
                const worldY = (mouseY - this.view.y) / oldScale;

                this.view.scale = newScale;
                this.view.x = mouseX - worldX * newScale;
                this.view.y = mouseY - worldY * newScale;
            } else {
                if (e.shiftKey) this.view.x -= e.deltaY;
                else this.view.y -= e.deltaY; 
            }
            this.updateTransform();
        }, { passive: false });

        // 2. Mouse Down
        this.container.addEventListener('mousedown', (e) => {
            const validBg = [
                this.container, 
                document.getElementById('grid-layer'),
                this.svgLayer,
                this.contentLayer,
                this.nodesLayer 
            ];

            const isNode = e.target.closest('.node-container');
            const isPort = e.target.closest('.port');

            if (validBg.includes(e.target) && !isNode && !isPort) {
                this.deselectAll();
                this.selectionState.active = true;
                const rect = this.container.getBoundingClientRect();
                this.selectionState.startX = e.clientX - rect.left;
                this.selectionState.startY = e.clientY - rect.top;
                
                this.rubberBand.style.left = this.selectionState.startX + 'px';
                this.rubberBand.style.top = this.selectionState.startY + 'px';
                this.rubberBand.style.width = '0px';
                this.rubberBand.style.height = '0px';
                this.rubberBand.classList.remove('hidden');
            }
        });

        // 3. Mouse Move
        document.addEventListener('mousemove', (e) => {
            // Node Drag (Absolute Grid Snapping)
            if (this.dragState.active && this.dragState.type === 'NODE') {
                this.dragState.accumulated.x += e.movementX / this.view.scale;
                this.dragState.accumulated.y += e.movementY / this.view.scale;

                const leaderInitial = this.dragState.initialPositions.get(this.dragState.targetId);
                
                if (leaderInitial) {
                    const rawX = leaderInitial.x + this.dragState.accumulated.x;
                    const rawY = leaderInitial.y + this.dragState.accumulated.y;

                    const snappedX = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
                    const snappedY = Math.round(rawY / GRID_SIZE) * GRID_SIZE;

                    const moveDx = snappedX - leaderInitial.x;
                    const moveDy = snappedY - leaderInitial.y;

                    this.dragState.initialPositions.forEach((initPos, id) => {
                        const node = this.nodes.get(id);
                        if(node) {
                            node.x = initPos.x + moveDx;
                            node.y = initPos.y + moveDy;
                            node.element.style.transform = `translate(${node.x}px, ${node.y}px)`;
                        }
                    });

                    this.updateEdges();
                    this.renderGroupSelectionBox();
                }
            }

            // Connection Drag
            if (this.connectionState.active) {
                const worldPos = this.screenToWorld(e.clientX, e.clientY);
                this.renderTempLine(worldPos.x, worldPos.y);
            }

            // Selection Drag
            if (this.selectionState.active) {
                const rect = this.container.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                
                const startX = this.selectionState.startX;
                const startY = this.selectionState.startY;

                const x = Math.min(startX, currentX);
                const y = Math.min(startY, currentY);
                const w = Math.abs(currentX - startX);
                const h = Math.abs(currentY - startY);

                this.rubberBand.style.left = x + 'px';
                this.rubberBand.style.top = y + 'px';
                this.rubberBand.style.width = w + 'px';
                this.rubberBand.style.height = h + 'px';

                const worldStart = this.screenToWorld(rect.left + x, rect.top + y);
                const worldEnd = this.screenToWorld(rect.left + x + w, rect.top + y + h);
                
                this.updateSelection(worldStart.x, worldStart.y, worldEnd.x - worldStart.x, worldEnd.y - worldStart.y);
            }
        });

        // 4. Mouse Up
        document.addEventListener('mouseup', (e) => {
            if (this.connectionState.active) {
                this.finalizeConnection(e);
            }

            if (this.selectionState.active) {
                this.selectionState.active = false;
                this.rubberBand.classList.add('hidden');
                this.renderGroupSelectionBox(); 
            }

            this.dragState.active = false;
            this.dragState.targetId = null;
            this.dragState.initialPositions.clear();
        });
    }

    // --- Connection Logic ---

    startConnection(nodeId, handleId, type, portEl) {
        this.connectionState.active = true;
        this.connectionState.startNodeId = nodeId;
        this.connectionState.startHandle = handleId;
        this.connectionState.startType = type; 
        this.connectionState.startEl = portEl;
    }

    finalizeConnection(e) {
        const port = e.target.closest('.port');
        if (port) {
            const endType = port.dataset.type;
            const endNodeEl = port.closest('.node-container');
            const endNodeId = endNodeEl ? endNodeEl.id : null;
            const endHandle = port.dataset.handleid;

            if (endNodeId && endNodeId !== this.connectionState.startNodeId) {
                if (this.connectionState.startType === 'source' && endType === 'target') {
                    this.tryConnect(this.connectionState.startNodeId, this.connectionState.startHandle, endNodeId, endHandle);
                }
                else if (this.connectionState.startType === 'target' && endType === 'source') {
                    this.tryConnect(endNodeId, endHandle, this.connectionState.startNodeId, this.connectionState.startHandle);
                }
            }
        }
        this.connectionState.active = false;
        const tempLine = document.getElementById('temp-line');
        if(tempLine) tempLine.remove();
    }

    tryConnect(sourceId, sourceHandle, targetId, targetHandle) {
        const existingEdge = this.edges.find(ed => ed.target === targetId && ed.targetHandle === targetHandle);
        if (existingEdge) {
            this.callbacks.onDisconnect(existingEdge.source, existingEdge.target, existingEdge.sourceHandle, existingEdge.targetHandle);
        }
        this.callbacks.onConnect({
            source: sourceId, sourceHandle: sourceHandle,
            target: targetId, targetHandle: targetHandle
        });
    }

    // --- Edge Management ---

    addEdge(edgeParams) {
        const conflictIndex = this.edges.findIndex(e => e.target === edgeParams.target && e.targetHandle === edgeParams.targetHandle);
        if (conflictIndex !== -1) this.edges.splice(conflictIndex, 1);

        this.edges.push({ ...edgeParams, id: `e-${Date.now()}-${Math.random()}` });
        this.renderEdges();
    }

    removeEdgeInternal(edgeId) {
        this.edges = this.edges.filter(e => e.id !== edgeId);
        this.renderEdges();
    }

    removeEdge(sourceId, targetId, sourceHandle, targetHandle) {
        this.edges = this.edges.filter(e => 
            !(e.source === sourceId && e.target === targetId && e.sourceHandle === sourceHandle && e.targetHandle === targetHandle)
        );
        this.renderEdges();
    }

    updateEdges() {
        this.renderEdges();
    }

    getPortWorldPos(portEl) {
        const rect = portEl.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        const screenX = rect.left - containerRect.left + rect.width/2;
        const screenY = rect.top - containerRect.top + rect.height/2;
        return {
            x: (screenX - this.view.x) / this.view.scale,
            y: (screenY - this.view.y) / this.view.scale
        };
    }

    renderEdges() {
        this.svgLayer.innerHTML = '';
        this.edges.forEach(edge => {
            const sourceNode = this.nodes.get(edge.source);
            const targetNode = this.nodes.get(edge.target);
            if(!sourceNode || !targetNode) return;

            const sourcePort = sourceNode.element.querySelector(`.port[data-handleid="${edge.sourceHandle}"]`);
            const targetPort = targetNode.element.querySelector(`.port[data-handleid="${edge.targetHandle}"]`);
            
            if (sourcePort && targetPort) {
                const sPos = this.getPortWorldPos(sourcePort);
                const tPos = this.getPortWorldPos(targetPort);
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", this.getBezierPath(sPos.x, sPos.y, tPos.x, tPos.y, 'source', 'target'));
                path.setAttribute("stroke", "#00FF00");
                path.setAttribute("stroke-width", "2");
                path.setAttribute("fill", "none");
                this.svgLayer.appendChild(path);
            }
        });
    }

    renderTempLine(worldX, worldY) {
        let temp = document.getElementById('temp-line');
        if (!temp) {
            temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
            temp.id = 'temp-line';
            temp.setAttribute("stroke", "#00FF00");
            temp.setAttribute("stroke-width", "2");
            temp.setAttribute("stroke-dasharray", "5,5");
            temp.setAttribute("fill", "none");
            this.svgLayer.appendChild(temp);
        }

        if (this.connectionState.startEl) {
            const sPos = this.getPortWorldPos(this.connectionState.startEl);
            const startType = this.connectionState.startType;
            temp.setAttribute("d", this.getBezierPath(sPos.x, sPos.y, worldX, worldY, startType, null));
        }
    }

    getBezierPath(sx, sy, tx, ty, startType, endType) {
        const dist = Math.abs(tx - sx);
        // "Stiffer" Bezier
        const padding = Math.max(Math.min(dist * 0.25, 80), 30);

        let cp1x, cp2x;

        if (startType === 'source') {
            cp1x = sx + padding;
        } else {
            cp1x = sx - padding;
        }

        if (endType) {
            if (endType === 'target') cp2x = tx - padding;
            else cp2x = tx + padding;
        } else {
            if (startType === 'source') cp2x = tx - padding; 
            else cp2x = tx + padding; 
        }

        return `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`;
    }

    // --- Selection Logic ---

    updateSelection(worldX, worldY, worldW, worldH) {
        this.nodes.forEach(node => {
            const nodeW = node.element.offsetWidth;
            const nodeH = node.element.offsetHeight;
            if (worldX < node.x + nodeW && worldX + worldW > node.x &&
                worldY < node.y + nodeH && worldY + worldH > node.y) {
                if (!node.element.classList.contains('selected')) {
                    node.element.classList.add('selected');
                }
            } else {
                node.element.classList.remove('selected');
            }
        });
    }

    deselectAll() {
        this.nodes.forEach(node => node.element.classList.remove('selected'));
        this.groupBox.classList.add('hidden');
    }

    // [新增] 批量選中節點 (用於 Copy/Duplicate 後自動選中)
    selectNodes(ids) {
        this.deselectAll();
        ids.forEach(id => {
            const node = this.nodes.get(id);
            if (node) {
                node.element.classList.add('selected');
            }
        });
        this.renderGroupSelectionBox();
    }

    getSelectedNodes() {
        const selected = [];
        this.nodes.forEach(node => {
            if(node.element.classList.contains('selected')) selected.push(node);
        });
        return selected;
    }

    renderGroupSelectionBox() {
        const selected = this.getSelectedNodes();
        if (selected.length < 2) {
            this.groupBox.classList.add('hidden');
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selected.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.element.offsetWidth);
            maxY = Math.max(maxY, node.y + node.element.offsetHeight);
        });
        const padding = 4;
        this.groupBox.style.transform = `translate(${minX - padding}px, ${minY - padding}px)`;
        this.groupBox.style.width = `${maxX - minX + padding * 2}px`;
        this.groupBox.style.height = `${maxY - minY + padding * 2}px`;
        this.groupBox.classList.remove('hidden');
    }

    // --- Node Management ---

    addNode(nodeData) {
        const renderer = NodeRenderers[nodeData.type];
        if (!renderer) return;

        const el = renderer(nodeData.id, nodeData.data, this.callbacks.onNodeChange, this.callbacks.onContext);
        el.id = nodeData.id;
        el.style.transform = `translate(${nodeData.position.x}px, ${nodeData.position.y}px)`;
        
        const header = el.querySelector('.header-drag-handle');
        header.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                e.stopPropagation();
                
                // Reset accumulator & Capture initial state
                this.dragState.accumulated = { x: 0, y: 0 };
                this.dragState.initialPositions = new Map();

                if (!el.classList.contains('selected')) {
                    if (!e.shiftKey) this.deselectAll();
                    el.classList.add('selected');
                }
                this.renderGroupSelectionBox();
                
                // Capture positions for ALL selected nodes
                const selectedNodes = this.getSelectedNodes();
                selectedNodes.forEach(node => {
                    this.dragState.initialPositions.set(node.id, { x: node.x, y: node.y });
                });

                this.dragState.active = true;
                this.dragState.type = 'NODE';
                this.dragState.targetId = nodeData.id;
            }
        });

        const ports = el.querySelectorAll('.port');
        ports.forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const type = port.dataset.type;
                const handleId = port.dataset.handleid;

                if (type === 'source') {
                    this.startConnection(nodeData.id, handleId, 'source', port);
                } else if (type === 'target') {
                    const existingEdge = this.edges.find(ed => ed.target === nodeData.id && ed.targetHandle === handleId);
                    if (existingEdge) {
                        this.callbacks.onDisconnect(existingEdge.source, existingEdge.target, existingEdge.sourceHandle, existingEdge.targetHandle);
                        this.removeEdgeInternal(existingEdge.id);
                        
                        const sourceNode = this.nodes.get(existingEdge.source);
                        if (sourceNode) {
                            const sourcePort = sourceNode.element.querySelector(`.port[data-handleid="${existingEdge.sourceHandle}"]`);
                            this.startConnection(existingEdge.source, existingEdge.sourceHandle, 'source', sourcePort);
                        }
                    } else {
                        this.startConnection(nodeData.id, handleId, 'target', port);
                    }
                }
            });
        });

        this.nodesLayer.appendChild(el);
        this.nodes.set(nodeData.id, { ...nodeData, x: nodeData.position.x, y: nodeData.position.y, element: el });
    }

    removeNode(id) {
        const node = this.nodes.get(id);
        if (node) {
            node.element.remove();
            this.nodes.delete(id);
            this.edges = this.edges.filter(e => e.source !== id && e.target !== id);
            this.renderEdges();
            this.renderGroupSelectionBox();
        }
    }
}