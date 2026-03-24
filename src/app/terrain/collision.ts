import {Spaceship} from '../game-objects/game-object';
import {CaveGrid} from './cave-grid';
import {MarchingSquares, LineSegment} from './marching-squares';
import {Vector} from '../vector';

export interface CollisionResult {
  normal: Vector;
  impactSpeed: number;
}

const RESTITUTION = 0.4;
const FRICTION = 0.3;
const MIN_IMPACT_SPEED = 15;
const DAMAGE_FACTOR = 0.12;
const PUSH_EPSILON = 0.5;

export class TerrainCollision {
  constructor(
    private grid: CaveGrid,
    private marchingSquares: MarchingSquares,
  ) {}

  checkAndResolve(ship: Spaceship): CollisionResult | null {
    const hullPoints = this.getHullPoints(ship);
    let deepestPenetration = 0;
    let bestContact: Vector | null = null;
    let bestNormal: Vector | null = null;

    for (const p of hullPoints) {
      if (!this.grid.isWorldPointSolid(p.x, p.y)) continue;

      const {normal, distance} = this.findNearestSurface(p);
      if (distance > deepestPenetration) {
        deepestPenetration = distance;
        bestContact = p;
        bestNormal = normal;
      }
    }

    if (!bestContact || !bestNormal) return null;

    // The physics engine uses inverted conventions:
    //   position -= velocity * dt,  rotation -= angularVelocity * dt
    // Convert to actual motion vectors for collision math
    const motionVel = ship.velocity.scale(-1);
    const motionAngVel = -ship.angularVelocity;

    // Lever arm from center of mass to contact point
    const r = bestContact.subtract(ship.position);

    // Velocity at contact point: v + omega x r
    // In 2D, omega x r = omega * (-r.y, r.x)
    const vContact = motionVel.add(
      new Vector(-r.y, r.x).scale(motionAngVel)
    );

    // Normal component of contact velocity
    const vn = vContact.dot(bestNormal);

    // Only respond if moving into the wall (vn < 0 in standard convention)
    if (vn >= 0) {
      if (deepestPenetration > 0) {
        ship.position = ship.position.add(bestNormal.scale(deepestPenetration + PUSH_EPSILON));
      }
      return null;
    }

    const impactSpeed = Math.abs(vn);

    // --- Normal impulse (rigid body) ---
    const rCrossN = r.cross(bestNormal);
    const inverseMass = 1 / ship.mass;
    const inverseInertia = 1 / ship.inertia;
    const effectiveMass = inverseMass + rCrossN * rCrossN * inverseInertia;

    const jNormal = -(1 + RESTITUTION) * vn / effectiveMass;

    // Apply normal impulse in motion space, then convert back to engine convention
    const newMotionVel = motionVel.add(bestNormal.scale(jNormal * inverseMass));
    const newMotionAngVel = motionAngVel + rCrossN * jNormal * inverseInertia;

    // --- Friction impulse (tangential) ---
    const tangent = vContact.subtract(bestNormal.scale(vn));
    const tangentLen = tangent.length();
    let finalVel = newMotionVel;
    let finalAngVel = newMotionAngVel;

    if (tangentLen > 0.001) {
      const tangentDir = tangent.scale(1 / tangentLen);
      const rCrossT = r.cross(tangentDir);
      const effectiveMassT = inverseMass + rCrossT * rCrossT * inverseInertia;
      const vt = vContact.dot(tangentDir);

      let jFriction = -vt / effectiveMassT;
      const maxFriction = FRICTION * Math.abs(jNormal);
      jFriction = Math.max(-maxFriction, Math.min(maxFriction, jFriction));

      finalVel = finalVel.add(tangentDir.scale(jFriction * inverseMass));
      finalAngVel = finalAngVel + rCrossT * jFriction * inverseInertia;
    }

    // Convert back to engine convention (negate)
    ship.velocity = finalVel.scale(-1);
    ship.angularVelocity = -finalAngVel;

    // Push out of terrain
    if (deepestPenetration > 0) {
      ship.position = ship.position.add(bestNormal.scale(deepestPenetration + PUSH_EPSILON));
    }

    // Apply damage
    if (impactSpeed > MIN_IMPACT_SPEED) {
      ship.takeDamage(impactSpeed * DAMAGE_FACTOR);
    }

    return {normal: bestNormal, impactSpeed};
  }

  private getHullPoints(ship: Spaceship): Vector[] {
    const hw = ship.width / 2;
    const hh = ship.height / 2;

    const localPoints: Vector[] = [
      new Vector(-hw, -hh),
      new Vector(hw, -hh),
      new Vector(hw, hh),
      new Vector(-hw, hh),
      new Vector(0, -hh),
      new Vector(hw, 0),
      new Vector(0, hh),
      new Vector(-hw, 0),
    ];

    return localPoints.map(p =>
      p.rotate(ship.rotation).add(ship.position)
    );
  }

  private findNearestSurface(point: Vector): { normal: Vector; distance: number } {
    const cellSize = this.grid.config.cellSize;
    const cx = Math.floor(point.x / cellSize);
    const cy = Math.floor(point.y / cellSize);

    // Search surrounding cells for marching squares contour segments
    let bestDist = Infinity;
    let bestNormal = new Vector(0, -1);
    const searchRadius = 2;

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const segments = this.marchingSquares.getCellSegments(cx + dx, cy + dy);
        for (const seg of segments) {
          const {distance, normal} = this.pointToSegment(point, seg);
          if (distance < bestDist) {
            bestDist = distance;
            bestNormal = normal;
          }
        }
      }
    }

    // If no contour found nearby, fall back to noise gradient
    if (bestDist === Infinity) {
      bestNormal = this.estimateNormalFromGradient(point);
      bestDist = cellSize * 0.5;
    }

    return {normal: bestNormal, distance: bestDist};
  }

  private pointToSegment(point: Vector, seg: LineSegment): { distance: number; normal: Vector } {
    const a = new Vector(seg.x1, seg.y1);
    const b = new Vector(seg.x2, seg.y2);
    const ab = b.subtract(a);
    const ap = point.subtract(a);

    const abLenSq = ab.dot(ab);
    if (abLenSq < 0.0001) {
      const dist = ap.length();
      return {distance: dist, normal: ap.length() > 0 ? ap.normalize() : new Vector(0, -1)};
    }

    // Project point onto segment, clamped to [0, 1]
    const t = Math.max(0, Math.min(1, ap.dot(ab) / abLenSq));
    const closest = a.add(ab.scale(t));
    const diff = point.subtract(closest);
    const distance = diff.length();

    // Normal = perpendicular of segment, pointing away from solid
    // Segment edge direction is ab; perpendicular is (-ab.y, ab.x)
    let normal = new Vector(-ab.y, ab.x).normalize();

    // Ensure normal points away from solid (toward the point if it's in solid terrain)
    // Check which side of the segment is solid by testing a point offset along the normal
    const testPoint = closest.add(normal.scale(this.grid.config.cellSize * 0.25));
    if (this.grid.isWorldPointSolid(testPoint.x, testPoint.y)) {
      normal = normal.scale(-1);
    }

    return {distance, normal};
  }

  private estimateNormalFromGradient(worldPoint: Vector): Vector {
    const step = this.grid.config.cellSize * 0.5;

    const ntl = this.grid.getNoiseValueAt(worldPoint.x - step, worldPoint.y - step);
    const ntr = this.grid.getNoiseValueAt(worldPoint.x + step, worldPoint.y - step);
    const nbl = this.grid.getNoiseValueAt(worldPoint.x - step, worldPoint.y + step);
    const nbr = this.grid.getNoiseValueAt(worldPoint.x + step, worldPoint.y + step);

    const sx = ((ntr + nbr) - (ntl + nbl)) * 0.5;
    const sy = ((nbl + nbr) - (ntl + ntr)) * 0.5;

    const gradient = new Vector(sx, sy);
    const len = gradient.length();

    if (len < 0.0001) return new Vector(0, -1);
    return gradient.scale(-1 / len);
  }
}
