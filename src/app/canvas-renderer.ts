import {Spaceship, GameObject} from './game-objects/game-object';

const FLAME_COLORS = ['#ff8c00', '#ffa500', '#ffb733', '#ffd066'];

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

  render(spaceship: Spaceship) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawSpaceship(spaceship);
  }

  private drawSpaceship(ship: Spaceship) {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(ship.position.x, ship.position.y);
    ctx.rotate(ship.rotation);
    ctx.translate(-ship.origin.x, -ship.origin.y);

    // Ship body
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, ship.width, ship.height);

    // Thrusters
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

    // Thruster body
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, thruster.width, thruster.height);

    // Thrust flame
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
}
