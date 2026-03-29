import {CaveGrid} from './cave-grid';
import {MarchingSquares} from './marching-squares';
import {Camera} from '../camera';

const SOLID_COLOR = '#2a1a0a';
const CONTOUR_COLOR = '#5a4a3a';
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

    // Fill solid polygons
    ctx.fillStyle = SOLID_COLOR;
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
    ctx.fill();

    // Draw contour lines
    ctx.strokeStyle = CONTOUR_COLOR;
    ctx.lineWidth = 1.5;
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

    this.tileCache.set(key, tile);
    return tile;
  }
}
