
export class Switch {
    constructor(container, options) {
        this.options = options.options; // [{label, value}]
        this.value = options.value;
        this.onChange = options.onChange;
        this.element = this.createDOM();
        container.appendChild(this.element);
    }

    createDOM() {
        const container = document.createElement('div');
        container.className = "flex flex-col gap-1 nodrag select-none min-w-[40px]";
        this.renderOptions(container);
        return container;
    }

    renderOptions(container) {
        container.innerHTML = '';
        this.options.forEach(opt => {
            const row = document.createElement('div');
            row.className = "flex items-center gap-2 cursor-pointer group";
            
            const isSelected = this.value === opt.value;
            
            // Box
            const box = document.createElement('div');
            box.className = `w-2 h-2 border border-[#00FF00] flex items-center justify-center ${isSelected ? 'bg-[#00FF00]' : 'bg-black'}`;
            if (isSelected) {
                const inner = document.createElement('div');
                inner.className = "w-1 h-1 bg-[#00FF00]";
                box.appendChild(inner);
            }

            // Label
            const span = document.createElement('span');
            span.className = `text-[9px] font-arial uppercase tracking-wider leading-none ${isSelected ? 'text-[#00FF00] font-bold' : 'text-[#005500] group-hover:text-[#00AA00]'}`;
            span.innerText = opt.label;

            row.appendChild(box);
            row.appendChild(span);

            row.onclick = (e) => {
                e.stopPropagation();
                if (this.value !== opt.value) {
                    this.value = opt.value;
                    this.onChange(this.value);
                    this.renderOptions(container); // Re-render
                }
            };
            container.appendChild(row);
        });
    }
}
