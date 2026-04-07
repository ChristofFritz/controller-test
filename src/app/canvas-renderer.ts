import {Spaceship, GameObject} from './game-objects/game-object';
import {Camera} from './camera';
import {TerrainRenderer} from './terrain/terrain-renderer';
import {GamePath, PathProximity} from './terrain/path-generator';
import {Vector} from './vector';
import {ShipConfig, ThrusterConfig} from './ship-config';

export interface RenderState {
  path: GamePath;
  proximity?: PathProximity;
  nextCheckpoint: number;
  reachedCheckpoints: number;
  skippedCheckpoints: number;
  proximityMultiplier: number;
  finished: boolean;
  finalScore: number;
  fps: number;
  version: string;
  seed: string;
}

const FLAME_COLORS = ['#ff8c00', '#ffa500', '#ffb733', '#ffd066'];
const BG_COLOR = '#0a0a1a';
const MAX_SCORING_DISTANCE = 120; // beyond this distance, no points

export class CanvasRenderer {
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;

  // Button bounds for hit testing
  private playBtnBounds = {x: 0, y: 0, w: 0, h: 0};
  private editorBtnBounds = {x: 0, y: 0, w: 0, h: 0};
  private menuBtnBounds = {x: 0, y: 0, w: 0, h: 0};
  private seedBounds = {x: 0, y: 0, w: 0, h: 0};
  private seedCopiedAnimStart = 0;
  private readonly seedCopiedAnimDurationMs = 700;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(
    spaceship: Spaceship,
    camera: Camera,
    terrainRenderer: TerrainRenderer,
    state: RenderState,
  ) {
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, this.width, this.height);

    // Camera transform
    ctx.save();
    ctx.translate(
      this.width / 2 - camera.position.x,
      this.height / 2 - camera.position.y,
    );

    // Terrain
    terrainRenderer.draw(ctx, camera);

    // Path with checkpoint status
    this.drawPath(state.path, state.nextCheckpoint);

    // Distance line
    if (state.proximity) {
      this.drawProximityLine(spaceship.position, state.proximity);
    }

    // Ship
    this.drawSpaceship(spaceship);

    ctx.restore();

    // HUD (screen-space)
    this.drawHealthBar(spaceship);
    this.drawGameHud(state);

    // Finish overlay
    if (state.finished) {
      this.drawFinishScreen(state);
    }
  }

  drawStartScreen(shipConfig: ShipConfig) {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, this.width, this.height);

    // Title
    ctx.fillStyle = '#ff8c00';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLLOW BURN', cx, cy - 250);

    // Subtitle
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText('Navigate the caves. Hit the checkpoints. Reach the goal.', cx, cy - 210);

    // Ship diagram with key labels
    this.drawShipDiagram(ctx, cx, cy - 20, shipConfig);

    // Buttons
    const btnW = 180;
    const btnH = 40;
    const btnY = cy + 200;
    const btnGap = 20;

    // Play button
    this.playBtnBounds = {x: cx - btnW - btnGap / 2, y: btnY, w: btnW, h: btnH};
    ctx.fillStyle = '#ff8c00';
    ctx.fillRect(this.playBtnBounds.x, btnY, btnW, btnH);
    ctx.fillStyle = '#0a0a1a';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PLAY', cx - btnW / 2 - btnGap / 2, btnY + btnH / 2);

    // Edit Ship button
    this.editorBtnBounds = {x: cx + btnGap / 2, y: btnY, w: btnW, h: btnH};
    ctx.strokeStyle = '#ff8c00';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.editorBtnBounds.x, btnY, btnW, btnH);
    ctx.fillStyle = '#ff8c00';
    ctx.fillText('EDIT SHIP', cx + btnW / 2 + btnGap / 2, btnY + btnH / 2);

    // Hint
    ctx.fillStyle = '#444';
    ctx.font = '12px monospace';
    ctx.fillText('or press any key to play', cx, btnY + btnH + 24);
  }

  getStartScreenAction(mx: number, my: number): 'play' | 'editor' | null {
    const b = this.playBtnBounds;
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return 'play';
    const e = this.editorBtnBounds;
    if (mx >= e.x && mx <= e.x + e.w && my >= e.y && my <= e.y + e.h) return 'editor';
    return null;
  }

  private drawShipDiagram(ctx: CanvasRenderingContext2D, cx: number, cy: number, config: ShipConfig) {
    const scale = 5;
    const ship = config;

    ctx.save();
    ctx.translate(cx, cy);

    // Faint grid lines behind ship
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 0.5;
    const gridExtent = 100;
    const gridStep = 10 * scale;
    ctx.beginPath();
    for (let x = -gridExtent; x <= gridExtent; x += gridStep) {
      ctx.moveTo(x, -gridExtent);
      ctx.lineTo(x, gridExtent);
    }
    for (let y = -gridExtent; y <= gridExtent; y += gridStep) {
      ctx.moveTo(-gridExtent, y);
      ctx.lineTo(gridExtent, y);
    }
    ctx.stroke();

    // Ship hull
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      -ship.origin.x * scale,
      -ship.origin.y * scale,
      ship.width * scale,
      ship.height * scale,
    );

    // Thrusters + key labels
    for (const t of config.thrusters) {
      this.drawDiagramThruster(ctx, t, scale);
    }

    ctx.restore();
  }

  private drawDiagramThruster(ctx: CanvasRenderingContext2D, t: ThrusterConfig, scale: number) {
    // Thruster body
    const tx = t.position.x * scale;
    const ty = t.position.y * scale;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(t.rotation);
    ctx.translate(-t.origin.x * scale, -t.origin.y * scale);

    ctx.strokeStyle = '#8bf';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, t.width * scale, t.height * scale);

    // Thrust direction indicator
    const dirLen = Math.sqrt(t.thrustDirection.x ** 2 + t.thrustDirection.y ** 2);
    if (dirLen > 0) {
      const arrowLen = Math.min(dirLen * 0.8, 12) * scale;
      const nx = t.thrustDirection.x / dirLen;
      const ny = t.thrustDirection.y / dirLen;
      const ox = t.origin.x * scale;
      const oy = t.origin.y * scale;
      ctx.strokeStyle = '#8bf44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + nx * arrowLen, oy + ny * arrowLen);
      ctx.stroke();
    }

    ctx.restore();

    // Key labels — position them outward from ship center
    if (t.keys.length === 0 && t.gamepadButtons.length === 0) return;

    const labelText = this.formatBindings(t);

    // Compute label anchor: extend outward from center
    const angle = Math.atan2(ty, tx);
    const dist = Math.sqrt(tx * tx + ty * ty);
    const labelDist = dist + 50;
    const lx = Math.cos(angle) * labelDist;
    const ly = Math.sin(angle) * labelDist;

    // Connector line
    ctx.strokeStyle = '#8bf';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Key badge
    ctx.fillStyle = '#0a0a1a';
    ctx.strokeStyle = '#8bf';
    ctx.lineWidth = 1;
    ctx.font = '11px monospace';
    const measuredWidth = ctx.measureText(labelText).width;
    const padX = 8;
    const padY = 4;
    const badgeW = measuredWidth + padX * 2;
    const badgeH = 14 + padY * 2;
    const badgeX = lx - badgeW / 2;
    const badgeY = ly - badgeH / 2;

    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

    ctx.fillStyle = '#8bf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, lx, ly);
  }

  private formatBindings(t: ThrusterConfig): string {
    const parts: string[] = [];
    for (const key of t.keys) {
      parts.push(this.formatKeyName(key));
    }
    for (const btn of t.gamepadButtons) {
      parts.push(`GP${btn}`);
    }
    return parts.join(' / ');
  }

  private formatKeyName(key: string): string {
    const map: Record<string, string> = {
      'ArrowLeft': '\u2190', 'ArrowRight': '\u2192',
      'ArrowUp': '\u2191', 'ArrowDown': '\u2193',
      ' ': 'Space',
    };
    return map[key] ?? key.toUpperCase();
  }

  drawSpaceship(ship: Spaceship) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(ship.position.x, ship.position.y);
    ctx.rotate(ship.rotation);
    ctx.translate(-ship.origin.x, -ship.origin.y);

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, ship.width, ship.height);
    this.drawForwardIndicator(ship);

    for (const thruster of ship.thrusters) {
      this.drawThruster(thruster);
    }

    ctx.restore();
  }

  drawThruster(thruster: GameObject) {
    const ctx = this.ctx;
    const pos = thruster.cssPosition;

    ctx.save();
    ctx.translate(pos.x + thruster.origin.x, pos.y + thruster.origin.y);
    ctx.rotate(thruster.rotation);
    ctx.translate(-thruster.origin.x, -thruster.origin.y);

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, thruster.width, thruster.height);

    if (thruster.thrust > 0) {
      this.drawFlame(thruster);
    }

    ctx.restore();
  }

  drawFlame(thruster: GameObject) {
    const ctx = this.ctx;
    const intensity = thruster.thrust;

    for (let i = 0; i < FLAME_COLORS.length; i++) {
      const yOffset = thruster.height + (i + 1) * 5 * intensity;
      const shrink = i * 0.5;
      const rectWidth = Math.max(thruster.width - shrink * 2, 1);
      const xOffset = (thruster.width - rectWidth) / 2;

      ctx.fillStyle = FLAME_COLORS[i];
      ctx.globalAlpha = Math.max(1 - i * 0.2, 0.3);
      ctx.fillRect(xOffset, yOffset - 1, rectWidth, 2);
    }

    ctx.globalAlpha = 1;
  }

  private drawForwardIndicator(ship: Spaceship) {
    const ctx = this.ctx;
    const centerX = ship.origin.x;
    const headY = -36;
    const headSize = 8;

    ctx.strokeStyle = '#7df9ff';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(centerX, headY - headSize);
    ctx.lineTo(centerX - headSize, headY + headSize);
    ctx.lineTo(centerX + headSize, headY + headSize);
    ctx.closePath();
    ctx.stroke();
  }

  private drawProximityLine(shipPos: Vector, proximity: PathProximity) {
    const ctx = this.ctx;
    const t = Math.min(proximity.distance / MAX_SCORING_DISTANCE, 1);

    // Color: green (close) -> yellow -> red (far)
    const r = Math.floor(Math.min(t * 2, 1) * 255);
    const g = Math.floor(Math.min((1 - t) * 2, 1) * 255);
    const color = `rgb(${r}, ${g}, 0)`;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(shipPos.x, shipPos.y);
    ctx.lineTo(proximity.closestPoint.x, proximity.closestPoint.y);
    ctx.stroke();

    // Small dot at closest point
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(proximity.closestPoint.x, proximity.closestPoint.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }

  private drawPath(path: GamePath, nextCheckpoint: number) {
    const ctx = this.ctx;
    const pts = path.points;
    if (pts.length < 2) return;

    // Draw path segments as dashed lines
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw waypoints with status colors
    for (let i = 1; i < pts.length - 1; i++) {
      let fillColor: string;
      let strokeColor: string;
      if (i < nextCheckpoint) {
        // Already passed
        fillColor = 'rgba(0, 200, 60, 0.6)';
        strokeColor = '#00cc44';
      } else if (i === nextCheckpoint) {
        // Next target
        fillColor = 'rgba(255, 220, 50, 0.7)';
        strokeColor = '#ffdd33';
      } else {
        // Upcoming
        fillColor = 'rgba(100, 180, 255, 0.4)';
        strokeColor = 'rgba(100, 180, 255, 0.7)';
      }

      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, i === nextCheckpoint ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Start marker (green)
    this.drawMarker(path.start, '#00cc44', 'S');

    // Goal marker
    const goalColor = nextCheckpoint >= pts.length - 1 ? '#ffdd33' : '#ff3344';
    this.drawMarker(path.goal, goalColor, 'G');

    ctx.restore();
  }

  private drawMarker(pos: import('./vector').Vector, color: string, label: string) {
    const ctx = this.ctx;
    const radius = 14;

    // Outer ring
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color + '33';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    ctx.fillStyle = color;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, pos.x, pos.y - radius - 4);
  }

  private drawHealthBar(ship: Spaceship) {
    const ctx = this.ctx;
    const barWidth = 200;
    const barHeight = 12;
    const x = this.width - barWidth - 20;
    const y = 20;
    const healthPct = ship.health / ship.maxHealth;

    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barWidth, barHeight);

    const green = Math.floor(healthPct * 255);
    const red = 255 - green;
    ctx.fillStyle = `rgb(${red}, ${green}, 0)`;
    ctx.fillRect(x, y, barWidth * healthPct, barHeight);

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
  }

  private drawGameHud(state: RenderState) {
    const ctx = this.ctx;

    // Version and FPS
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`v${state.version}  FPS: ${state.fps}`, 10, 10);

    const x = this.width - 220;
    let y = 40;

    // Checkpoints
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Checkpoints: ${state.reachedCheckpoints}/${state.path.points.length - 2}`, x, y);
    y += 18;

    if (state.skippedCheckpoints > 0) {
      ctx.fillStyle = '#ff6644';
      ctx.fillText(`Skipped: ${state.skippedCheckpoints}`, x, y);
      y += 18;
    }

    // Proximity multiplier
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Multiplier: x${state.proximityMultiplier.toFixed(2)}`, x, y);
    y += 22;

    // Proximity bar
    if (state.proximity) {
      const barWidth = 200;
      const barHeight = 8;
      const t = Math.min(state.proximity.distance / MAX_SCORING_DISTANCE, 1);
      const fill = 1 - t;

      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, barWidth, barHeight);

      const r = Math.floor(Math.min(t * 2, 1) * 255);
      const g = Math.floor(Math.min((1 - t) * 2, 1) * 255);
      ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
      ctx.fillRect(x, y, barWidth * fill, barHeight);

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);
    }

    const seedText = `Seed: ${state.seed}`;
    const seedHint = '(click to copy)';
    ctx.font = '12px monospace';
    const seedMetrics = ctx.measureText(seedText);
    const hintMetrics = ctx.measureText(seedHint);
    const sx = 10;
    const sy = this.height - 16;
    const fullWidth = seedMetrics.width + 8 + hintMetrics.width;
    this.seedBounds = {x: sx - 8, y: sy - 14, w: fullWidth + 16, h: 22};

    ctx.fillStyle = '#8bf';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(seedText, sx, sy);

    ctx.fillStyle = '#666';
    ctx.fillText(seedHint, sx + seedMetrics.width + 8, sy);

    const elapsed = Date.now() - this.seedCopiedAnimStart;
    if (elapsed >= 0 && elapsed < this.seedCopiedAnimDurationMs) {
      const t = elapsed / this.seedCopiedAnimDurationMs;
      const yLift = 6 * t;
      const alpha = 1 - t;
      ctx.fillStyle = `rgba(120, 255, 150, ${alpha.toFixed(3)})`;
      ctx.fillText('Copied!', sx, sy - 18 - yLift);
    }
  }

  private drawFinishScreen(state: RenderState) {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;

    // Dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, this.width, this.height);

    // Box
    const boxW = 360;
    const boxH = 265;
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    // Title
    ctx.fillStyle = '#ffdd33';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GOAL REACHED', cx, cy - 80);

    // Breakdown
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    const lx = cx - 140;

    ctx.fillStyle = '#0c6';
    ctx.fillText(`Checkpoints reached:  ${state.reachedCheckpoints}  (+${state.reachedCheckpoints * 100})`, lx, cy - 40);

    ctx.fillStyle = state.skippedCheckpoints > 0 ? '#f64' : '#888';
    ctx.fillText(`Checkpoints skipped:  ${state.skippedCheckpoints}  (-${state.skippedCheckpoints * 150})`, lx, cy - 16);

    ctx.fillStyle = '#8bf';
    ctx.fillText(`Proximity multiplier: x${state.proximityMultiplier.toFixed(2)}`, lx, cy + 8);

    // Divider
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(lx, cy + 30);
    ctx.lineTo(lx + 280, cy + 30);
    ctx.stroke();

    // Final score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.finalScore} pts`, cx, cy + 60);

    // Main menu button
    const btnW = 200;
    const btnH = 36;
    const btnX = cx - btnW / 2;
    const btnY = cy + 85;
    this.menuBtnBounds = {x: btnX, y: btnY, w: btnW, h: btnH};
    ctx.strokeStyle = '#ffdd33';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#ffdd33';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAIN MENU', cx, btnY + btnH / 2);
  }

  getFinishScreenAction(mx: number, my: number): 'menu' | null {
    const b = this.menuBtnBounds;
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return 'menu';
    return null;
  }

  isSeedClicked(mx: number, my: number): boolean {
    const b = this.seedBounds;
    return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  }

  triggerSeedCopiedAnimation(): void {
    this.seedCopiedAnimStart = Date.now();
  }
}
