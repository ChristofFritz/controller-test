import {Component, Input} from '@angular/core';
import {Spaceship, ThrustInput} from '../game-objects/game-object';

@Component({
  selector: 'app-space-ship',
  standalone: true,
  imports: [],
  templateUrl: './space-ship.component.html',
  styleUrl: './space-ship.component.scss'
})
export class SpaceshipComponent {
  @Input() thrustLeft = 0;
  @Input() thrustRight = 0;

  @Input({required: true}) spaceship!: Spaceship;

  tick(deltaT: number, thrustInput: ThrustInput) {
    if (deltaT > 1) {
      return;
    }

    this.spaceship.tick(deltaT, thrustInput);
  }
}

