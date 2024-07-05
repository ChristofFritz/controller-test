import {AfterViewInit, ChangeDetectorRef, Component, HostListener, inject, OnInit, ViewChild} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {GamepadService} from './gamepad.service';
import {filter} from 'rxjs';
import {SpaceshipComponent} from './space-ship/space-ship.component';
import {GameObject, Spaceship} from './game-objects/game-object';
import {Vector} from './vector';
import {version} from '../../package.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SpaceshipComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild(SpaceshipComponent) spaceshipComponent?: SpaceshipComponent;

  version = version;

  spaceship = new Spaceship({
    position: new Vector(Math.floor((visualViewport!.width ?? 200) / 2), Math.floor((visualViewport!.height ?? 200) / 2)),
    width: 16,
    height: 30,
    mass: 1,
    inertia: 200,
    origin: new Vector(8, 15),
    rotation: 0, // 1.57,
    thrusters: [
      new GameObject({
        height: 10,
        width: 4,
        position: new Vector(-12, 10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 20),
        thrustFn: input => input.thrustLeft,
        rotation: .1
      }),
      new GameObject({
        height: 10,
        width: 4,
        position: new Vector(12, 10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 20),
        thrustFn: input => input.thrustRight,
        rotation: -.1
      }),
      new GameObject({
        height: 4,
        width: 4,
        position: new Vector(10, -10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 10),
        thrustFn: input => input.left,
        rotation: -1.57
      }),
      new GameObject({
        height: 4,
        width: 4,
        position: new Vector(10, 10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 10),
        thrustFn: input => input.left,
        rotation: -1.57
      }),
      new GameObject({
        height: 4,
        width: 4,
        position: new Vector(-10, -10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 10),
        thrustFn: input => input.right,
        rotation: 1.57
      }),
      new GameObject({
        height: 4,
        width: 4,
        position: new Vector(-10, 10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 10),
        thrustFn: input => input.right,
        rotation: 1.57
      })
    ]
  });

  currentState?: Gamepad;
  triggerLeft = 0;
  triggerRight = 0;
  dPadLeft = 0;
  dPadRight = 0;

  fps: number = 0;
  private deltaT: number = 0;
  private oldTimeStamp: number = 0;

  private gamepadService = inject(GamepadService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.gamepadService.start();

    this.gamepadService
      .gamepadState$
      .pipe(
        filter(state => state != null)
      )
      .subscribe({
        next: state => {
          if (state) {
            this.currentState = state;
            this.triggerLeft = state.buttons[6].value;
            this.triggerRight = state.buttons[7].value;
            this.dPadLeft = state.buttons[14].value;
            this.dPadRight = state.buttons[15].value;
          }
        }
      })
  }

  ngAfterViewInit() {
    this.gameLoop();
  }

  start() {
    this.gamepadService.start();
  }

  stop() {
    this.gamepadService.stop();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown($event: KeyboardEvent) {
    if ($event.key === 'ArrowLeft') {
      this.triggerLeft = 1;
    } else if ($event.key === 'ArrowRight') {
      this.triggerRight = 1;
    } else if ($event.key === 'd') {
      this.dPadRight = 1;
    } else if ($event.key === 'a') {
      this.dPadLeft = 1;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp($event: KeyboardEvent) {
    if ($event.key === 'ArrowLeft') {
      this.triggerLeft = 0;
    } else if ($event.key === 'ArrowRight') {
      this.triggerRight = 0;
    } else if ($event.key === 'd') {
      this.dPadRight = 0;
    } else if ($event.key === 'a') {
      this.dPadLeft = 0;
    }
  }

  private gameLoop() {
    this.draw();
    window.requestAnimationFrame(() => this.gameLoop());
  }

  private draw() {
    this.calcFps();
    this.spaceshipComponent?.tick(
      this.deltaT,
      {
        thrustLeft: this.triggerLeft,
        thrustRight: this.triggerRight,
        left: this.dPadLeft,
        right: this.dPadRight,
      }
    );
    this.cdr.markForCheck();
  }

  private calcFps() {
    const timeStamp = new Date().getTime();
    this.deltaT = (timeStamp - this.oldTimeStamp) / 1000;
    this.oldTimeStamp = timeStamp;
    this.fps = Math.round(1 / this.deltaT);
  }
}

