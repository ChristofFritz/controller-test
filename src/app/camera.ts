import {Vector} from './vector';

export class Camera {
  position: Vector;
  viewportWidth: number;
  viewportHeight: number;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.position = new Vector();
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  update(target: Vector): void {
    this.position = target;
  }

  worldToScreen(worldPos: Vector): Vector {
    return new Vector(
      worldPos.x - this.position.x + this.viewportWidth / 2,
      worldPos.y - this.position.y + this.viewportHeight / 2,
    );
  }

  getVisibleRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.position.x - this.viewportWidth / 2,
      y: this.position.y - this.viewportHeight / 2,
      width: this.viewportWidth,
      height: this.viewportHeight,
    };
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }
}
