import {PerlinNoise} from './perlin-noise';
import {Vector} from '../vector';

export interface CaveGridConfig {
  cols: number;
  rows: number;
  cellSize: number;
  noiseScale: number;
  threshold: number;
  seed: number;
}

const DEFAULT_CONFIG: CaveGridConfig = {
  cols: 400,
  rows: 400,
  cellSize: 16,
  noiseScale: 0.05,
  threshold: 0.0,
  seed: 42,
};

export class CaveGrid {
  readonly config: CaveGridConfig;
  readonly cornerCols: number;
  readonly cornerRows: number;
  readonly grid: Uint8Array;
  readonly noiseValues: Float32Array;

  private spawnPoint: Vector | null = null;

  constructor(config?: Partial<CaveGridConfig>) {
    this.config = {...DEFAULT_CONFIG, ...config};
    this.cornerCols = this.config.cols + 1;
    this.cornerRows = this.config.rows + 1;
    const size = this.cornerCols * this.cornerRows;
    this.grid = new Uint8Array(size);
    this.noiseValues = new Float32Array(size);
  }

  get worldWidth(): number {
    return this.config.cols * this.config.cellSize;
  }

  get worldHeight(): number {
    return this.config.rows * this.config.cellSize;
  }

  generate(): void {
    const noise = new PerlinNoise(this.config.seed);
    const {cornerCols, cornerRows, config} = this;

    for (let y = 0; y < cornerRows; y++) {
      for (let x = 0; x < cornerCols; x++) {
        const idx = y * cornerCols + x;
        const isEdge = x === 0 || y === 0 || x === cornerCols - 1 || y === cornerRows - 1;

        if (isEdge) {
          this.noiseValues[idx] = 1;
          this.grid[idx] = 1;
        } else {
          const val = noise.octaveNoise(x * config.noiseScale, y * config.noiseScale);
          this.noiseValues[idx] = val;
          this.grid[idx] = val > config.threshold ? 1 : 0;
        }
      }
    }
  }

  getCorner(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= this.cornerCols || cy >= this.cornerRows) return 1;
    return this.grid[cy * this.cornerCols + cx];
  }

  getNoiseValue(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= this.cornerCols || cy >= this.cornerRows) return 1;
    return this.noiseValues[cy * this.cornerCols + cx];
  }

  getNoiseValueAt(wx: number, wy: number): number {
    const cellSize = this.config.cellSize;
    const cx = wx / cellSize;
    const cy = wy / cellSize;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    const fx = cx - ix;
    const fy = cy - iy;

    const ntl = this.getNoiseValue(ix, iy);
    const ntr = this.getNoiseValue(ix + 1, iy);
    const nbl = this.getNoiseValue(ix, iy + 1);
    const nbr = this.getNoiseValue(ix + 1, iy + 1);

    const top = ntl + (ntr - ntl) * fx;
    const bot = nbl + (nbr - nbl) * fx;
    return top + (bot - top) * fy;
  }

  isWorldPointSolid(wx: number, wy: number): boolean {
    const cellSize = this.config.cellSize;
    const cx = Math.floor(wx / cellSize);
    const cy = Math.floor(wy / cellSize);

    if (cx < 0 || cy < 0 || cx >= this.config.cols || cy >= this.config.rows) return true;

    // Check all 4 corners of this cell; if majority solid, treat as solid
    const tl = this.getCorner(cx, cy);
    const tr = this.getCorner(cx + 1, cy);
    const bl = this.getCorner(cx, cy + 1);
    const br = this.getCorner(cx + 1, cy + 1);

    // Use bilinear interpolation of noise values for smooth boundary
    const fx = (wx / cellSize) - cx;
    const fy = (wy / cellSize) - cy;
    const ntl = this.getNoiseValue(cx, cy);
    const ntr = this.getNoiseValue(cx + 1, cy);
    const nbl = this.getNoiseValue(cx, cy + 1);
    const nbr = this.getNoiseValue(cx + 1, cy + 1);

    const top = ntl + (ntr - ntl) * fx;
    const bot = nbl + (nbr - nbl) * fx;
    const val = top + (bot - top) * fy;

    return val > this.config.threshold;
  }

  clearArea(cx: number, cy: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x <= 0 || y <= 0 || x >= this.cornerCols - 1 || y >= this.cornerRows - 1) continue;
        const idx = y * this.cornerCols + x;
        this.grid[idx] = 0;
        this.noiseValues[idx] = -1;
      }
    }
  }

  findOpenSpawn(): Vector {
    if (this.spawnPoint) return this.spawnPoint;

    const centerX = Math.floor(this.cornerCols / 2);
    const centerY = Math.floor(this.cornerRows / 2);
    const checkRadius = 5;

    // Spiral search from center
    for (let r = 0; r < Math.max(this.cornerCols, this.cornerRows) / 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // perimeter only
          const x = centerX + dx;
          const y = centerY + dy;
          if (this.isAreaClear(x, y, checkRadius)) {
            this.spawnPoint = new Vector(
              x * this.config.cellSize,
              y * this.config.cellSize,
            );
            return this.spawnPoint;
          }
        }
      }
    }

    // Fallback: carve out space at center
    this.clearArea(centerX, centerY, checkRadius + 2);
    this.spawnPoint = new Vector(
      centerX * this.config.cellSize,
      centerY * this.config.cellSize,
    );
    return this.spawnPoint;
  }

  private isAreaClear(cx: number, cy: number, radius: number): boolean {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        if (this.getCorner(cx + dx, cy + dy) === 1) return false;
      }
    }
    return true;
  }
}
