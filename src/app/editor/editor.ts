import {ShipConfig, ThrusterConfig, encodeShareString, decodeShareString, saveShipConfig} from '../ship-config';
import {InputState} from '../input-state';
import {EditorRenderer} from './editor-renderer';
import {PropertiesPanel} from './properties-panel';

type DragMode = 'none' | 'thruster' | 'rotate' | 'resize-left' | 'resize-right' | 'resize-top' | 'resize-bottom';

export class Editor {
  private renderer = new EditorRenderer();
  private panel: PropertiesPanel;
  private config!: ShipConfig;
  private onExit: (config: ShipConfig) => void;
  private selectedThruster = -1;
  private dragMode: DragMode = 'none';
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOrigX = 0;
  private dragOrigY = 0;
  private scale = 8;
  private input = new InputState();
  private active = false;
  private screenW = 0;
  private screenH = 0;

  constructor(container: HTMLElement, initialConfig: ShipConfig, onExit: (config: ShipConfig) => void) {
    this.onExit = onExit;
    this.config = structuredClone(initialConfig);
    this.panel = new PropertiesPanel(container, () => {
      saveShipConfig(this.config);
    });
  }

  enter(config: ShipConfig) {
    this.config = structuredClone(config);
    this.selectedThruster = -1;
    this.dragMode = 'none';
    this.active = true;
    this.panel.show();
    this.panel.renderShipProps(this.config);
  }

  exit() {
    this.active = false;
    this.panel.hide();
    this.onExit(this.config);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.active) return;
    this.screenW = w;
    this.screenH = h;
    this.renderer.draw(ctx, w, h, this.config, this.selectedThruster, this.scale, this.input);
  }

  handleKeyDown(e: KeyboardEvent) {
    if (!this.active) return;
    if (this.panel.isListeningForKey()) return;

    if (e.key === 'Escape') {
      if (this.selectedThruster >= 0) {
        this.selectThruster(-1);
      } else {
        this.exit();
      }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedThruster >= 0) {
        this.deleteThruster(this.selectedThruster);
      }
      return;
    }

    // Test fire
    this.input.keyDown(e.key);
  }

  handleKeyUp(e: KeyboardEvent) {
    if (!this.active) return;
    this.input.keyUp(e.key);
  }

  handleMouseDown(e: MouseEvent) {
    if (!this.active) return;
    const mx = e.offsetX;
    const my = e.offsetY;

    // Check toolbar buttons
    const btn = this.renderer.hitTestButton(mx, my);
    if (btn) {
      this.handleButton(btn);
      return;
    }

    const cx = this.screenW / 2 - 120;
    const cy = this.screenH / 2;

    // Check rotation handle first (if thruster selected)
    if (this.selectedThruster >= 0) {
      const t = this.config.thrusters[this.selectedThruster];
      if (this.renderer.hitTestRotationHandle(t, mx, my, cx, cy, this.scale)) {
        this.dragMode = 'rotate';
        return;
      }
    }

    // Check thruster hit
    const thrusterIdx = this.renderer.hitTestThruster(this.config, mx, my, cx, cy, this.scale);
    if (thrusterIdx >= 0) {
      this.selectThruster(thrusterIdx);
      this.dragMode = 'thruster';
      this.dragStartX = mx;
      this.dragStartY = my;
      this.dragOrigX = this.config.thrusters[thrusterIdx].position.x;
      this.dragOrigY = this.config.thrusters[thrusterIdx].position.y;
      return;
    }

    // Check ship edge resize
    const edge = this.renderer.hitTestShipEdge(this.config, mx, my, cx, cy, this.scale);
    if (edge) {
      this.dragMode = `resize-${edge}` as DragMode;
      this.dragStartX = mx;
      this.dragStartY = my;
      this.dragOrigX = this.config.width;
      this.dragOrigY = this.config.height;
      return;
    }

    // Click on empty space deselects
    this.selectThruster(-1);
  }

  handleMouseMove(e: MouseEvent) {
    if (!this.active || this.dragMode === 'none') return;
    const mx = e.offsetX;
    const my = e.offsetY;
    const cx = this.screenW / 2 - 120;
    const cy = this.screenH / 2;

    if (this.dragMode === 'thruster' && this.selectedThruster >= 0) {
      const dx = (mx - this.dragStartX) / this.scale;
      const dy = (my - this.dragStartY) / this.scale;
      const t = this.config.thrusters[this.selectedThruster];
      t.position.x = Math.round((this.dragOrigX + dx) * 2) / 2;
      t.position.y = Math.round((this.dragOrigY + dy) * 2) / 2;
      this.refreshPanel();
    }

    if (this.dragMode === 'rotate' && this.selectedThruster >= 0) {
      const t = this.config.thrusters[this.selectedThruster];
      const lx = (mx - cx) / this.scale - t.position.x;
      const ly = (my - cy) / this.scale - t.position.y;
      t.rotation = Math.atan2(ly, lx) + Math.PI / 2;
      this.refreshPanel();
    }

    if (this.dragMode.startsWith('resize-')) {
      const dx = (mx - this.dragStartX) / this.scale;
      const dy = (my - this.dragStartY) / this.scale;

      if (this.dragMode === 'resize-right') {
        this.config.width = Math.max(4, Math.round(this.dragOrigX + dx));
      } else if (this.dragMode === 'resize-left') {
        this.config.width = Math.max(4, Math.round(this.dragOrigX - dx));
        this.config.origin.x = this.config.width / 2;
      } else if (this.dragMode === 'resize-bottom') {
        this.config.height = Math.max(4, Math.round(this.dragOrigY + dy));
      } else if (this.dragMode === 'resize-top') {
        this.config.height = Math.max(4, Math.round(this.dragOrigY - dy));
        this.config.origin.y = this.config.height / 2;
      }
      this.refreshPanel();
    }
  }

  handleMouseUp(_e: MouseEvent) {
    this.dragMode = 'none';
  }

  private selectThruster(index: number) {
    this.selectedThruster = index;
    if (index >= 0) {
      this.panel.renderThrusterProps(this.config, index, () => this.deleteThruster(index));
    } else {
      this.panel.renderShipProps(this.config);
    }
  }

  private deleteThruster(index: number) {
    this.config.thrusters.splice(index, 1);
    this.selectedThruster = -1;
    this.panel.renderShipProps(this.config);
    saveShipConfig(this.config);
  }

  private addThruster() {
    const t: ThrusterConfig = {
      position: {x: 0, y: 0},
      width: 4,
      height: 6,
      rotation: 0,
      origin: {x: 2, y: 3},
      thrustOrigin: {x: 0, y: 3},
      thrustDirection: {x: 0, y: 10},
      keys: [],
      gamepadButtons: [],
    };
    this.config.thrusters.push(t);
    this.selectThruster(this.config.thrusters.length - 1);
    saveShipConfig(this.config);
  }

  private handleButton(label: string) {
    if (label === 'Back') {
      this.exit();
    } else if (label === 'Add Thruster') {
      this.addThruster();
    } else if (label === 'Export') {
      const str = encodeShareString(this.config);
      navigator.clipboard.writeText(str).then(() => {
        // Could show a toast, but for now just log
        console.log('Ship config copied to clipboard');
      });
    } else if (label === 'Import') {
      const str = prompt('Paste ship config string:');
      if (str) {
        const config = decodeShareString(str);
        if (config) {
          this.config = config;
          this.selectedThruster = -1;
          this.panel.renderShipProps(this.config);
          saveShipConfig(this.config);
        } else {
          alert('Invalid ship config string');
        }
      }
    }
  }

  private refreshPanel() {
    if (this.selectedThruster >= 0) {
      this.panel.renderThrusterProps(this.config, this.selectedThruster, () => this.deleteThruster(this.selectedThruster));
    } else {
      this.panel.renderShipProps(this.config);
    }
    saveShipConfig(this.config);
  }
}
