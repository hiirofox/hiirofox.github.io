class LMKnob {
    constructor(canvas, id, options = {}) {
        this.canvas = canvas; 
        this.ctx = canvas.getContext('2d'); 
        this.id = id;
        this.min = options.min || 0; 
        this.max = options.max || 4095; 
        this.value = options.value || 0; 
        this.onchange = options.onchange || function() {}; 
        this.label = options.label || ""; 

        this.STYLE = { 
            BG_ARC: '#336', FG_ARC: '#66C', LINE: '#2F2', LINE_WIDTH: 4, 
            START_ANGLE: Math.PI * 0.75, // 135 deg
            TOTAL_ANGLE: Math.PI * 1.5,  // 270 deg
            LABEL_COLOR: '#7F7', 
            LABEL_FONT: 'bold 12px "FIXEDSYS", monospace' 
        };
        
        // 修正: 旋钮中心 Y 坐标上移 4px
        this.arcCenterX = 32;
        this.arcCenterY = 28; // 从 32 改为 28
        this.lineCenterX = 32;
        this.lineCenterY = 28; // 从 32 改为 28
        
        const zoomVal = 0.55; 
        const sliderW = 56.0; 
        this.arcRadius = (sliderW * zoomVal) / 2.0; // 15.4
        this.lineR1 = 11.0 * zoomVal * 2.0; // 12.1
        this.lineR2 = 17.0 * zoomVal * 2.0; // 18.7

        this.lastMouseY = 0;
        
        this.canvas.onmousedown = (e) => { 
            e.preventDefault(); 
            if (window.onKnobDragStart) { 
                window.onKnobDragStart(this, e.clientY); 
            } 
        };
        
        this.setValue(this.value, false); 
    }
    
    setValue(newValue, triggerCallback = true) { 
        this.value = Math.max(this.min, Math.min(this.max, newValue)); 
        this.draw(); 
        if (triggerCallback) { 
            this.onchange(this.id, this.value); 
        } 
    }
    
    handleDrag(newMouseY) { 
        const deltaY = this.lastMouseY - newMouseY; 
        this.lastMouseY = newMouseY; 
        const range = this.max - this.min; 
        const sensitivity = range / 200.0; 
        this.setValue(this.value + deltaY * sensitivity, true); 
    }
    
    setDragStart(y) { 
        this.lastMouseY = y; 
    }

    draw() {
        const ctx = this.ctx; 
        ctx.clearRect(0, 0, 64, 64); 

        const proportional = (this.value - this.min) / (this.max - this.min);
        
        const startAngle = this.STYLE.START_ANGLE; 
        const endAngle = startAngle + this.STYLE.TOTAL_ANGLE; 
        const valueAngle = startAngle + proportional * this.STYLE.TOTAL_ANGLE;
        
        ctx.lineCap = 'butt'; 
        ctx.lineWidth = this.STYLE.LINE_WIDTH;

        ctx.beginPath(); 
        ctx.strokeStyle = this.STYLE.BG_ARC; 
        ctx.arc(this.arcCenterX, this.arcCenterY, this.arcRadius, valueAngle, endAngle); 
        ctx.stroke();

        ctx.beginPath(); 
        ctx.strokeStyle = this.STYLE.FG_ARC; 
        ctx.arc(this.arcCenterX, this.arcCenterY, this.arcRadius, startAngle, valueAngle); 
        ctx.stroke();

        const lineAngle_math = valueAngle;
        const rotx_js = Math.cos(lineAngle_math); 
        const roty_js = Math.sin(lineAngle_math);
        
        ctx.beginPath(); 
        ctx.strokeStyle = this.STYLE.LINE; 
        ctx.moveTo(this.lineCenterX + rotx_js * this.lineR1, this.lineCenterY + roty_js * this.lineR1); 
        ctx.lineTo(this.lineCenterX + rotx_js * this.lineR2, this.lineCenterY + roty_js * this.lineR2); 
        ctx.stroke();
        
        ctx.fillStyle = this.STYLE.LABEL_COLOR; 
        ctx.font = this.STYLE.LABEL_FONT; 
        ctx.textAlign = 'center';
        // 标签仍在 y=58 绘制 (靠近 64x64 画布的底部)
        ctx.fillText(this.label, 32, 58); 
    }
}

// 导出主类，以便 main.js 可以导入它
export { LMKnob };