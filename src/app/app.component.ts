import {AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, inject, OnInit, ViewChild} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {GamepadService} from './gamepad.service';
import {filter} from 'rxjs';
import {GameObject, Spaceship} from './game-objects/game-object';
import {Vector} from './vector';
import {CanvasRenderer} from './canvas-renderer';
import {Camera} from './camera';
import {CaveGrid} from './terrain/cave-grid';
import {TerrainRenderer} from './terrain/terrain-renderer';
import {TerrainCollision} from './terrain/collision';
import {version} from '../../package.json';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('gameCanvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: CanvasRenderer;
  private camera!: Camera;
  private caveGrid!: CaveGrid;
  private terrainRenderer!: TerrainRenderer;
  private terrainCollision!: TerrainCollision;
  private spawnPoint!: Vector;

  version = version;

  spaceship = new Spaceship({
    position: new Vector(0, 0), // will be set to spawn point
    width: 16,
    height: 30,
    mass: 1,
    inertia: 200,
    origin: new Vector(8, 15),
    rotation: 0,
    thrusters: [
      new GameObject({
        height: 10,
        width: 4,
        position: new Vector(-12, 0),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 20),
        thrustFn: input => input.thrustLeft,
        rotation: 0
      }),
      new GameObject({
        height: 10,
        width: 4,
        position: new Vector(12, 0),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 20),
        thrustFn: input => input.thrustRight,
        rotation: 0
      }),
      new GameObject({
        height: 4,
        width: 4,
        position: new Vector(10, -10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 10),
        thrustFn: input => Math.max(input.left, input.rotateCCW),
        rotation: -1.57
      }),
      new GameObject({
        height: 4,
        width: 4,
        position: new Vector(10, 10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 10),
        thrustFn: input => Math.max(input.left, input.rotateCW),
        rotation: -1.57
      }),
      new GameObject({
        height: 4,
        width: 4,
        position: new Vector(-10, -10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 10),
        thrustFn: input => Math.max(input.right, input.rotateCW),
        rotation: 1.57
      }),
      new GameObject({
        height: 4,
        width: 4,
        position: new Vector(-10, 10),
        origin: new Vector(2, 5),
        thrustOrigin: new Vector(0, 5),
        thrustDirection: new Vector(0, 10),
        thrustFn: input => Math.max(input.right, input.rotateCCW),
        rotation: 1.57
      })
    ]
  });

  currentState?: Gamepad;
  triggerLeft = 0;
  triggerRight = 0;
  dPadLeft = 0;
  dPadRight = 0;
  rotateCCW = 0;
  rotateCW = 0;

  fps: number = 0;
  private deltaT: number = 0;
  private oldTimeStamp: number = 0;

  private gamepadService = inject(GamepadService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    // Generate cave
    this.caveGrid = new CaveGrid();
    this.caveGrid.generate();
    this.spawnPoint = this.caveGrid.findOpenSpawn();
    this.spaceship.respawn(this.spawnPoint);

    // Terrain systems
    this.terrainRenderer = new TerrainRenderer(this.caveGrid);
    this.terrainCollision = new TerrainCollision(this.caveGrid);

    // Gamepad
    this.gamepadService.start();
    this.gamepadService
      .gamepadState$
      .pipe(filter(state => state != null))
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
      });
  }

  ngAfterViewInit() {
    this.renderer = new CanvasRenderer(this.canvasRef.nativeElement);
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.camera.update(this.spawnPoint);
    this.gameLoop();
  }

  @HostListener('window:resize')
  onResize() {
    this.renderer?.resize();
    this.camera?.resize(window.innerWidth, window.innerHeight);
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
    } else if ($event.key === 'a') {
      this.dPadLeft = 1;
    } else if ($event.key === 'd') {
      this.dPadRight = 1;
    } else if ($event.key === 'q') {
      this.rotateCCW = 1;
    } else if ($event.key === 'e') {
      this.rotateCW = 1;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp($event: KeyboardEvent) {
    if ($event.key === 'ArrowLeft') {
      this.triggerLeft = 0;
    } else if ($event.key === 'ArrowRight') {
      this.triggerRight = 0;
    } else if ($event.key === 'a') {
      this.dPadLeft = 0;
    } else if ($event.key === 'd') {
      this.dPadRight = 0;
    } else if ($event.key === 'q') {
      this.rotateCCW = 0;
    } else if ($event.key === 'e') {
      this.rotateCW = 0;
    }
  }

  private gameLoop() {
    this.draw();
    window.requestAnimationFrame(() => this.gameLoop());
  }

  private draw() {
    this.calcFps();

    if (this.deltaT <= 1) {
      // Physics
      this.spaceship.tick(this.deltaT, {
        thrustLeft: this.triggerLeft,
        thrustRight: this.triggerRight,
        left: this.dPadLeft,
        right: this.dPadRight,
        rotateCCW: this.rotateCCW,
        rotateCW: this.rotateCW,
      });

      // Collision
      this.terrainCollision.checkAndResolve(this.spaceship);

      // Death / respawn
      if (this.spaceship.isDead()) {
        this.spaceship.respawn(this.spawnPoint);
      }
    }

    // Camera
    this.camera.update(this.spaceship.position);

    // Render
    this.renderer.render(this.spaceship, this.camera, this.terrainRenderer);
    this.cdr.markForCheck();
  }

  private calcFps() {
    const timeStamp = new Date().getTime();
    this.deltaT = (timeStamp - this.oldTimeStamp) / 1000;
    this.oldTimeStamp = timeStamp;
    this.fps = Math.round(1 / this.deltaT);
  }
}
