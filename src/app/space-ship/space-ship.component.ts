import {Component, HostBinding, Input} from '@angular/core';
import {Vector} from '../vector';

@Component({
  selector: 'app-space-ship',
  standalone: true,
  imports: [],
  templateUrl: './space-ship.component.html',
  styleUrl: './space-ship.component.scss'
})
export class SpaceShipComponent {
  @Input() thrustLeft = 0;
  @Input() thrustRight = 0;

  centerOfGravity = new Vector(10, 30)
  thrustOriginLeft = new Vector(15, 30)
  thrustOriginRight = new Vector(-15, 30)

  acceleration = new Vector();
  velocity = new Vector();
  angularVelocity = 0;
  position?: Vector;
  rotation = 0;
  mass = 2;
  inertia = 200;

  private thrustFactor = 20;

  constructor() {
    this.position = new Vector(200, 200);
  }

  @HostBinding('style.left.px')
  get x() {
    return this.position?.x ?? 0
  }

  @HostBinding('style.top.px')
  get y() {
    return this.position?.y ?? 0
  }

  @HostBinding('style.--rotation-deg')
  get angle() {
    return `${this.rotation * (180 / Math.PI)}deg`;
  }

  tick(deltaT: number) {
    const tvLeft = new Vector(0, this.thrustLeft * this.thrustFactor);
    const tvRight = new Vector(0, this.thrustRight * this.thrustFactor);

    const torqueLeft = this.thrustOriginLeft.cross(tvLeft);
    const torqueRight = this.thrustOriginRight.cross(tvRight);

    const angularAccelerationLeft = torqueLeft / this.inertia;
    const angularAccelerationRight = torqueRight / this.inertia;

    const linearAccelerationLeft = tvLeft.divide(this.mass);
    const linearAccelerationRight = tvRight.divide(this.mass);

    this.acceleration = linearAccelerationLeft.add(linearAccelerationRight);
    this.angularVelocity = this.angularVelocity + (angularAccelerationLeft + angularAccelerationRight) * deltaT;

    this.rotation = this.rotation + this.angularVelocity * deltaT;
    this.velocity = this.velocity.add(this.acceleration.rotate(this.rotation).scale(deltaT));
    this.position = this.position?.add(this.velocity.scale(deltaT));
  }
}

