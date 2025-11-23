import { ModuleRegistry } from './ModuleRegistry.js';

const GRID_SIZE = 20;

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
        this.view = { x: 0, y: 0, scale: 1.0 };
        
        // --- 交互状态 ---
        this.mouseState = {
            active: false,
            type: null, // 'SELECT', 'DRAG_NODE'
            startScreen: { x: 0, y: 0 },
            startWorld: { x: 0, y: 0 },
            initialNodePositions: new Map()
        };

        this.touchState = {
            mode: 'IDLE', // IDLE, WAIT, PANNING, DRAGGING_NODE, LONG_PRESS_READY, SELECTING, ZOOMING, CONNECTING
            timer: null,
            startScreen: { x: 0, y: 0 },
            startWorld: { x: 0, y: 0 },
            lastScreen: { x: 0, y: 0 },
            initialPinchDist: 0,
            initialScale: 1,
            initialNodePositions: new Map(),
            dragTargetId: null
        };

        this.connectionState = { active: false, startNodeId: null, startHandle: null, startType: null, startEl: null };

        this.initEvents();
        this.updateTransform();
    }

    screenToWorld(screenX, screenY) {
        const rect = this.container.getBoundingClientRect();
        return {
            x: (screenX - rect.left - this.view.x) / this.view.scale,
            y: (screenY - rect.top - this.view.y) / this.view.scale
        };
    }

    updateTransform() {
        this.contentLayer.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
    }

    initEvents() {
        // --- MOUSE EVENTS ---
        this.container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // --- TOUCH EVENTS ---
        this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        document.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
    }

    // =========================================
    //        核心逻辑：端口交互 & 连线
    // =========================================
    
    handlePortInteraction(nodeId, handleId, type, portEl) {
        if (type === 'target') {
            const existingEdge = this.edges.find(e => e.target === nodeId && e.targetHandle === handleId);
            if (existingEdge) {
                this.callbacks.onDisconnect(existingEdge.source, existingEdge.target, existingEdge.sourceHandle, existingEdge.targetHandle);
                this.removeEdgeInternal(existingEdge.id);
                const sourceNode = this.nodes.get(existingEdge.source);
                if (sourceNode) {
                    const sourcePortEl = sourceNode.element.querySelector(`.port[data-handleid="${existingEdge.sourceHandle}"]`);
                    this.startConnection(existingEdge.source, existingEdge.sourceHandle, 'source', sourcePortEl);
                    return;
                }
            }
        }
        this.startConnection(nodeId, handleId, type, portEl);
    }

    startConnection(nodeId, handleId, type, portEl) {
        this.connectionState = { active: true, startNodeId: nodeId, startHandle: handleId, startType: type, startEl: portEl };
    }

    // =========================================
    //            电脑端 (Mouse)
    // =========================================

    handleWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            const delta = -e.deltaY * 0.001;
            this.zoomAt(delta, e.clientX, e.clientY);
        } else {
            if (e.shiftKey) this.view.x -= e.deltaY;
            else this.view.y -= e.deltaY; 
            this.updateTransform();
        }
    }

    zoomAt(deltaScale, screenX, screenY) {
        const oldScale = this.view.scale;
        let newScale = Math.max(0.1, Math.min(oldScale + deltaScale, 5.0));
        const rect = this.container.getBoundingClientRect();
        const mouseX = screenX - rect.left;
        const mouseY = screenY - rect.top;
        const worldX = (mouseX - this.view.x) / oldScale;
        const worldY = (mouseY - this.view.y) / oldScale;
        this.view.scale = newScale;
        this.view.x = mouseX - worldX * newScale;
        this.view.y = mouseY - worldY * newScale;
        this.updateTransform();
    }

    handleMouseDown(e) {
        if (e.button !== 0) return;
        const target = e.target;
        if (target.closest('.nodrag')) return;
        if (target.closest('.port')) return;

        const nodeEl = target.closest('.node-container');
        
        this.mouseState.active = true;
        this.mouseState.startScreen = { x: e.clientX, y: e.clientY };
        this.mouseState.startWorld = this.screenToWorld(e.clientX, e.clientY);

        if (nodeEl) {
            // 1. 选中节点
            this.prepareNodeDrag(nodeEl.id, e.shiftKey);
            
            // 2. 只有点击 Header 才能拖动
            if (target.closest('.header-drag-handle')) {
                this.mouseState.type = 'DRAG_NODE';
            } else {
                this.mouseState.type = null; // 仅选中
            }
        } else {
            this.mouseState.type = 'SELECT';
            this.startSelectionBox(e.clientX, e.clientY);
        }
    }

    handleMouseMove(e) {
        if (this.connectionState.active) {
            const w = this.screenToWorld(e.clientX, e.clientY);
            this.renderTempLine(w.x, w.y);
        }

        if (!this.mouseState.active) return;

        if (this.mouseState.type === 'DRAG_NODE') {
            const currentWorld = this.screenToWorld(e.clientX, e.clientY);
            this.executeNodeDrag(currentWorld);
        } else if (this.mouseState.type === 'SELECT') {
            this.updateSelectionBox(e.clientX, e.clientY);
        }
    }

    handleMouseUp(e) {
        if (this.mouseState.type === 'SELECT') {
            this.endSelectionBox();
        }
        this.mouseState.active = false;
        if (this.connectionState.active) {
            this.finalizeConnection(e);
        }
    }

    // =========================================
    //            移动端 (Touch)
    // =========================================

    handleTouchStart(e) {
        if (e.target.closest('.nodrag')) return;

        if (e.touches.length === 2) {
            this.cancelTouchTimer();
            this.touchState.mode = 'ZOOMING';
            this.touchState.initialPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            this.touchState.initialScale = this.view.scale;
            return;
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const nodeEl = target ? target.closest('.node-container') : null;
            const portEl = target ? target.closest('.port') : null;

            this.touchState.startScreen = { x: touch.clientX, y: touch.clientY };
            this.touchState.lastScreen = { x: touch.clientX, y: touch.clientY };
            this.touchState.startWorld = this.screenToWorld(touch.clientX, touch.clientY);

            if (portEl) {
                this.cancelTouchTimer();
                this.touchState.mode = 'CONNECTING';
                const type = portEl.dataset.type;
                const handleId = portEl.dataset.handleid;
                const nodeId = portEl.closest('.node-container').id;
                this.handlePortInteraction(nodeId, handleId, type, portEl);
                e.preventDefault(); 
                return;
            }

            if (nodeEl) {
                this.cancelTouchTimer();
                this.prepareNodeDrag(nodeEl.id, false);
                
                // 只有点击 Header 才能拖动
                if (target.closest('.header-drag-handle')) {
                    this.touchState.mode = 'DRAGGING_NODE';
                    this.touchState.dragTargetId = nodeEl.id;
                } else {
                    this.touchState.mode = 'IDLE'; // 仅选中
                }
                return;
            }

            this.touchState.mode = 'WAIT';
            this.touchState.timer = setTimeout(() => {
                this.onLongPress(touch);
            }, 500);
        }
    }

    onLongPress(touch) {
        if (this.touchState.mode === 'WAIT') {
            this.touchState.mode = 'LONG_PRESS_READY';
            if (navigator.vibrate) navigator.vibrate(50);
        }
    }

    cancelTouchTimer() {
        if (this.touchState.timer) {
            clearTimeout(this.touchState.timer);
            this.touchState.timer = null;
        }
    }

    handleTouchMove(e) {
        if (this.touchState.mode !== 'IDLE') {
            if (e.cancelable) e.preventDefault();
        }

        if (e.touches.length === 2 && this.touchState.mode === 'ZOOMING') {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = dist - this.touchState.initialPinchDist;
            const newScale = Math.max(0.1, Math.min(this.touchState.initialScale + delta * 0.002, 5.0));
            this.view.scale = newScale;
            this.updateTransform();
            return;
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const dx = touch.clientX - this.touchState.lastScreen.x;
            const dy = touch.clientY - this.touchState.lastScreen.y;
            const totalDist = Math.hypot(touch.clientX - this.touchState.startScreen.x, touch.clientY - this.touchState.startScreen.y);

            if (this.touchState.mode === 'WAIT') {
                if (totalDist > 10) {
                    this.cancelTouchTimer();
                    this.touchState.mode = 'PANNING';
                }
            }

            if (this.touchState.mode === 'LONG_PRESS_READY') {
                if (totalDist > 10) {
                    this.touchState.mode = 'SELECTING';
                    this.startSelectionBox(this.touchState.startScreen.x, this.touchState.startScreen.y);
                }
            }

            if (this.touchState.mode === 'PANNING') {
                this.view.x += dx;
                this.view.y += dy;
                this.updateTransform();
            }
            else if (this.touchState.mode === 'DRAGGING_NODE') {
                const currWorld = this.screenToWorld(touch.clientX, touch.clientY);
                this.executeNodeDrag(currWorld);
            }
            else if (this.touchState.mode === 'SELECTING') {
                this.updateSelectionBox(touch.clientX, touch.clientY);
            }
            else if (this.touchState.mode === 'CONNECTING') {
                const w = this.screenToWorld(touch.clientX, touch.clientY);
                this.renderTempLine(w.x, w.y);
            }

            this.touchState.lastScreen = { x: touch.clientX, y: touch.clientY };
        }
    }

    handleTouchEnd(e) {
        this.cancelTouchTimer();
        const touch = e.changedTouches[0];

        if (this.touchState.mode === 'LONG_PRESS_READY') {
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            this.callbacks.onContext({
                preventDefault: ()=>{}, stopPropagation: ()=>{},
                clientX: touch.clientX, clientY: touch.clientY,
                target: target
            });
        }
        else if (this.touchState.mode === 'SELECTING') {
            this.endSelectionBox();
        }
        else if (this.touchState.mode === 'CONNECTING') {
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            this.finalizeConnection({ target: target });
        }
        else if (this.touchState.mode === 'WAIT') {
            this.deselectAll();
        }

        this.touchState.mode = 'IDLE';
        this.touchState.dragTargetId = null;
        const temp = document.getElementById('temp-line');
        if (temp) temp.remove();
    }

    // =========================================
    //               通用逻辑实现
    // =========================================

    // [修复] 找回 selectNodes 方法
    selectNodes(ids) {
        this.deselectAll();
        ids.forEach(id => {
            const node = this.nodes.get(id);
            if (node) node.element.classList.add('selected');
        });
        this.renderGroupSelectionBox();
    }

    prepareNodeDrag(nodeId, isShift) {
        const node = this.nodes.get(nodeId);
        const el = node.element;

        if (!el.classList.contains('selected')) {
            if (!isShift) this.deselectAll();
            el.classList.add('selected');
        }
        this.renderGroupSelectionBox();

        const startW = this.mouseState.active ? this.mouseState.startWorld : this.touchState.startWorld;

        const initialPos = new Map();
        this.getSelectedNodes().forEach(n => {
            initialPos.set(n.id, { 
                nodeX: n.x, 
                nodeY: n.y,
                offsetX: n.x - startW.x,
                offsetY: n.y - startW.y
            });
        });

        if (this.mouseState.active) this.mouseState.initialNodePositions = initialPos;
        else this.touchState.initialNodePositions = initialPos;
    }

    executeNodeDrag(currentWorldPos) {
        const initialPos = this.mouseState.active ? this.mouseState.initialNodePositions : this.touchState.initialNodePositions;

        initialPos.forEach((init, id) => {
            const node = this.nodes.get(id);
            if (node) {
                let rawX = currentWorldPos.x + init.offsetX;
                let rawY = currentWorldPos.y + init.offsetY;
                node.x = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
                node.y = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
                node.element.style.transform = `translate(${node.x}px, ${node.y}px)`;
            }
        });

        this.updateEdges();
        this.renderGroupSelectionBox();
    }

    startSelectionBox(sx, sy) {
        this.deselectAll();
        const rect = this.container.getBoundingClientRect();
        this.selectionState = { startX: sx - rect.left, startY: sy - rect.top };
        
        this.rubberBand.style.left = this.selectionState.startX + 'px';
        this.rubberBand.style.top = this.selectionState.startY + 'px';
        this.rubberBand.style.width = '0px';
        this.rubberBand.style.height = '0px';
        this.rubberBand.classList.remove('hidden');
    }

    updateSelectionBox(sx, sy) {
        const rect = this.container.getBoundingClientRect();
        const currX = sx - rect.left;
        const currY = sy - rect.top;

        const x = Math.min(this.selectionState.startX, currX);
        const y = Math.min(this.selectionState.startY, currY);
        const w = Math.abs(currX - this.selectionState.startX);
        const h = Math.abs(currY - this.selectionState.startY);

        this.rubberBand.style.left = x + 'px';
        this.rubberBand.style.top = y + 'px';
        this.rubberBand.style.width = w + 'px';
        this.rubberBand.style.height = h + 'px';

        const startW = this.screenToWorld(rect.left + x, rect.top + y);
        const endW = this.screenToWorld(rect.left + x + w, rect.top + y + h);

        this.nodes.forEach(n => {
            const nw = n.element.offsetWidth;
            const nh = n.element.offsetHeight;
            if (startW.x < n.x + nw && endW.x > n.x && startW.y < n.y + nh && endW.y > n.y) {
                n.element.classList.add('selected');
            } else {
                n.element.classList.remove('selected');
            }
        });
    }

    endSelectionBox() {
        this.rubberBand.classList.add('hidden');
        this.renderGroupSelectionBox();
    }

    finalizeConnection(e) {
        const target = e.target;
        const port = target ? target.closest('.port') : null;
        if (port) {
            const endNodeId = port.closest('.node-container').id;
            const endHandle = port.dataset.handleid;
            const endType = port.dataset.type;

            if (endNodeId !== this.connectionState.startNodeId) {
                const s = this.connectionState;
                if (s.startType === 'source' && endType === 'target') this.tryConnect(s.startNodeId, s.startHandle, endNodeId, endHandle);
                else if (s.startType === 'target' && endType === 'source') this.tryConnect(endNodeId, endHandle, s.startNodeId, s.startHandle);
            }
        }
        this.connectionState.active = false;
        const temp = document.getElementById('temp-line');
        if(temp) temp.remove();
    }

    tryConnect(s, sh, t, th) {
        const ex = this.edges.find(e => e.target === t && e.targetHandle === th);
        if (ex) {
            this.callbacks.onDisconnect(ex.source, ex.target, ex.sourceHandle, ex.targetHandle);
            this.removeEdgeInternal(ex.id);
        }
        this.callbacks.onConnect({ source: s, sourceHandle: sh, target: t, targetHandle: th });
    }

    addEdge(p) { 
        const idx = this.edges.findIndex(e => e.target === p.target && e.targetHandle === p.targetHandle);
        if(idx!==-1) this.edges.splice(idx,1);
        this.edges.push({...p, id: Math.random().toString()}); 
        this.renderEdges(); 
    }
    
    removeEdgeInternal(edgeId) {
        this.edges = this.edges.filter(e => e.id !== edgeId);
        this.renderEdges();
    }

    removeEdge(s, t, sh, th) {
        this.edges = this.edges.filter(e => !(e.source === s && e.target === t && e.sourceHandle === sh && e.targetHandle === th));
        this.renderEdges();
    }
    
    updateEdges() { this.renderEdges(); }
    
    // [修改] 贝塞尔曲线硬度
    getBezierPath(sx, sy, tx, ty) {
        let dist = Math.abs(tx - sx);
        // 限制 padding 范围 [10, 30] 使线条更硬
        const padding = Math.max(10, Math.min(dist * 0.5, 30));
        return `M ${sx} ${sy} C ${sx + padding} ${sy}, ${tx - padding} ${ty}, ${tx} ${ty}`;
    }

    renderEdges() {
        this.svgLayer.innerHTML = '';
        this.edges.forEach(e => {
            const sn = this.nodes.get(e.source);
            const tn = this.nodes.get(e.target);
            if(!sn || !tn) return;
            const sp = sn.element.querySelector(`.port[data-handleid="${e.sourceHandle}"]`);
            const tp = tn.element.querySelector(`.port[data-handleid="${e.targetHandle}"]`);
            if(sp && tp) {
                const s = this.getPortPos(sp);
                const t = this.getPortPos(tp);
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", this.getBezierPath(s.x, s.y, t.x, t.y));
                path.setAttribute("stroke", "#00FF00");
                path.setAttribute("stroke-width", "2");
                path.setAttribute("fill", "none");
                this.svgLayer.appendChild(path);
            }
        });
    }

    renderTempLine(wx, wy) {
        let temp = document.getElementById('temp-line');
        if(!temp) {
            temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
            temp.id = 'temp-line';
            temp.setAttribute("stroke", "#00FF00"); temp.setAttribute("stroke-width", "2"); temp.setAttribute("stroke-dasharray", "5,5"); temp.setAttribute("fill", "none");
            this.svgLayer.appendChild(temp);
        }
        if (this.connectionState.startEl) {
            const s = this.getPortPos(this.connectionState.startEl);
            const isSource = this.connectionState.startType === 'source';
            const padding = 30; 
            const cp1x = isSource ? s.x + padding : s.x - padding;
            const cp2x = isSource ? wx - padding : wx + padding;
            temp.setAttribute("d", `M ${s.x} ${s.y} C ${cp1x} ${s.y}, ${cp2x} ${wy}, ${wx} ${wy}`);
        }
    }

    getPortPos(el) {
        const r = el.getBoundingClientRect();
        const c = this.container.getBoundingClientRect();
        return {
            x: (r.left - c.left + r.width/2 - this.view.x) / this.view.scale,
            y: (r.top - c.top + r.height/2 - this.view.y) / this.view.scale
        };
    }

    deselectAll() { this.nodes.forEach(n => n.element.classList.remove('selected')); this.groupBox.classList.add('hidden'); }
    getSelectedNodes() { return Array.from(this.nodes.values()).filter(n => n.element.classList.contains('selected')); }
    
    renderGroupSelectionBox() {
        const sel = this.getSelectedNodes();
        if (sel.length < 2) { this.groupBox.classList.add('hidden'); return; }
        let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
        sel.forEach(n => { minX=Math.min(minX,n.x); minY=Math.min(minY,n.y); maxX=Math.max(maxX,n.x+n.element.offsetWidth); maxY=Math.max(maxY,n.y+n.element.offsetHeight); });
        this.groupBox.style.transform = `translate(${minX-4}px, ${minY-4}px)`;
        this.groupBox.style.width = `${maxX-minX+8}px`;
        this.groupBox.style.height = `${maxY-minY+8}px`;
        this.groupBox.classList.remove('hidden');
    }

    addNode(nodeData) {
        const renderUI = ModuleRegistry.getRenderer(nodeData.type);
        if (!renderUI) return;
        const el = renderUI(nodeData.id, nodeData.data, this.callbacks.onNodeChange, this.callbacks.onContext);
        el.id = nodeData.id;
        el.style.transform = `translate(${nodeData.position.x}px, ${nodeData.position.y}px)`;
        
        const ports = el.querySelectorAll('.port');
        ports.forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const type = port.dataset.type;
                const handleId = port.dataset.handleid;
                this.handlePortInteraction(nodeData.id, handleId, type, port);
            });
        });

        this.nodesLayer.appendChild(el);
        this.nodes.set(nodeData.id, { ...nodeData, x: nodeData.position.x, y: nodeData.position.y, element: el });
    }
    
    removeNode(id) {
        const node = this.nodes.get(id);
        if(node) { node.element.remove(); this.nodes.delete(id); this.edges = this.edges.filter(e=>e.source!==id && e.target!==id); this.renderEdges(); this.renderGroupSelectionBox(); }
    }
}