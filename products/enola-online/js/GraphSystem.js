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
            mode: 'IDLE', 
            timer: null,
            startScreen: { x: 0, y: 0 },
            startWorld: { x: 0, y: 0 },
            lastScreen: { x: 0, y: 0 },
            initialPinchDist: 0,
            initialScale: 1,
            pinchStartWorld: { x: 0, y: 0 }, // [新增] 缩放中心点
            initialNodePositions: new Map(),
            dragTargetId: null,
            lastTapTime: 0,      // [新增] 双击检测
            lastTapPort: null    // [新增] 双击检测
        };

        this.connectionState = { active: false, startNodeId: null, startHandle: null, startType: null, startEl: null };
        this.pendingSource = null; // [新增] 用于点按连接 ({ nodeId, handleId, portEl })

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
        // --- MOUSE EVENTS (电脑端) ---
        this.container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // --- TOUCH EVENTS (移动端) ---
        this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        document.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
    }

    // =========================================
    //        核心逻辑：端口交互
    // =========================================
    
    handlePortInteraction(nodeId, handleId, type, portEl) {
        // 如果是 In 端口且已有线，启动“拿起/重连”逻辑 (Drag 模式)
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

    // [新增] 处理端口点击 (点按连接逻辑)
    handlePortClick(nodeId, handleId, type, portEl) {
        // 1. 点击 OUT 端口 -> 选中/取消选中
        if (type === 'source') {
            if (this.pendingSource && this.pendingSource.portEl === portEl) {
                // 取消选中
                this.clearPendingSource();
            } else {
                // 选中新源
                this.clearPendingSource(); // 清除旧的
                this.pendingSource = { nodeId, handleId, portEl };
                portEl.style.backgroundColor = '#00FFFF'; // 高亮显示
                portEl.style.boxShadow = '0 0 5px #00FFFF';
            }
        } 
        // 2. 点击 IN 端口
        else if (type === 'target') {
            if (this.pendingSource) {
                const src = this.pendingSource;
                
                // 检查是否已连接
                const existing = this.edges.find(e => 
                    e.source === src.nodeId && e.sourceHandle === src.handleId &&
                    e.target === nodeId && e.targetHandle === handleId
                );

                if (existing) {
                    // 已连接 -> 断开
                    this.callbacks.onDisconnect(src.nodeId, nodeId, src.handleId, handleId);
                    this.removeEdgeInternal(existing.id);
                } else {
                    // 未连接 -> 连接 (tryConnect 会自动处理替换旧线)
                    this.tryConnect(src.nodeId, src.handleId, nodeId, handleId);
                }
                
                this.clearPendingSource();
            }
        }
    }

    // [新增] 处理端口双击 (断开逻辑)
    handlePortDoubleClick(portEl) {
        const type = portEl.dataset.type;
        if (type === 'target') {
            const nodeId = portEl.closest('.node-container').id;
            const handleId = portEl.dataset.handleid;
            
            // 找到连接到此端口的线并删除
            const edges = this.edges.filter(e => e.target === nodeId && e.targetHandle === handleId);
            edges.forEach(e => {
                this.callbacks.onDisconnect(e.source, e.target, e.sourceHandle, e.targetHandle);
                this.removeEdgeInternal(e.id);
            });
        }
    }

    clearPendingSource() {
        if (this.pendingSource && this.pendingSource.portEl) {
            this.pendingSource.portEl.style.backgroundColor = ''; // 恢复默认
            this.pendingSource.portEl.style.boxShadow = '';
        }
        this.pendingSource = null;
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
            this.prepareNodeDrag(nodeEl.id, e.shiftKey);
            if (target.closest('.header-drag-handle')) {
                this.mouseState.type = 'DRAG_NODE';
            } else {
                this.mouseState.type = null; 
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
        
        // [修改] 检测是否是点击端口（用于点按连接）
        // 注意：电脑端已有 Drag 连线，但也可以支持 Click-Click
        // 这里主要处理拖拽结束
        if (this.connectionState.active) {
            this.finalizeConnection(e);
        }
    }

    // =========================================
    //            移动端 (Touch)
    // =========================================

    handleTouchStart(e) {
        if (e.target.closest('.nodrag')) return;

        // [修改] 双指缩放：以双指中心为基准
        if (e.touches.length === 2) {
            e.preventDefault(); // 阻止浏览器缩放
            this.cancelTouchTimer();
            this.touchState.mode = 'ZOOMING';
            
            const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
            
            // 计算屏幕中心点
            const centerScreen = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            
            this.touchState.initialPinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            this.touchState.initialScale = this.view.scale;
            
            // 记录该中心点对应的世界坐标 (这是缩放的锚点)
            this.touchState.pinchStartWorld = this.screenToWorld(centerScreen.x, centerScreen.y);
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
                // [新增] 手机端双击检测
                const now = Date.now();
                if (this.touchState.lastTapPort === portEl && (now - this.touchState.lastTapTime) < 300) {
                    this.handlePortDoubleClick(portEl);
                    e.preventDefault();
                    this.touchState.lastTapPort = null;
                    return;
                }
                this.touchState.lastTapPort = portEl;
                this.touchState.lastTapTime = now;

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
                if (target.closest('.header-drag-handle')) {
                    this.touchState.mode = 'DRAGGING_NODE';
                    this.touchState.dragTargetId = nodeEl.id;
                } else {
                    this.touchState.mode = 'IDLE';
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

        // [修改] 双指缩放：中心点算法
        if (e.touches.length === 2 && this.touchState.mode === 'ZOOMING') {
            e.preventDefault();
            
            const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
            
            // 当前的屏幕中心
            const centerScreen = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const delta = dist - this.touchState.initialPinchDist;
            
            const newScale = Math.max(0.1, Math.min(this.touchState.initialScale + delta * 0.002, 5.0));
            
            // 计算新的 Pan (x, y)
            // 逻辑：让 pinchStartWorld 这个点，在缩放后，依然位于 centerScreen 这个位置
            // 公式推导： screenX = worldX * scale + panX + rectLeft
            //           panX = screenX - rectLeft - worldX * scale
            const rect = this.container.getBoundingClientRect();
            const wx = this.touchState.pinchStartWorld.x;
            const wy = this.touchState.pinchStartWorld.y;
            
            this.view.scale = newScale;
            this.view.x = centerScreen.x - rect.left - wx * newScale;
            this.view.y = centerScreen.y - rect.top - wy * newScale;
            
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
        
        // [新增] 检测是否是单纯点击端口 (Drag 距离极小，或者按下和抬起在同一个元素)
        // 这里使用引用判断
        if (port && this.connectionState.startEl === port) {
            const nodeId = port.closest('.node-container').id;
            const handleId = port.dataset.handleid;
            const type = port.dataset.type;
            this.handlePortClick(nodeId, handleId, type, port);
        }

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
    
    getBezierPath(sx, sy, tx, ty) {
        let dist = Math.abs(tx - sx);
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
            
            // [新增] PC端双击断开
            port.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.handlePortDoubleClick(port);
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