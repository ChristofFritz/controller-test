import {Spaceship} from '../game-objects/game-object';
import {CaveGrid} from './cave-grid';
import {Vector} from '../vector';

export interface CollisionResult {
  normal: Vector;
  impactSpeed: number;
}

const MIN_IMPACT_SPEED = 20;
const RESTITUTION = 0.3;
const DAMAGE_FACTOR = 0.15;
const PUSH_STEP = 2;
const MAX_PUSH_ITERATIONS = 10;

export class TerrainCollision {
  constructor(private grid: CaveGrid) {}

  checkAndResolve(ship: Spaceship): CollisionResult | null {
    const hullPoints = this.getHullPoints(ship);
    let collidingPoints: Vector[] = [];

    for (const p of hullPoints) {
      if (this.grid.isWorldPointSolid(p.x, p.y)) {
        collidingPoints.push(p);
      }
    }

    if (collidingPoints.length === 0) return null;

    // Estimate surface normal from average of colliding points
    const avgCollision = collidingPoints.reduce(
      (sum, p) => sum.add(p),
      new Vector(),
    ).scale(1 / collidingPoints.length);

    const normal = this.estimateNormal(avgCollision);

    // Impact speed along normal
    const impactSpeed = Math.abs(ship.velocity.dot(normal));

    // Reflect velocity
    const vn = ship.velocity.dot(normal);
    if (vn < 0) {
      // Only reflect if moving into the wall
      ship.velocity = ship.velocity.subtract(normal.scale((1 + RESTITUTION) * vn));
      // Dampen angular velocity on collision
      ship.angularVelocity *= 0.7;
    }

    // Push ship out of terrain
    for (let i = 0; i < MAX_PUSH_ITERATIONS; i++) {
      const stillColliding = this.getHullPoints(ship).some(
        p => this.grid.isWorldPointSolid(p.x, p.y),
      );
      if (!stillColliding) break;
      ship.position = ship.position.add(normal.scale(PUSH_STEP));
    }

    // Apply damage
    if (impactSpeed > MIN_IMPACT_SPEED) {
      ship.takeDamage(impactSpeed * DAMAGE_FACTOR);
    }

    return {normal, impactSpeed};
  }

  private getHullPoints(ship: Spaceship): Vector[] {
    const hw = ship.width / 2;
    const hh = ship.height / 2;

    // 8 points: corners + midpoints, relative to origin
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

  private estimateNormal(worldPoint: Vector): Vector {
    const step = this.grid.config.cellSize;

    const sx = (this.grid.isWorldPointSolid(worldPoint.x + step, worldPoint.y) ? 1 : 0)
             - (this.grid.isWorldPointSolid(worldPoint.x - step, worldPoint.y) ? 1 : 0);
    const sy = (this.grid.isWorldPointSolid(worldPoint.x, worldPoint.y + step) ? 1 : 0)
             - (this.grid.isWorldPointSolid(worldPoint.x, worldPoint.y - step) ? 1 : 0);

    const gradient = new Vector(sx, sy);
    const len = gradient.length();

    if (len < 0.001) {
      // Fallback: push away from collision point toward ship center
      return new Vector(0, -1);
    }

    // Normal points from solid toward empty (opposite of gradient)
    return gradient.scale(-1 / len);
  }
}
