import {GamepadService} from './gamepad';
import {GameObject, Spaceship} from './game-objects/game-object';
import {Vector} from './vector';
import {CanvasRenderer} from './canvas-renderer';
import {Camera} from './camera';
import {CaveGrid} from './terrain/cave-grid';
import {TerrainRenderer} from './terrain/terrain-renderer';
import {TerrainCollision} from './terrain/collision';
import {MarchingSquares} from './terrain/marching-squares';
import {PathGenerator, GamePath, getPathProximity, PathProximity, POINTS_PER_CHECKPOINT, SKIP_PENALTY} from './terrain/path-generator';
import {version} from '../../package.json';

export class Game {
  private renderer: CanvasRenderer;
  private camera: Camera;
  private caveGrid: CaveGrid;
  private terrainRenderer: TerrainRenderer;
  private terrainCollision: TerrainCollision;
  private gamePath: GamePath;
  private spawnPoint: Vector;
  private proximity: PathProximity | null = null;
  private gamepadService: GamepadService;

  // Game state
  private started = false;
  private nextCheckpoint = 1;
  private reachedCheckpoints = 0;
  private skippedCheckpoints = 0;
  private proximitySum = 0;
  private proximitySamples = 0;
  private finished = false;
  private finalScore = 0;

  // Input state
  private triggerLeft = 0;
  private triggerRight = 0;
  private dPadLeft = 0;
  private dPadRight = 0;
  private rotateCCW = 0;
  private rotateCW = 0;

  // Timing
  private fps = 0;
  private deltaT = 0;
  private oldTimeStamp = 0;

  private spaceship = new Spaceship({
    position: new Vector(0, 0),
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

  constructor(container: HTMLElement) {
    // Create canvas
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    // Generate cave
    this.caveGrid = new CaveGrid();
    this.caveGrid.generate();

    // Generate path
    const pathGen = new PathGenerator(this.caveGrid);
    this.gamePath = pathGen.generate();
    this.spawnPoint = this.gamePath.start;
    this.spaceship.respawn(this.spawnPoint);

    // Terrain systems
    const marchingSquares = new MarchingSquares(this.caveGrid);
    this.terrainRenderer = new TerrainRenderer(this.caveGrid, marchingSquares);
    this.terrainCollision = new TerrainCollision(this.caveGrid, marchingSquares);

    // Renderer and camera
    this.renderer = new CanvasRenderer(canvas);
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.camera.update(this.spawnPoint);

    // Gamepad
    this.gamepadService = new GamepadService();
    this.gamepadService.onStateChange = (state) => {
      if (!this.started) {
        this.started = true;
        return;
      }
      this.triggerLeft = state.buttons[6].value;
      this.triggerRight = state.buttons[7].value;
      this.dPadLeft = state.buttons[14].value;
      this.dPadRight = state.buttons[15].value;
    };
    this.gamepadService.start();

    // Event listeners
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('resize', () => this.onResize());

    // Start game loop
    this.gameLoop();
  }

  private onResize() {
    this.renderer.resize();
    this.camera.resize(window.innerWidth, window.innerHeight);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (!this.started) {
      this.started = true;
      return;
    }
    if (e.key === 'ArrowLeft') {
      this.triggerLeft = 1;
    } else if (e.key === 'ArrowRight') {
      this.triggerRight = 1;
    } else if (e.key === 'a') {
      this.dPadLeft = 1;
    } else if (e.key === 'd') {
      this.dPadRight = 1;
    } else if (e.key === 'q') {
      this.rotateCCW = 1;
    } else if (e.key === 'e') {
      this.rotateCW = 1;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      this.triggerLeft = 0;
    } else if (e.key === 'ArrowRight') {
      this.triggerRight = 0;
    } else if (e.key === 'a') {
      this.dPadLeft = 0;
    } else if (e.key === 'd') {
      this.dPadRight = 0;
    } else if (e.key === 'q') {
      this.rotateCCW = 0;
    } else if (e.key === 'e') {
      this.rotateCW = 0;
    }
  }

  private gameLoop() {
    this.draw();
    window.requestAnimationFrame(() => this.gameLoop());
  }

  private draw() {
    this.calcFps();

    if (!this.started) {
      this.renderer.drawStartScreen();
      return;
    }

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

      // Proximity + checkpoint tracking
      if (!this.finished) {
        this.proximity = getPathProximity(this.gamePath, this.spaceship.position);

        const maxDist = 120;
        const proximityRatio = Math.max(0, 1 - this.proximity.distance / maxDist);
        this.proximitySum += proximityRatio;
        this.proximitySamples++;

        const pts = this.gamePath.points;
        if (this.nextCheckpoint < pts.length) {
          const distToCheckpoint = this.spaceship.position.subtract(pts[this.nextCheckpoint]).length();

          if (distToCheckpoint < this.gamePath.checkpointRadius) {
            this.reachedCheckpoints++;
            this.nextCheckpoint++;
          } else if (this.proximity.segmentIndex >= this.nextCheckpoint) {
            this.skippedCheckpoints++;
            this.nextCheckpoint++;
          }
        }

        const distToGoal = this.spaceship.position.subtract(this.gamePath.goal).length();
        if (distToGoal < this.gamePath.checkpointRadius) {
          this.finishGame();
        }
      }
    }

    // Camera
    this.camera.update(this.spaceship.position);

    // Render
    this.renderer.render(this.spaceship, this.camera, this.terrainRenderer, {
      path: this.gamePath,
      proximity: this.proximity ?? undefined,
      nextCheckpoint: this.nextCheckpoint,
      reachedCheckpoints: this.reachedCheckpoints,
      skippedCheckpoints: this.skippedCheckpoints,
      proximityMultiplier: this.getProximityMultiplier(),
      finished: this.finished,
      finalScore: this.finalScore,
      fps: this.fps,
      version: version,
    });
  }

  private getProximityMultiplier(): number {
    if (this.proximitySamples === 0) return 1;
    const avg = this.proximitySum / this.proximitySamples;
    return 0.5 + avg * 1.5;
  }

  private finishGame() {
    this.finished = true;
    const basePoints = this.reachedCheckpoints * POINTS_PER_CHECKPOINT
                     - this.skippedCheckpoints * SKIP_PENALTY;
    this.finalScore = Math.max(0, Math.round(basePoints * this.getProximityMultiplier()));
  }

  private calcFps() {
    const timeStamp = new Date().getTime();
    this.deltaT = (timeStamp - this.oldTimeStamp) / 1000;
    this.oldTimeStamp = timeStamp;
    this.fps = Math.round(1 / this.deltaT);
  }
}
