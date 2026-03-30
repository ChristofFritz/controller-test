import {ShipConfig, ThrusterConfig} from '../ship-config';
import {InputState} from '../input-state';

const BG_COLOR = '#0a0a1a';
const GRID_COLOR = '#1a1a2e';
const SHIP_COLOR = '#ccc';
const THRUSTER_COLOR = '#ccc';
const SELECTED_COLOR = '#ff8c00';
const HANDLE_SIZE = 6;
const FLAME_COLORS = ['#ff8c00', '#ffa500', '#ffb733', '#ffd066'];

export interface EditorButton {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class EditorRenderer {
  private buttons: EditorButton[] = [];

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    config: ShipConfig,
    selectedThruster: number,
    scale: number,
    input: InputState,
  ): void {
    const cx = w / 2 - 120; // offset left to leave room for properties panel
    const cy = h / 2;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Grid
    this.drawGrid(ctx, w, h, cx, cy, scale);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Ship hull
    const ship = config;
    ctx.strokeStyle = SHIP_COLOR;
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeRect(-ship.origin.x, -ship.origin.y, ship.width, ship.height);

    // Resize handles
    ctx.fillStyle = '#666';
    const hs = HANDLE_SIZE / scale;
    const sx = -ship.origin.x;
    const sy = -ship.origin.y;
    // corners
    for (const [hx, hy] of [
      [sx, sy], [sx + ship.width, sy],
      [sx, sy + ship.height], [sx + ship.width, sy + ship.height],
    ]) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }

    // Thrusters
    for (let i = 0; i < config.thrusters.length; i++) {
      this.drawEditorThruster(ctx, config.thrusters[i], i === selectedThruster, scale, input);
    }

    // Origin crosshair
    ctx.strokeStyle = '#ff8c0066';
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    ctx.moveTo(-8 / scale, 0);
    ctx.lineTo(8 / scale, 0);
    ctx.moveTo(0, -8 / scale);
    ctx.lineTo(0, 8 / scale);
    ctx.stroke();

    ctx.restore();

    // Toolbar
    this.drawToolbar(ctx, w, h);

    // Title
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SHIP EDITOR', cx, 16);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, scale: number) {
    const gridStep = 10 * scale;
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = cx % gridStep; x < w; x += gridStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = cy % gridStep; y < h; y += gridStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private drawEditorThruster(
    ctx: CanvasRenderingContext2D,
    t: ThrusterConfig,
    selected: boolean,
    scale: number,
    input: InputState,
  ) {
    ctx.save();
    ctx.translate(t.position.x, t.position.y);
    ctx.rotate(t.rotation);
    ctx.translate(-t.origin.x, -t.origin.y);

    // Thruster body
    ctx.strokeStyle = selected ? SELECTED_COLOR : THRUSTER_COLOR;
    ctx.lineWidth = (selected ? 2 : 1) / scale;
    ctx.strokeRect(0, 0, t.width, t.height);

    // Test fire
    const thrust = input.getThrustForBindings(t.keys, t.gamepadButtons);
    if (thrust > 0) {
      this.drawFlame(ctx, t, thrust);
    }

    // Thrust direction arrow
    ctx.strokeStyle = '#4488ff44';
    ctx.lineWidth = 1 / scale;
    const dirLen = Math.sqrt(t.thrustDirection.x ** 2 + t.thrustDirection.y ** 2);
    const arrowLen = Math.min(dirLen, 15);
    const nx = t.thrustDirection.x / (dirLen || 1);
    const ny = t.thrustDirection.y / (dirLen || 1);
    ctx.beginPath();
    ctx.moveTo(t.origin.x, t.origin.y);
    ctx.lineTo(t.origin.x + nx * arrowLen, t.origin.y + ny * arrowLen);
    ctx.stroke();

    ctx.restore();

    // Selection handles
    if (selected) {
      // Rotation handle
      const handleDist = 20 / scale;
      const rx = t.position.x + Math.cos(t.rotation - Math.PI / 2) * handleDist;
      const ry = t.position.y + Math.sin(t.rotation - Math.PI / 2) * handleDist;
      ctx.fillStyle = SELECTED_COLOR;
      ctx.beginPath();
      ctx.arc(rx, ry, 4 / scale, 0, Math.PI * 2);
      ctx.fill();

      // Line to rotation handle
      ctx.strokeStyle = SELECTED_COLOR + '66';
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(t.position.x, t.position.y);
      ctx.lineTo(rx, ry);
      ctx.stroke();
    }
  }

  private drawFlame(ctx: CanvasRenderingContext2D, t: ThrusterConfig, intensity: number) {
    for (let i = 0; i < FLAME_COLORS.length; i++) {
      const yOffset = t.height + (i + 1) * 5 * intensity;
      const shrink = i * 0.5;
      const rectWidth = Math.max(t.width - shrink * 2, 1);
      const xOffset = (t.width - rectWidth) / 2;
      ctx.fillStyle = FLAME_COLORS[i];
      ctx.globalAlpha = Math.max(1 - i * 0.2, 0.3);
      ctx.fillRect(xOffset, yOffset - 1, rectWidth, 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawToolbar(ctx: CanvasRenderingContext2D, w: number, h: number) {
    this.buttons = [];
    const btnW = 140;
    const btnH = 32;
    const btnY = h - 50;
    const cx = w / 2 - 120;
    const gap = 12;
    const labels = ['Add Thruster', 'Import', 'Export', 'Back'];
    const total = labels.length * btnW + (labels.length - 1) * gap;
    let x = cx - total / 2;

    for (const label of labels) {
      this.buttons.push({label, x, y: btnY, w: btnW, h: btnH});

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, btnY, btnW, btnH);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + btnW / 2, btnY + btnH / 2);

      x += btnW + gap;
    }
  }

  hitTestButton(mx: number, my: number): string | null {
    for (const btn of this.buttons) {
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        return btn.label;
      }
    }
    return null;
  }

  hitTestThruster(
    config: ShipConfig,
    mx: number,
    my: number,
    cx: number,
    cy: number,
    scale: number,
  ): number {
    // Convert screen coords to ship-local coords
    const lx = (mx - cx) / scale;
    const ly = (my - cy) / scale;

    for (let i = config.thrusters.length - 1; i >= 0; i--) {
      const t = config.thrusters[i];
      // Simple bounding box hit test (ignoring rotation for simplicity — close enough for selection)
      const dx = lx - t.position.x;
      const dy = ly - t.position.y;
      // Rotate point into thruster's local space
      const cos = Math.cos(-t.rotation);
      const sin = Math.sin(-t.rotation);
      const localX = dx * cos - dy * sin + t.origin.x;
      const localY = dx * sin + dy * cos + t.origin.y;
      const pad = 4;
      if (localX >= -pad && localX <= t.width + pad && localY >= -pad && localY <= t.height + pad) {
        return i;
      }
    }
    return -1;
  }

  hitTestRotationHandle(
    t: ThrusterConfig,
    mx: number,
    my: number,
    cx: number,
    cy: number,
    scale: number,
  ): boolean {
    const handleDist = 20 / scale;
    const rx = cx + (t.position.x + Math.cos(t.rotation - Math.PI / 2) * handleDist) * scale;
    const ry = cy + (t.position.y + Math.sin(t.rotation - Math.PI / 2) * handleDist) * scale;
    const dist = Math.sqrt((mx - rx) ** 2 + (my - ry) ** 2);
    return dist < 10;
  }

  hitTestShipEdge(
    config: ShipConfig,
    mx: number,
    my: number,
    cx: number,
    cy: number,
    scale: number,
  ): 'left' | 'right' | 'top' | 'bottom' | null {
    const lx = (mx - cx) / scale;
    const ly = (my - cy) / scale;
    const sx = -config.origin.x;
    const sy = -config.origin.y;
    const pad = 6 / scale;

    if (Math.abs(lx - sx) < pad && ly >= sy - pad && ly <= sy + config.height + pad) return 'left';
    if (Math.abs(lx - (sx + config.width)) < pad && ly >= sy - pad && ly <= sy + config.height + pad) return 'right';
    if (Math.abs(ly - sy) < pad && lx >= sx - pad && lx <= sx + config.width + pad) return 'top';
    if (Math.abs(ly - (sy + config.height)) < pad && lx >= sx - pad && lx <= sx + config.width + pad) return 'bottom';
    return null;
  }
}
