import {Vector} from '../vector';
import {CaveGrid} from './cave-grid';

export interface PathConfig {
  segmentCount: number;
  minSegmentLength: number;
  maxSegmentLength: number;
  corridorRadius: number;    // in grid cells, how wide to clear
  minSelfDistance: number;    // minimum distance between non-adjacent segments (world px)
  worldMargin: number;       // stay this far from world edges (world px)
}

export interface GamePath {
  points: Vector[];          // waypoints (segmentCount + 1 points)
  start: Vector;
  goal: Vector;
  checkpointRadius: number;  // how close to a waypoint to count as reached
}

export const POINTS_PER_CHECKPOINT = 100;
export const SKIP_PENALTY = 150;

export interface PathProximity {
  distance: number;
  closestPoint: Vector;
  segmentIndex: number;
}

export function getPathProximity(path: GamePath, position: Vector): PathProximity {
  let bestDist = Infinity;
  let bestPoint = path.start;
  let bestSegment = 0;

  for (let i = 0; i < path.points.length - 1; i++) {
    const a = path.points[i];
    const b = path.points[i + 1];
    const ab = b.subtract(a);
    const ap = position.subtract(a);
    const lenSq = ab.dot(ab);

    let t = 0;
    if (lenSq > 0.0001) {
      t = Math.max(0, Math.min(1, ap.dot(ab) / lenSq));
    }

    const closest = a.add(ab.scale(t));
    const dist = position.subtract(closest).length();

    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = closest;
      bestSegment = i;
    }
  }

  return {distance: bestDist, closestPoint: bestPoint, segmentIndex: bestSegment};
}

const DEFAULT_PATH_CONFIG: PathConfig = {
  segmentCount: 15,
  minSegmentLength: 200,
  maxSegmentLength: 500,
  corridorRadius: 5,
  minSelfDistance: 150,
  worldMargin: 400,
};

export class PathGenerator {
  private config: PathConfig;
  private rng: () => number;

  constructor(private grid: CaveGrid, config?: Partial<PathConfig>, seed = 123) {
    this.config = {...DEFAULT_PATH_CONFIG, ...config};

    // Seeded PRNG (mulberry32)
    let s = seed;
    this.rng = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  generate(): GamePath {
    const {segmentCount, minSegmentLength, maxSegmentLength, worldMargin} = this.config;
    const worldW = this.grid.worldWidth;
    const worldH = this.grid.worldHeight;

    // Start near center
    const startX = worldW / 2 + (this.rng() - 0.5) * 200;
    const startY = worldH / 2 + (this.rng() - 0.5) * 200;
    const points: Vector[] = [new Vector(startX, startY)];

    let currentAngle = this.rng() * Math.PI * 2;

    for (let i = 0; i < segmentCount; i++) {
      const maxAttempts = 50;
      let placed = false;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Pick a random angle, biased toward continuing roughly forward
        const angleOffset = (this.rng() - 0.5) * Math.PI * 1.2; // +/- ~108 degrees
        const angle = currentAngle + angleOffset;

        const length = minSegmentLength + this.rng() * (maxSegmentLength - minSegmentLength);
        const endPoint = new Vector(
          points[points.length - 1].x + Math.cos(angle) * length,
          points[points.length - 1].y + Math.sin(angle) * length,
        );

        // Check world bounds
        if (endPoint.x < worldMargin || endPoint.x > worldW - worldMargin ||
            endPoint.y < worldMargin || endPoint.y > worldH - worldMargin) {
          continue;
        }

        // Check self-distance against all non-adjacent segments
        const newSegStart = points[points.length - 1];
        if (!this.isSegmentValid(points, newSegStart, endPoint)) {
          continue;
        }

        points.push(endPoint);
        currentAngle = angle;
        placed = true;
        break;
      }

      if (!placed) {
        // Couldn't place more segments; stop here
        break;
      }
    }

    // Clear corridor along the path
    this.clearCorridor(points);

    return {
      points,
      start: points[0],
      goal: points[points.length - 1],
      checkpointRadius: this.config.corridorRadius * this.grid.config.cellSize,
    };
  }

  private isSegmentValid(existingPoints: Vector[], segStart: Vector, segEnd: Vector): boolean {
    const {minSelfDistance} = this.config;

    // Check distance from new segment to all non-adjacent existing segments
    // (skip the last segment since it shares the start point)
    for (let i = 0; i < existingPoints.length - 2; i++) {
      const a = existingPoints[i];
      const b = existingPoints[i + 1];
      const dist = this.segmentToSegmentDistance(a, b, segStart, segEnd);
      if (dist < minSelfDistance) {
        return false;
      }
    }

    // Also check distance from new endpoint to all existing points (except adjacent)
    for (let i = 0; i < existingPoints.length - 1; i++) {
      const dist = this.pointToSegmentDistance(existingPoints[i], segStart, segEnd);
      if (dist < minSelfDistance) {
        return false;
      }
    }

    return true;
  }

  private segmentToSegmentDistance(a1: Vector, a2: Vector, b1: Vector, b2: Vector): number {
    // Check if segments intersect
    if (this.segmentsIntersect(a1, a2, b1, b2)) return 0;

    // Minimum of all point-to-segment distances
    return Math.min(
      this.pointToSegmentDistance(a1, b1, b2),
      this.pointToSegmentDistance(a2, b1, b2),
      this.pointToSegmentDistance(b1, a1, a2),
      this.pointToSegmentDistance(b2, a1, a2),
    );
  }

  private pointToSegmentDistance(p: Vector, a: Vector, b: Vector): number {
    const ab = b.subtract(a);
    const ap = p.subtract(a);
    const lenSq = ab.dot(ab);
    if (lenSq < 0.0001) return ap.length();

    const t = Math.max(0, Math.min(1, ap.dot(ab) / lenSq));
    const closest = a.add(ab.scale(t));
    return p.subtract(closest).length();
  }

  private segmentsIntersect(a1: Vector, a2: Vector, b1: Vector, b2: Vector): boolean {
    const d1 = this.cross2d(b2.subtract(b1), a1.subtract(b1));
    const d2 = this.cross2d(b2.subtract(b1), a2.subtract(b1));
    const d3 = this.cross2d(a2.subtract(a1), b1.subtract(a1));
    const d4 = this.cross2d(a2.subtract(a1), b2.subtract(a1));

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }

    return false;
  }

  private cross2d(a: Vector, b: Vector): number {
    return a.x * b.y - a.y * b.x;
  }

  private clearCorridor(points: Vector[]): void {
    const cellSize = this.grid.config.cellSize;
    const radius = this.config.corridorRadius;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const dir = end.subtract(start);
      const length = dir.length();
      const steps = Math.ceil(length / (cellSize * 0.5));

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const wx = start.x + dir.x * t;
        const wy = start.y + dir.y * t;
        const cx = Math.round(wx / cellSize);
        const cy = Math.round(wy / cellSize);
        this.grid.clearArea(cx, cy, radius);
      }
    }

    // Also clear extra space at start and goal
    const first = points[0];
    const last = points[points.length - 1];
    this.grid.clearArea(
      Math.round(first.x / cellSize),
      Math.round(first.y / cellSize),
      radius + 2,
    );
    this.grid.clearArea(
      Math.round(last.x / cellSize),
      Math.round(last.y / cellSize),
      radius + 2,
    );
  }
}
