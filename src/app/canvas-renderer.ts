import {Spaceship, GameObject} from './game-objects/game-object';
import {Camera} from './camera';
import {TerrainRenderer} from './terrain/terrain-renderer';
import {GamePath, PathProximity} from './terrain/path-generator';
import {Vector} from './vector';

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
}

const FLAME_COLORS = ['#ff8c00', '#ffa500', '#ffb733', '#ffd066'];
const BG_COLOR = '#0a0a1a';
const MAX_SCORING_DISTANCE = 120; // beyond this distance, no points

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

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

  private drawSpaceship(ship: Spaceship) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(ship.position.x, ship.position.y);
    ctx.rotate(ship.rotation);
    ctx.translate(-ship.origin.x, -ship.origin.y);

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, ship.width, ship.height);

    for (const thruster of ship.thrusters) {
      this.drawThruster(thruster);
    }

    ctx.restore();
  }

  private drawThruster(thruster: GameObject) {
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

  private drawFlame(thruster: GameObject) {
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
    const boxH = 240;
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

    // Restart hint
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText('Refresh to play again', cx, cy + 100);
  }
}
