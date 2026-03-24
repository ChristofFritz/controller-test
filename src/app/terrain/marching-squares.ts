import {CaveGrid} from './cave-grid';

export interface LineSegment {
  x1: number; y1: number;
  x2: number; y2: number;
}

// Edge midpoint indices: 0=top, 1=right, 2=bottom, 3=left
// Each case maps to pairs of edge indices to connect
const EDGE_TABLE: number[][] = [
  [],           // 0:  all empty
  [3, 2],       // 1:  BL
  [2, 1],       // 2:  BR
  [3, 1],       // 3:  BL BR
  [1, 0],       // 4:  TR
  [3, 0, 1, 2], // 5:  TR BL (ambiguous)
  [2, 0],       // 6:  TR BR
  [3, 0],       // 7:  TR BR BL
  [0, 3],       // 8:  TL
  [0, 2],       // 9:  TL BL
  [0, 1, 2, 3], // 10: TL BR (ambiguous)
  [0, 1],       // 11: TL BL BR
  [1, 3],       // 12: TL TR
  [1, 2],       // 13: TL TR BL
  [2, 3],       // 14: TL TR BR
  [],           // 15: all solid
];

export class MarchingSquares {
  constructor(private grid: CaveGrid) {}

  getCellSegments(cx: number, cy: number): LineSegment[] {
    const g = this.grid;
    const cellSize = g.config.cellSize;
    const threshold = g.config.threshold;

    const tl = g.getCorner(cx, cy);
    const tr = g.getCorner(cx + 1, cy);
    const br = g.getCorner(cx + 1, cy + 1);
    const bl = g.getCorner(cx, cy + 1);

    const caseIndex = (tl << 3) | (tr << 2) | (br << 1) | bl;
    if (caseIndex === 0 || caseIndex === 15) return [];

    // Noise values for interpolation
    const ntl = g.getNoiseValue(cx, cy);
    const ntr = g.getNoiseValue(cx + 1, cy);
    const nbr = g.getNoiseValue(cx + 1, cy + 1);
    const nbl = g.getNoiseValue(cx, cy + 1);

    const wx = cx * cellSize;
    const wy = cy * cellSize;

    // Interpolated edge crossing points
    const edgePoints: [number, number][] = [
      [wx + this.interp(ntl, ntr, threshold) * cellSize, wy],                         // 0: top
      [wx + cellSize, wy + this.interp(ntr, nbr, threshold) * cellSize],              // 1: right
      [wx + this.interp(nbl, nbr, threshold) * cellSize, wy + cellSize],              // 2: bottom
      [wx, wy + this.interp(ntl, nbl, threshold) * cellSize],                         // 3: left
    ];

    const edges = EDGE_TABLE[caseIndex];
    const segments: LineSegment[] = [];

    for (let i = 0; i < edges.length; i += 2) {
      const a = edgePoints[edges[i]];
      const b = edgePoints[edges[i + 1]];
      segments.push({x1: a[0], y1: a[1], x2: b[0], y2: b[1]});
    }

    return segments;
  }

  // Returns vertices for the solid portion of a cell as [x,y, x,y, ...]
  getCellFillVertices(cx: number, cy: number): number[] | null {
    const g = this.grid;
    const cellSize = g.config.cellSize;
    const threshold = g.config.threshold;

    const tl = g.getCorner(cx, cy);
    const tr = g.getCorner(cx + 1, cy);
    const br = g.getCorner(cx + 1, cy + 1);
    const bl = g.getCorner(cx, cy + 1);

    const caseIndex = (tl << 3) | (tr << 2) | (br << 1) | bl;
    if (caseIndex === 0) return null;

    const wx = cx * cellSize;
    const wy = cy * cellSize;

    if (caseIndex === 15) {
      return [wx, wy, wx + cellSize, wy, wx + cellSize, wy + cellSize, wx, wy + cellSize];
    }

    const ntl = g.getNoiseValue(cx, cy);
    const ntr = g.getNoiseValue(cx + 1, cy);
    const nbr = g.getNoiseValue(cx + 1, cy + 1);
    const nbl = g.getNoiseValue(cx, cy + 1);

    const eTop: [number, number] = [wx + this.interp(ntl, ntr, threshold) * cellSize, wy];
    const eRight: [number, number] = [wx + cellSize, wy + this.interp(ntr, nbr, threshold) * cellSize];
    const eBottom: [number, number] = [wx + this.interp(nbl, nbr, threshold) * cellSize, wy + cellSize];
    const eLeft: [number, number] = [wx, wy + this.interp(ntl, nbl, threshold) * cellSize];

    const TL: [number, number] = [wx, wy];
    const TR: [number, number] = [wx + cellSize, wy];
    const BR: [number, number] = [wx + cellSize, wy + cellSize];
    const BL: [number, number] = [wx, wy + cellSize];

    // Build polygon for the solid region of each case
    let pts: [number, number][];
    switch (caseIndex) {
      case 1:  pts = [eLeft, eBottom, BL]; break;
      case 2:  pts = [eBottom, eRight, BR]; break;
      case 3:  pts = [eLeft, eRight, BR, BL]; break;
      case 4:  pts = [eTop, TR, eRight]; break;
      case 5:  pts = [eTop, TR, eRight, eBottom, BL, eLeft]; break;
      case 6:  pts = [eTop, TR, BR, eBottom]; break;
      case 7:  pts = [eTop, TR, BR, BL, eLeft]; break;
      case 8:  pts = [TL, eTop, eLeft]; break;
      case 9:  pts = [TL, eTop, eBottom, BL]; break;
      case 10: pts = [TL, eTop, eRight, BR, eBottom, eLeft]; break;
      case 11: pts = [TL, eTop, eRight, BR, BL]; break;
      case 12: pts = [TL, TR, eRight, eLeft]; break;
      case 13: pts = [TL, TR, eRight, eBottom, BL]; break;
      case 14: pts = [TL, TR, BR, eBottom, eLeft]; break;
      default: return null;
    }

    const result: number[] = [];
    for (const p of pts) {
      result.push(p[0], p[1]);
    }
    return result;
  }

  private interp(v0: number, v1: number, threshold: number): number {
    if (Math.abs(v1 - v0) < 0.0001) return 0.5;
    const t = (threshold - v0) / (v1 - v0);
    return Math.max(0, Math.min(1, t));
  }
}
