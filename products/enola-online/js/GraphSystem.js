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
        this.dragState = { active: false, type: null, targetId: null, accumulated: { x: 0, y: 0 }, initialPositions: new Map() };
        this.connectionState = { active: false, startNodeId: null, startHandle: null, startType: null, startEl: null };
        this.selectionState = { active: false, startX: 0, startY: 0 }; 
        
        // Touch State for Zoom/Pan
        this.touchState = {
            distance: null,
            center: null,
            isZooming: false,
            longPressTimer: null
        };

        this.initEvents();
        this.updateTransform();
    }

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
        // --- MOUSE EVENTS (Existing) ---
        this.container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // --- TOUCH EVENTS (New) ---
        this.container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        document.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
    }

    // --- Logic Implementation ---

    handleWheel(e) {
        e.preventDefault();
        if (e.ctrlKey) {
            const delta = -e.deltaY * 0.001;
            this.zoom(delta, e.clientX, e.clientY);
        } else {
            if (e.shiftKey) this.view.x -= e.deltaY;
            else this.view.y -= e.deltaY; 
            this.updateTransform();
        }
    }

    zoom(deltaScale, clientX, clientY) {
        const oldScale = this.view.scale;
        let newScale = Math.max(0.1, Math.min(oldScale + deltaScale, 5.0));

        const rect = this.container.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        const worldX = (mouseX - this.view.x) / oldScale;
        const worldY = (mouseY - this.view.y) / oldScale;

        this.view.scale = newScale;
        this.view.x = mouseX - worldX * newScale;
        this.view.y = mouseY - worldY * newScale;
        this.updateTransform();
    }

    // --- MOUSE HANDLERS ---
    handleMouseDown(e) {
        const validBg = [this.container, document.getElementById('grid-layer'), this.svgLayer, this.contentLayer, this.nodesLayer];
        const isNode = e.target.closest('.node-container');
        const isPort = e.target.closest('.port');

        if (validBg.includes(e.target) && !isNode && !isPort) {
            this.startSelection(e.clientX, e.clientY);
        }
    }

    handleMouseMove(e) {
        this.processMove(e.clientX, e.clientY, e.movementX, e.movementY);
    }

    handleMouseUp(e) {
        this.endInteraction(e);
    }

    // --- TOUCH HANDLERS ---
    handleTouchStart(e) {
        // Prevent default browser zooming/scrolling
        if(e.target.closest('.nodrag')) return; // Allow knobs/switches to handle themselves
        
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            
            // Long Press Logic for Background
            this.touchState.longPressTimer = setTimeout(() => {
                const validBg = [this.container, document.getElementById('grid-layer'), this.svgLayer, this.contentLayer, this.nodesLayer];
                // Need to re-check target because elementFromPoint might have changed or we just check logic
                if (validBg.includes(e.target) || validBg.includes(target)) {
                    this.callbacks.onContext({
                        preventDefault:()=>{}, stopPropagation:()=>{},
                        clientX: touch.clientX, clientY: touch.clientY
                    });
                }
            }, 500);

            // Delegate to "MouseDown" logic for dragging/connections
            // We simulate the event structure
            const validBg = [this.container, document.getElementById('grid-layer'), this.svgLayer, this.contentLayer, this.nodesLayer];
            const isNode = target ? target.closest('.node-container') : null;
            const isPort = target ? target.closest('.port') : null;

            // Store last touch for movement delta calculation
            this.touchState.lastX = touch.clientX;
            this.touchState.lastY = touch.clientY;

            if (validBg.includes(e.target) && !isNode && !isPort) {
                // Background Selection
                this.startSelection(touch.clientX, touch.clientY);
            } 
            // Note: Node drag and Port connect are handled by their own listeners, 
            // but we need to ensure they work with touch events dispatched manually or 
            // by handling them centrally here. 
            // Since we added listeners to Nodes/Ports in addNode, we rely on bubbling or direct binding there?
            // Actually, in addNode we bound 'mousedown'. We need 'touchstart' there too.
            // See addNode method modification below.
        } 
        else if (e.touches.length === 2) {
            clearTimeout(this.touchState.longPressTimer);
            this.touchState.isZooming = true;
            this.touchState.distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            this.touchState.center = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };
        }
    }

    handleTouchMove(e) {
        clearTimeout(this.touchState.longPressTimer);

        if (e.touches.length === 1 && !this.touchState.isZooming) {
            const touch = e.touches[0];
            const movementX = touch.clientX - this.touchState.lastX;
            const movementY = touch.clientY - this.touchState.lastY;
            
            this.processMove(touch.clientX, touch.clientY, movementX, movementY);

            this.touchState.lastX = touch.clientX;
            this.touchState.lastY = touch.clientY;
        } 
        else if (e.touches.length === 2) {
            const newDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const newCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2
            };

            if (this.touchState.distance) {
                // 1. Zoom
                const deltaScale = (newDist - this.touchState.distance) * 0.01;
                this.zoom(deltaScale, newCenter.x, newCenter.y);

                // 2. Pan
                if (this.touchState.center) {
                    const dx = newCenter.x - this.touchState.center.x;
                    const dy = newCenter.y - this.touchState.center.y;
                    this.view.x += dx;
                    this.view.y += dy;
                    this.updateTransform();
                }
            }

            this.touchState.distance = newDist;
            this.touchState.center = newCenter;
        }
    }

    handleTouchEnd(e) {
        clearTimeout(this.touchState.longPressTimer);
        
        if (e.touches.length < 2) {
            this.touchState.isZooming = false;
            this.touchState.distance = null;
            this.touchState.center = null;
        }
        
        // Pass a dummy event or construct one from changedTouches if needed
        // finalizeConnection uses e.target, so we need the element where finger lifted
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        this.endInteraction({ target: target, clientX: touch.clientX, clientY: touch.clientY });
    }


    // --- SHARED CORE LOGIC ---

    startSelection(x, y) {
        this.deselectAll();
        this.selectionState.active = true;
        const rect = this.container.getBoundingClientRect();
        this.selectionState.startX = x - rect.left;
        this.selectionState.startY = y - rect.top;
        
        this.rubberBand.style.left = this.selectionState.startX + 'px';
        this.rubberBand.style.top = this.selectionState.startY + 'px';
        this.rubberBand.style.width = '0px';
        this.rubberBand.style.height = '0px';
        this.rubberBand.classList.remove('hidden');
    }

    processMove(clientX, clientY, movementX, movementY) {
        // 1. Drag Node
        if (this.dragState.active && this.dragState.type === 'NODE') {
            this.dragState.accumulated.x += movementX / this.view.scale;
            this.dragState.accumulated.y += movementY / this.view.scale;

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

        // 2. Drag Connection
        if (this.connectionState.active) {
            const worldPos = this.screenToWorld(clientX, clientY);
            this.renderTempLine(worldPos.x, worldPos.y);
        }

        // 3. Drag Selection Box
        if (this.selectionState.active) {
            const rect = this.container.getBoundingClientRect();
            const currentX = clientX - rect.left;
            const currentY = clientY - rect.top;
            
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
    }

    endInteraction(e) {
        // Finalize Connection
        if (this.connectionState.active) {
            this.finalizeConnection(e);
        }

        // Finalize Selection
        if (this.selectionState.active) {
            this.selectionState.active = false;
            this.rubberBand.classList.add('hidden');
            this.renderGroupSelectionBox(); 
        }

        // Reset Drag
        this.dragState.active = false;
        this.dragState.targetId = null;
        this.dragState.initialPositions.clear();
    }

    // --- HELPER METHODS REMAIN UNCHANGED ---
    startConnection(nodeId, handleId, type, portEl) {
        this.connectionState.active = true;
        this.connectionState.startNodeId = nodeId;
        this.connectionState.startHandle = handleId;
        this.connectionState.startType = type; 
        this.connectionState.startEl = portEl;
    }

    finalizeConnection(e) {
        // Support both MouseEvent.target and custom object passed from touch
        const target = e.target; 
        const port = target ? target.closest('.port') : null;
        
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
        this.callbacks.onConnect({ source: sourceId, sourceHandle: sourceHandle, target: targetId, targetHandle: targetHandle });
    }

    addEdge(edgeParams) {
        const conflictIndex = this.edges.findIndex(e => e.target === edgeParams.target && e.targetHandle === edgeParams.targetHandle);
        if (conflictIndex !== -1) this.edges.splice(conflictIndex, 1);
        this.edges.push({ ...edgeParams, id: `e-${Date.now()}-${Math.random()}` });
        this.renderEdges();
    }
    
    removeEdgeInternal(edgeId) { this.edges = this.edges.filter(e => e.id !== edgeId); this.renderEdges(); }
    removeEdge(sourceId, targetId, sourceHandle, targetHandle) {
        this.edges = this.edges.filter(e => !(e.source === sourceId && e.target === targetId && e.sourceHandle === sourceHandle && e.targetHandle === targetHandle));
        this.renderEdges();
    }
    updateEdges() { this.renderEdges(); }

    getPortWorldPos(portEl) {
        const rect = portEl.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        const screenX = rect.left - containerRect.left + rect.width/2;
        const screenY = rect.top - containerRect.top + rect.height/2;
        return { x: (screenX - this.view.x) / this.view.scale, y: (screenY - this.view.y) / this.view.scale };
    }

    renderEdges() {
        this.svgLayer.innerHTML = '';
        this.edges.forEach(edge => {
            const sn = this.nodes.get(edge.source);
            const tn = this.nodes.get(edge.target);
            if(!sn || !tn) return;
            const sp = sn.element.querySelector(`.port[data-handleid="${edge.sourceHandle}"]`);
            const tp = tn.element.querySelector(`.port[data-handleid="${edge.targetHandle}"]`);
            if (sp && tp) {
                const s = this.getPortWorldPos(sp);
                const t = this.getPortWorldPos(tp);
                const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
                p.setAttribute("d", this.getBezierPath(s.x, s.y, t.x, t.y, 'source', 'target'));
                p.setAttribute("stroke", "#00FF00");
                p.setAttribute("stroke-width", "2");
                p.setAttribute("fill", "none");
                this.svgLayer.appendChild(p);
            }
        });
    }

    renderTempLine(wx, wy) {
        let temp = document.getElementById('temp-line');
        if (!temp) {
            temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
            temp.id = 'temp-line';
            temp.setAttribute("stroke", "#00FF00"); temp.setAttribute("stroke-width", "2"); temp.setAttribute("stroke-dasharray", "5,5"); temp.setAttribute("fill", "none");
            this.svgLayer.appendChild(temp);
        }
        if (this.connectionState.startEl) {
            const s = this.getPortWorldPos(this.connectionState.startEl);
            temp.setAttribute("d", this.getBezierPath(s.x, s.y, wx, wy, this.connectionState.startType, null));
        }
    }

    getBezierPath(sx, sy, tx, ty, startType, endType) {
        const dist = Math.abs(tx - sx);
        const padding = Math.max(Math.min(dist * 0.25, 80), 30);
        let cp1x = (startType === 'source') ? sx + padding : sx - padding;
        let cp2x;
        if (endType) cp2x = (endType === 'target') ? tx - padding : tx + padding;
        else cp2x = (startType === 'source') ? tx - padding : tx + padding;
        return `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ty}, ${tx} ${ty}`;
    }

    updateSelection(wx, wy, ww, wh) {
        this.nodes.forEach(n => {
            const nw = n.element.offsetWidth; const nh = n.element.offsetHeight;
            if (wx < n.x + nw && wx + ww > n.x && wy < n.y + nh && wy + wh > n.y) {
                if (!n.element.classList.contains('selected')) n.element.classList.add('selected');
            } else n.element.classList.remove('selected');
        });
    }

    deselectAll() { this.nodes.forEach(n => n.element.classList.remove('selected')); this.groupBox.classList.add('hidden'); }
    selectNodes(ids) { this.deselectAll(); ids.forEach(id => { const n = this.nodes.get(id); if (n) n.element.classList.add('selected'); }); this.renderGroupSelectionBox(); }
    getSelectedNodes() { return Array.from(this.nodes.values()).filter(n => n.element.classList.contains('selected')); }

    renderGroupSelectionBox() {
        const sel = this.getSelectedNodes();
        if (sel.length < 2) { this.groupBox.classList.add('hidden'); return; }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        sel.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + n.element.offsetWidth); maxY = Math.max(maxY, n.y + n.element.offsetHeight); });
        this.groupBox.style.transform = `translate(${minX - 4}px, ${minY - 4}px)`;
        this.groupBox.style.width = `${maxX - minX + 8}px`;
        this.groupBox.style.height = `${maxY - minY + 8}px`;
        this.groupBox.classList.remove('hidden');
    }

    addNode(nodeData) {
        const renderUI = ModuleRegistry.getRenderer(nodeData.type);
        if (!renderUI) return;

        const el = renderUI(nodeData.id, nodeData.data, this.callbacks.onNodeChange, this.callbacks.onContext);
        
        el.id = nodeData.id;
        el.style.transform = `translate(${nodeData.position.x}px, ${nodeData.position.y}px)`;
        
        const header = el.querySelector('.header-drag-handle');
        
        // --- Drag Logic Handlers ---
        const startDrag = (e) => {
            // e is either MouseEvent or Touch object
            this.dragState.accumulated = { x: 0, y: 0 };
            this.dragState.initialPositions = new Map();

            if (!el.classList.contains('selected')) {
                // If not multi-selecting with shift, clear others
                // Note: shiftKey is only on MouseEvents. On touch we assume single selection unless logic added.
                const isShift = e.shiftKey || false; 
                if (!isShift) this.deselectAll();
                el.classList.add('selected');
            }
            this.renderGroupSelectionBox();
            
            const selectedNodes = this.getSelectedNodes();
            selectedNodes.forEach(node => {
                this.dragState.initialPositions.set(node.id, { x: node.x, y: node.y });
            });

            this.dragState.active = true;
            this.dragState.type = 'NODE';
            this.dragState.targetId = nodeData.id;
        };

        header.addEventListener('mousedown', (e) => {
            if (e.button === 0) { e.stopPropagation(); startDrag(e); }
        });

        // [New] Touch Start for Node Dragging
        header.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.stopPropagation();
                // Pass the touch object extended with shiftKey false
                const t = e.touches[0];
                startDrag({ shiftKey: false, clientX: t.clientX, clientY: t.clientY });
            }
        }, { passive: false });


        const ports = el.querySelectorAll('.port');
        ports.forEach(port => {
            const handleStart = (e) => {
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
            };

            port.addEventListener('mousedown', handleStart);
            port.addEventListener('touchstart', (e) => {
                // Prevent long press context menu on ports
                e.preventDefault(); 
                if(e.touches.length === 1) handleStart(e);
            }, { passive: false });
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