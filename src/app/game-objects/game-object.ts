import {Vector} from '../vector';

export interface ThrustInput {
  thrustLeft: number;
  thrustRight: number;
  left: number;
  right: number;
}

export class GameObject {
  parent?: GameObject;

  width: number;
  height: number;

  mass: number;
  inertia: number;

  affectedByGravity: boolean;
  position: Vector;
  acceleration: Vector;
  velocity: Vector;

  rotation: number;
  angularAcceleration: number;
  angularVelocity: number;

  origin: Vector;

  thrust: number;
  thrustFn: (input: ThrustInput) => number;
  thrustOrigin: Vector;
  thrustDirection: Vector;

  constructor(v?: Partial<GameObject>) {
    this.parent = v?.parent;
    this.width = v?.width ?? 10;
    this.height = v?.height ?? 10;
    this.mass = v?.mass ?? 10;
    this.inertia = v?.inertia ?? 10;
    this.affectedByGravity = v?.affectedByGravity ?? false;
    this.position = v?.position ? new Vector(v.position.x, v.position.y) : new Vector();
    this.acceleration = v?.acceleration ? new Vector(v.acceleration.x, v.acceleration.y) : new Vector();
    this.velocity = v?.velocity ? new Vector(v.velocity.x, v.velocity.y) : new Vector();
    this.rotation = v?.rotation ?? 0;
    this.angularAcceleration = v?.angularAcceleration ?? 0;
    this.angularVelocity = v?.angularVelocity ?? 0;
    this.origin = v?.origin ? new Vector(v.origin.x, v.origin.y) : new Vector();
    this.thrust = v?.thrust ?? 0;
    this.thrustFn = v?.thrustFn || ((input: ThrustInput) => 0);
    this.thrustOrigin = v?.thrustOrigin ? new Vector(v.thrustOrigin.x, v.thrustOrigin.y) : new Vector();
    this.thrustDirection = v?.thrustDirection ? new Vector(v.thrustDirection.x, v.thrustDirection.y) : new Vector(0, 1);
  }

  get cssPosition(): Vector {
    if (this.parent != null) {
      return this.parent.origin.subtract(this.origin).add(this.position)
    } else {
      return this.position.subtract(this.origin);
    }
  }
}

export class Spaceship extends GameObject {
  thrusters: GameObject[];

  constructor(v?: Partial<Spaceship>) {
    super(v);

    this.thrusters = (v?.thrusters ?? []).map(t => new GameObject({
      ...t,
      parent: this
    }));
  }

  tick(deltaT: number, thrustInput: ThrustInput) {

    if (deltaT > 1) {
      return;
    }

    if (this.thrusters?.length <= 0) {
      return;
    }

    this.acceleration = new Vector();
    this.angularAcceleration = 0;

    this.thrusters.forEach(thruster => {

      thruster.thrust = thruster.thrustFn(thrustInput);
      const thrustVector = thruster.thrustDirection.rotate(thruster.rotation).scale(thruster.thrust);
      const torque = thruster.position.cross(thrustVector);
      const angularAcceleration = torque / this.inertia;
      const linearAcceleration = thrustVector.divide(this.mass);

      this.acceleration = this.acceleration.add(linearAcceleration);
      this.angularAcceleration = this.angularAcceleration + angularAcceleration;

    });

    this.angularVelocity = this.angularVelocity + this.angularAcceleration * deltaT;
    this.rotation = this.rotation - this.angularVelocity * deltaT;
    this.velocity = this.velocity.add(this.acceleration.rotate(this.rotation).scale(deltaT));
    this.position = this.position?.subtract(this.velocity.scale(deltaT));

  }
}
