import {ShipConfig, ThrusterConfig} from '../ship-config';

type OnChange = () => void;

export class PropertiesPanel {
  private el: HTMLDivElement;
  private onChange: OnChange;
  private listeningForKey = false;
  private keyListenerCleanup?: () => void;

  // Track current view for self-refresh
  private currentConfig?: ShipConfig;
  private currentThrusterIndex = -1;
  private currentOnDelete?: () => void;

  constructor(container: HTMLElement, onChange: OnChange) {
    this.onChange = onChange;
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: absolute; top: 0; right: 0; width: 240px; height: 100%;
      background: #111; border-left: 1px solid #333; overflow-y: auto;
      font-family: monospace; font-size: 12px; color: #ccc; padding: 12px;
      box-sizing: border-box; display: none; z-index: 10;
    `;
    container.appendChild(this.el);
  }

  show() {
    this.el.style.display = 'block';
  }

  hide() {
    this.el.style.display = 'none';
    this.stopKeyListen();
  }

  renderShipProps(config: ShipConfig) {
    this.stopKeyListen();
    this.currentConfig = config;
    this.currentThrusterIndex = -1;
    this.el.innerHTML = '';
    this.addHeader('Ship Properties');
    this.addNumberField('Width', config.width, 4, 100, v => { config.width = v; this.onChange(); });
    this.addNumberField('Height', config.height, 4, 100, v => { config.height = v; this.onChange(); });
    this.addNumberField('Mass', config.mass, 0.1, 50, v => { config.mass = v; this.onChange(); }, 0.1);
    this.addNumberField('Inertia', config.inertia, 1, 1000, v => { config.inertia = v; this.onChange(); }, 10);
    this.addNumberField('Origin X', config.origin.x, -50, 50, v => { config.origin.x = v; this.onChange(); }, 0.5);
    this.addNumberField('Origin Y', config.origin.y, -50, 50, v => { config.origin.y = v; this.onChange(); }, 0.5);
  }

  renderThrusterProps(config: ShipConfig, index: number, onDelete: () => void) {
    this.stopKeyListen();
    this.currentConfig = config;
    this.currentThrusterIndex = index;
    this.currentOnDelete = onDelete;
    const t = config.thrusters[index];
    if (!t) return;

    this.el.innerHTML = '';
    this.addHeader(`Thruster ${index + 1}`);
    this.addNumberField('Pos X', t.position.x, -60, 60, v => { t.position.x = v; this.onChange(); }, 0.5);
    this.addNumberField('Pos Y', t.position.y, -60, 60, v => { t.position.y = v; this.onChange(); }, 0.5);
    this.addNumberField('Width', t.width, 1, 30, v => { t.width = v; this.onChange(); });
    this.addNumberField('Height', t.height, 1, 30, v => { t.height = v; this.onChange(); });
    this.addNumberField('Rotation', +(t.rotation * 180 / Math.PI).toFixed(1), -180, 180, v => {
      t.rotation = v * Math.PI / 180;
      this.onChange();
    }, 5);

    const strength = Math.sqrt(t.thrustDirection.x ** 2 + t.thrustDirection.y ** 2);
    this.addNumberField('Strength', +strength.toFixed(1), 1, 100, v => {
      const len = Math.sqrt(t.thrustDirection.x ** 2 + t.thrustDirection.y ** 2) || 1;
      const nx = t.thrustDirection.x / len;
      const ny = t.thrustDirection.y / len;
      t.thrustDirection.x = nx * v;
      t.thrustDirection.y = ny * v;
      this.onChange();
    }, 1);

    this.addDivider();
    this.addHeader('Key Bindings');
    this.renderKeyBindings(t);

    this.addDivider();
    this.addHeader('Gamepad Buttons');
    this.renderGamepadBindings(t);

    this.addDivider();
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete Thruster';
    deleteBtn.style.cssText = `
      width: 100%; padding: 8px; margin-top: 8px; background: #441111;
      color: #ff6644; border: 1px solid #ff6644; cursor: pointer;
      font-family: monospace; font-size: 12px;
    `;
    deleteBtn.onclick = onDelete;
    this.el.appendChild(deleteBtn);
  }

  private renderKeyBindings(t: ThrusterConfig) {
    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;';

    for (let i = 0; i < t.keys.length; i++) {
      const tag = document.createElement('span');
      tag.style.cssText = `
        background: #222; border: 1px solid #555; padding: 2px 6px;
        display: flex; align-items: center; gap: 4px;
      `;
      tag.textContent = this.formatKey(t.keys[i]);
      const x = document.createElement('span');
      x.textContent = 'x';
      x.style.cssText = 'cursor: pointer; color: #f66; margin-left: 4px;';
      const idx = i;
      x.onclick = () => {
        t.keys.splice(idx, 1);
        this.onChange();
        this.refresh();
      };
      tag.appendChild(x);
      list.appendChild(tag);
    }
    this.el.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.textContent = this.listeningForKey ? 'Press a key...' : 'Add Key';
    addBtn.style.cssText = `
      padding: 4px 12px; background: #222; border: 1px solid #555;
      color: #ccc; cursor: pointer; font-family: monospace; font-size: 12px;
    `;
    addBtn.onclick = () => {
      this.startKeyListen((key) => {
        if (!t.keys.includes(key)) {
          t.keys.push(key);
          this.onChange();
        }
        this.refresh();
      });
      addBtn.textContent = 'Press a key...';
      addBtn.style.borderColor = '#ff8c00';
    };
    this.el.appendChild(addBtn);
  }

  private renderGamepadBindings(t: ThrusterConfig) {
    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;';

    for (let i = 0; i < t.gamepadButtons.length; i++) {
      const tag = document.createElement('span');
      tag.style.cssText = `
        background: #222; border: 1px solid #555; padding: 2px 6px;
        display: flex; align-items: center; gap: 4px;
      `;
      tag.textContent = `Btn ${t.gamepadButtons[i]}`;
      const x = document.createElement('span');
      x.textContent = 'x';
      x.style.cssText = 'cursor: pointer; color: #f66; margin-left: 4px;';
      const idx = i;
      x.onclick = () => {
        t.gamepadButtons.splice(idx, 1);
        this.onChange();
        this.refresh();
      };
      tag.appendChild(x);
      list.appendChild(tag);
    }
    this.el.appendChild(list);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '17';
    input.placeholder = 'Button #';
    input.style.cssText = `
      width: 70px; padding: 4px; background: #222; border: 1px solid #555;
      color: #ccc; font-family: monospace; font-size: 12px;
    `;
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.style.cssText = `
      padding: 4px 8px; margin-left: 4px; background: #222; border: 1px solid #555;
      color: #ccc; cursor: pointer; font-family: monospace; font-size: 12px;
    `;
    addBtn.onclick = () => {
      const v = parseInt(input.value);
      if (!isNaN(v) && v >= 0 && !t.gamepadButtons.includes(v)) {
        t.gamepadButtons.push(v);
        input.value = '';
        this.onChange();
      }
    };
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center;';
    row.appendChild(input);
    row.appendChild(addBtn);
    this.el.appendChild(row);
  }

  private refresh() {
    if (this.currentConfig && this.currentThrusterIndex >= 0 && this.currentOnDelete) {
      this.renderThrusterProps(this.currentConfig, this.currentThrusterIndex, this.currentOnDelete);
    } else if (this.currentConfig) {
      this.renderShipProps(this.currentConfig);
    }
  }

  isListeningForKey(): boolean {
    return this.listeningForKey;
  }

  private startKeyListen(onKey: (key: string) => void) {
    this.stopKeyListen();
    this.listeningForKey = true;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.stopKeyListen();
      onKey(e.key);
    };
    window.addEventListener('keydown', handler, {capture: true});
    this.keyListenerCleanup = () => {
      window.removeEventListener('keydown', handler, {capture: true});
    };
  }

  private stopKeyListen() {
    if (this.keyListenerCleanup) {
      this.keyListenerCleanup();
      this.keyListenerCleanup = undefined;
    }
    this.listeningForKey = false;
  }

  private formatKey(key: string): string {
    const map: Record<string, string> = {
      'ArrowLeft': '\u2190', 'ArrowRight': '\u2192',
      'ArrowUp': '\u2191', 'ArrowDown': '\u2193',
      ' ': 'Space',
    };
    return map[key] ?? key;
  }

  private addHeader(text: string) {
    const h = document.createElement('div');
    h.textContent = text;
    h.style.cssText = 'color: #ff8c00; font-weight: bold; margin: 8px 0 6px;';
    this.el.appendChild(h);
  }

  private addDivider() {
    const d = document.createElement('hr');
    d.style.cssText = 'border: none; border-top: 1px solid #333; margin: 12px 0;';
    this.el.appendChild(d);
  }

  private addNumberField(
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
    step = 1,
  ) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin: 4px 0;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.color = '#888';
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.style.cssText = `
      width: 70px; padding: 2px 4px; background: #222; border: 1px solid #444;
      color: #ccc; font-family: monospace; font-size: 12px; text-align: right;
    `;
    input.oninput = () => {
      const v = parseFloat(input.value);
      if (!isNaN(v)) onChange(v);
    };
    row.appendChild(lbl);
    row.appendChild(input);
    this.el.appendChild(row);
  }
}
