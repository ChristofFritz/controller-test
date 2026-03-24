import {Spaceship, GameObject} from './game-objects/game-object';
import {Camera} from './camera';
import {TerrainRenderer} from './terrain/terrain-renderer';

const FLAME_COLORS = ['#ff8c00', '#ffa500', '#ffb733', '#ffd066'];
const BG_COLOR = '#0a0a1a';

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

  render(spaceship: Spaceship, camera: Camera, terrainRenderer: TerrainRenderer) {
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

    // Ship
    this.drawSpaceship(spaceship);

    ctx.restore();

    // HUD (screen-space)
    this.drawHealthBar(spaceship);
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
}
