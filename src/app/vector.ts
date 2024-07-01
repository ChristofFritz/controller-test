export class Vector {
  x: number = 0;
  y: number = 0;

  constructor(x?: number, y?: number) {
    this.x = x ?? 0;
    this.y = y ?? 0;
  }

  add(other: Vector) {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector) {
    return new Vector(this.x - other.x, this.y - other.y);
  }

  dot(other: Vector): number {
    return this.x * other.x + this.y * other.y;
  }

  multiply(other: Vector) {
    return new Vector(this.x * other.x, this.y * other.y);
  }

  scale(factor: number) {
    return new Vector(this.x * factor, this.y * factor);
  }

  divide(factor: number) {
    return this.scale(1 / factor);
  }

  cross(other: Vector): number {
    return this.x * other.y - this.y * other.x;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  normalize() {
    return this.divide(this.length() || 1);
  }

  angle(other?: Vector): number {
    if (!other) {
      other = new Vector(0, 1);
    }

    return Math.acos(this.normalize().dot(other.normalize())) * (180 / Math.PI);
  }

  rotate(angleRad: number): Vector {
    const s = Math.sin(angleRad);
    const c = Math.cos(angleRad);

    const xNew = this.x * c - this.y * s;
    const yNew = this.x * s + this.y * c;

    return new Vector(xNew, yNew);
  }

  toString(): string {
    return `${this.x}, ${this.y}`;
  }
}
