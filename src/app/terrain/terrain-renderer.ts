import {CaveGrid} from './cave-grid';
import {MarchingSquares} from './marching-squares';
import {Camera} from '../camera';

const ROCK_BASE_COLOR = '#37342f';
const ROCK_RIM_DARK = '#201d19';
const ROCK_RIM_LIGHT = '#6a6258';
const TILE_SIZE = 512; // pixels

export class TerrainRenderer {
  private tileCache = new Map<string, OffscreenCanvas>();
  private tileCols: number;
  private tileRows: number;

  constructor(
    private grid: CaveGrid,
    private marchingSquares: MarchingSquares,
  ) {
    const worldWidth = grid.config.cols * grid.config.cellSize;
    const worldHeight = grid.config.rows * grid.config.cellSize;
    this.tileCols = Math.ceil(worldWidth / TILE_SIZE);
    this.tileRows = Math.ceil(worldHeight / TILE_SIZE);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const rect = camera.getVisibleRect();

    // Visible tile range
    const startTX = Math.max(0, Math.floor(rect.x / TILE_SIZE));
    const startTY = Math.max(0, Math.floor(rect.y / TILE_SIZE));
    const endTX = Math.min(this.tileCols - 1, Math.floor((rect.x + rect.width) / TILE_SIZE));
    const endTY = Math.min(this.tileRows - 1, Math.floor((rect.y + rect.height) / TILE_SIZE));

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const tile = this.getTile(tx, ty);
        ctx.drawImage(tile, tx * TILE_SIZE, ty * TILE_SIZE);
      }
    }
  }

  private getTile(tx: number, ty: number): OffscreenCanvas {
    const key = `${tx},${ty}`;
    let tile = this.tileCache.get(key);
    if (tile) return tile;

    tile = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const ctx = tile.getContext('2d')!;

    const cellSize = this.grid.config.cellSize;
    const worldX = tx * TILE_SIZE;
    const worldY = ty * TILE_SIZE;

    // Cell range covered by this tile
    const startX = Math.max(0, Math.floor(worldX / cellSize) - 1);
    const startY = Math.max(0, Math.floor(worldY / cellSize) - 1);
    const endX = Math.min(this.grid.config.cols - 1, Math.ceil((worldX + TILE_SIZE) / cellSize) + 1);
    const endY = Math.min(this.grid.config.rows - 1, Math.ceil((worldY + TILE_SIZE) / cellSize) + 1);

    // Translate so world coords map into the tile canvas
    ctx.translate(-worldX, -worldY);

    this.buildSolidPath(ctx, startX, startY, endX, endY);
    ctx.fillStyle = ROCK_BASE_COLOR;
    ctx.fill();

    // Broad layered shading for a natural stone body.
    ctx.save();
    this.buildSolidPath(ctx, startX, startY, endX, endY);
    ctx.clip();

    const topLight = ctx.createLinearGradient(0, 0, 0, this.grid.worldHeight);
    topLight.addColorStop(0, 'rgba(238, 232, 220, 0.08)');
    topLight.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    topLight.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    ctx.fillStyle = topLight;
    ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

    const sideLight = ctx.createLinearGradient(0, 0, this.grid.worldWidth, 0);
    sideLight.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
    sideLight.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
    sideLight.addColorStop(1, 'rgba(220, 210, 195, 0.07)');
    ctx.fillStyle = sideLight;
    ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

    this.drawRockTones(ctx, startX, startY, endX, endY);
    ctx.restore();

    this.drawContours(ctx, startX, startY, endX, endY);

    this.tileCache.set(key, tile);
    return tile;
  }

  private buildSolidPath(ctx: OffscreenCanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number): void {
    ctx.beginPath();
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const verts = this.marchingSquares.getCellFillVertices(x, y);
        if (!verts) continue;
        ctx.moveTo(verts[0], verts[1]);
        for (let i = 2; i < verts.length; i += 2) {
          ctx.lineTo(verts[i], verts[i + 1]);
        }
        ctx.closePath();
      }
    }
  }

  private drawContours(ctx: OffscreenCanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number): void {
    // Dark outer rim.
    ctx.strokeStyle = ROCK_RIM_DARK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const segments = this.marchingSquares.getCellSegments(x, y);
        for (const seg of segments) {
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        }
      }
    }
    ctx.stroke();

    // Softer inner highlight.
    ctx.strokeStyle = ROCK_RIM_LIGHT;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawRockTones(ctx: OffscreenCanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number): void {
    const cellSize = this.grid.config.cellSize;

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const wx = x * cellSize;
        const wy = y * cellSize;
        const cx = wx + cellSize * 0.5;
        const cy = wy + cellSize * 0.5;
        if (!this.grid.isWorldPointSolid(cx, cy)) continue;

        const n = (this.grid.getNoiseValue(x, y) + 1) * 0.5; // 0..1
        const h = this.hash2(x, y);

        // Cell-scale tonal variation (subtle, avoids noisy speckles).
        const warm = (h & 3) * 2;
        const shade = 24 + Math.round(n * 28);
        ctx.fillStyle = `rgba(${shade + 10 + warm}, ${shade + 8}, ${shade + 4}, 0.14)`;
        ctx.fillRect(wx, wy, cellSize, cellSize);

        // Occasional soft darker blotches to break uniformity.
        if ((h & 15) === 3) {
          const r = cellSize * (0.7 + (((h >> 5) & 7) / 10));
          const ox = ((((h >> 8) & 15) / 15) - 0.5) * cellSize * 0.6;
          const oy = ((((h >> 12) & 15) / 15) - 0.5) * cellSize * 0.6;
          const g = ctx.createRadialGradient(cx + ox, cy + oy, r * 0.2, cx + ox, cy + oy, r);
          g.addColorStop(0, 'rgba(20, 18, 16, 0.14)');
          g.addColorStop(1, 'rgba(20, 18, 16, 0)');
          ctx.fillStyle = g;
          ctx.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
        }
      }
    }
  }

  private hash2(x: number, y: number): number {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return h ^ (h >> 16);
  }
}
