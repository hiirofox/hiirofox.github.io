export class Knob {
    constructor(container, options) {
        this.value = options.value;
        this.min = options.min;
        this.max = options.max;
        this.label = options.label;
        this.onChange = options.onChange;
        this.size = options.size || 36;
        this.element = this.createDOM();
        container.appendChild(this.element);
        this.updateVisuals();
    }

    createDOM() {
        const div = document.createElement('div');
        // 添加 nodrag 类，告诉 GraphSystem 不要处理这里的拖拽
        div.className = "nodrag cursor-ns-resize inline-flex flex-col items-center justify-start select-none touch-none";
        div.style.width = `${this.size}px`;
        
        const svgNS = "http://www.w3.org/2000/svg";
        this.svg = document.createElementNS(svgNS, "svg");
        this.svg.setAttribute("width", this.size);
        this.svg.setAttribute("height", this.size);
        this.svg.style.overflow = "visible";
        this.svg.style.display = "block";

        // Paths
        this.bgPath = document.createElementNS(svgNS, "path");
        this.bgPath.setAttribute("fill", "none");
        this.bgPath.setAttribute("stroke", "#222244");
        this.bgPath.setAttribute("stroke-width", "4");
        this.bgPath.setAttribute("stroke-linecap", "round");
        
        this.activePath = document.createElementNS(svgNS, "path");
        this.activePath.setAttribute("fill", "none");
        this.activePath.setAttribute("stroke", "#5555AA");
        this.activePath.setAttribute("stroke-width", "4");
        this.activePath.setAttribute("stroke-linecap", "round");

        this.pointerLine = document.createElementNS(svgNS, "line");
        this.pointerLine.setAttribute("stroke", "#00FF00");
        this.pointerLine.setAttribute("stroke-width", "5");
        this.pointerLine.setAttribute("stroke-linecap", "butt");

        this.svg.appendChild(this.bgPath);
        this.svg.appendChild(this.activePath);
        this.svg.appendChild(this.pointerLine);

        const labelSpan = document.createElement('span');
        labelSpan.className = "text-[#00FF00] text-[9px] font-bold font-arial leading-none pointer-events-none relative -top-1";
        labelSpan.innerText = this.label;

        div.appendChild(this.svg);
        div.appendChild(labelSpan);

        // Mouse Events
        div.addEventListener('mousedown', (e) => this.onMouseDown(e));

        // Touch Events
        div.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });

        return div;
    }

    onMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        this.startDrag(e.clientY);

        const moveHandler = (ev) => this.onMouseMove(ev);
        const upHandler = () => {
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
        };
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    }

    onMouseMove(e) {
        this.handleDrag(e.clientY);
    }

    onTouchStart(e) {
        if (e.touches.length > 1) return;
        e.preventDefault();
        e.stopPropagation(); // 关键：阻止冒泡，不触发地图拖动
        this.startDrag(e.touches[0].clientY);

        const moveHandler = (ev) => this.onTouchMove(ev);
        const endHandler = () => {
            window.removeEventListener('touchmove', moveHandler);
            window.removeEventListener('touchend', endHandler);
            window.removeEventListener('touchcancel', endHandler);
        };
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('touchend', endHandler);
        window.addEventListener('touchcancel', endHandler);
    }

    onTouchMove(e) {
        e.preventDefault(); 
        e.stopPropagation();
        this.handleDrag(e.touches[0].clientY);
    }

    startDrag(clientY) {
        this.isDragging = true;
        this.startY = clientY;
        this.startValue = this.value;
    }

    handleDrag(clientY) {
        const deltaY = this.startY - clientY;
        const range = this.max - this.min;
        const sensitivity = range / 200.0;
        let newVal = this.startValue + deltaY * sensitivity;
        newVal = Math.max(this.min, Math.min(this.max, newVal));
        
        if (newVal !== this.value) {
            this.value = newVal;
            this.onChange(this.value);
            this.updateVisuals();
        }
    }

    updateVisuals() {
        const cx = this.size / 2;
        const cy = this.size / 2;
        const radius = (this.size / 2) - 6;
        const startAngle = Math.PI * 0.75;
        const totalAngle = Math.PI * 1.5;
        const normalizedValue = (this.value - this.min) / (this.max - this.min);
        const currentAngle = startAngle + (normalizedValue * totalAngle);
        const endAngle = Math.PI * 2.25;

        const describeArc = (start, end) => {
            const sx = cx + radius * Math.cos(start);
            const sy = cy + radius * Math.sin(start);
            const ex = cx + radius * Math.cos(end);
            const ey = cy + radius * Math.sin(end);
            const largeArc = end - start <= Math.PI ? "0" : "1";
            return `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`;
        };

        this.bgPath.setAttribute("d", describeArc(startAngle, endAngle));
        this.activePath.setAttribute("d", describeArc(startAngle, currentAngle));

        const px1 = cx + (radius - 4) * Math.cos(currentAngle);
        const py1 = cy + (radius - 4) * Math.sin(currentAngle);
        const px2 = cx + (radius + 4) * Math.cos(currentAngle);
        const py2 = cy + (radius + 4) * Math.sin(currentAngle);

        this.pointerLine.setAttribute("x1", px1);
        this.pointerLine.setAttribute("y1", py1);
        this.pointerLine.setAttribute("x2", px2);
        this.pointerLine.setAttribute("y2", py2);
    }
}