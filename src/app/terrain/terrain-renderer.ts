import {CaveGrid} from './cave-grid';
import {MarchingSquares} from './marching-squares';
import {Camera} from '../camera';

const SOLID_COLOR = '#2a1a0a';
const CONTOUR_COLOR = '#5a4a3a';

export class TerrainRenderer {
  private marchingSquares: MarchingSquares;

  constructor(private grid: CaveGrid) {
    this.marchingSquares = new MarchingSquares(grid);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const cellSize = this.grid.config.cellSize;
    const rect = camera.getVisibleRect();

    // Compute visible cell range with 1-cell padding
    const startX = Math.max(0, Math.floor(rect.x / cellSize) - 1);
    const startY = Math.max(0, Math.floor(rect.y / cellSize) - 1);
    const endX = Math.min(this.grid.config.cols - 1, Math.ceil((rect.x + rect.width) / cellSize) + 1);
    const endY = Math.min(this.grid.config.rows - 1, Math.ceil((rect.y + rect.height) / cellSize) + 1);

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
  }
}
