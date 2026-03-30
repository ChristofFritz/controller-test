import {GamepadService} from './gamepad';
import {Spaceship} from './game-objects/game-object';
import {Vector} from './vector';
import {CanvasRenderer} from './canvas-renderer';
import {Camera} from './camera';
import {CaveGrid} from './terrain/cave-grid';
import {TerrainRenderer} from './terrain/terrain-renderer';
import {TerrainCollision} from './terrain/collision';
import {MarchingSquares} from './terrain/marching-squares';
import {PathGenerator, GamePath, getPathProximity, PathProximity, POINTS_PER_CHECKPOINT, SKIP_PENALTY} from './terrain/path-generator';
import {InputState} from './input-state';
import {ShipConfig, DEFAULT_SHIP_CONFIG, configToSpaceship, loadShipConfig, saveShipConfig} from './ship-config';
import {Editor} from './editor/editor';
import {version} from '../../package.json';

export enum GameState {
  START_SCREEN,
  EDITOR,
  PLAYING,
  FINISHED,
}

export class Game {
  private renderer: CanvasRenderer;
  private camera: Camera;
  private caveGrid!: CaveGrid;
  private terrainRenderer!: TerrainRenderer;
  private terrainCollision!: TerrainCollision;
  private gamePath!: GamePath;
  private spawnPoint!: Vector;
  private proximity: PathProximity | null = null;
  private gamepadService: GamepadService;
  private input = new InputState();
  private editor: Editor;

  // Game state
  private state = GameState.START_SCREEN;
  private nextCheckpoint = 1;
  private reachedCheckpoints = 0;
  private skippedCheckpoints = 0;
  private proximitySum = 0;
  private proximitySamples = 0;
  private finalScore = 0;

  // Ship
  private shipConfig: ShipConfig;
  private spaceship!: Spaceship;

  // Timing
  private fps = 0;
  private deltaT = 0;
  private oldTimeStamp = 0;

  constructor(private container: HTMLElement) {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    this.renderer = new CanvasRenderer(canvas);
    this.camera = new Camera(window.innerWidth, window.innerHeight);

    // Load ship config
    this.shipConfig = loadShipConfig() ?? DEFAULT_SHIP_CONFIG;
    this.buildWorld();

    // Editor
    this.editor = new Editor(container, this.shipConfig, (config) => {
      this.shipConfig = config;
      saveShipConfig(config);
      this.spaceship = configToSpaceship(config);
      this.spaceship.respawn(this.spawnPoint);
      this.state = GameState.START_SCREEN;
    });

    // Gamepad
    this.gamepadService = new GamepadService();
    this.gamepadService.onStateChange = (gp) => this.onGamepadState(gp);
    this.gamepadService.start();

    // Event listeners
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('resize', () => this.onResize());
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));

    this.gameLoop();
  }

  private buildWorld() {
    this.caveGrid = new CaveGrid();
    this.caveGrid.generate();
    const pathGen = new PathGenerator(this.caveGrid);
    this.gamePath = pathGen.generate();
    this.spawnPoint = this.gamePath.start;
    this.spaceship = configToSpaceship(this.shipConfig);
    this.spaceship.respawn(this.spawnPoint);
    const marchingSquares = new MarchingSquares(this.caveGrid);
    this.terrainRenderer = new TerrainRenderer(this.caveGrid, marchingSquares);
    this.terrainCollision = new TerrainCollision(this.caveGrid, marchingSquares);
    this.camera.update(this.spawnPoint);
  }

  private onResize() {
    this.renderer.resize();
    this.camera.resize(window.innerWidth, window.innerHeight);
  }

  private onGamepadState(gp: Gamepad) {
    if (this.state === GameState.START_SCREEN) {
      this.state = GameState.PLAYING;
      return;
    }
    if (this.state === GameState.EDITOR) return;

    this.input.clearGamepad();
    for (let i = 0; i < gp.buttons.length; i++) {
      if (gp.buttons[i].value > 0) {
        this.input.setGamepadButton(i, gp.buttons[i].value);
      }
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.state === GameState.START_SCREEN) {
      this.state = GameState.PLAYING;
      return;
    }
    if (this.state === GameState.EDITOR) {
      this.editor.handleKeyDown(e);
      return;
    }
    this.input.keyDown(e.key);
  }

  private onKeyUp(e: KeyboardEvent) {
    if (this.state === GameState.EDITOR) {
      this.editor.handleKeyUp(e);
      return;
    }
    this.input.keyUp(e.key);
  }

  private onMouseDown(e: MouseEvent) {
    if (this.state === GameState.START_SCREEN) {
      const action = this.renderer.getStartScreenAction(e.offsetX, e.offsetY);
      if (action === 'play') {
        this.state = GameState.PLAYING;
      } else if (action === 'editor') {
        this.state = GameState.EDITOR;
        this.editor.enter(this.shipConfig);
      }
      return;
    }
    if (this.state === GameState.FINISHED) {
      const action = this.renderer.getFinishScreenAction(e.offsetX, e.offsetY);
      if (action === 'menu') {
        this.returnToMenu();
      }
      return;
    }
    if (this.state === GameState.EDITOR) {
      this.editor.handleMouseDown(e);
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.state === GameState.EDITOR) {
      this.editor.handleMouseMove(e);
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (this.state === GameState.EDITOR) {
      this.editor.handleMouseUp(e);
    }
  }

  private gameLoop() {
    this.draw();
    window.requestAnimationFrame(() => this.gameLoop());
  }

  private draw() {
    this.calcFps();

    if (this.state === GameState.START_SCREEN) {
      this.renderer.drawStartScreen(this.shipConfig);
      return;
    }

    if (this.state === GameState.EDITOR) {
      this.editor.draw(this.renderer.ctx, this.renderer.width, this.renderer.height);
      return;
    }

    if (this.deltaT <= 1) {
      this.spaceship.tick(this.deltaT, this.input);

      this.terrainCollision.checkAndResolve(this.spaceship);

      if (this.spaceship.isDead()) {
        this.spaceship.respawn(this.spawnPoint);
      }

      if (this.state === GameState.PLAYING) {
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

    this.camera.update(this.spaceship.position);

    const finished = this.state === GameState.FINISHED;
    this.renderer.render(this.spaceship, this.camera, this.terrainRenderer, {
      path: this.gamePath,
      proximity: this.proximity ?? undefined,
      nextCheckpoint: this.nextCheckpoint,
      reachedCheckpoints: this.reachedCheckpoints,
      skippedCheckpoints: this.skippedCheckpoints,
      proximityMultiplier: this.getProximityMultiplier(),
      finished,
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
    this.state = GameState.FINISHED;
    const basePoints = this.reachedCheckpoints * POINTS_PER_CHECKPOINT
                     - this.skippedCheckpoints * SKIP_PENALTY;
    this.finalScore = Math.max(0, Math.round(basePoints * this.getProximityMultiplier()));
  }

  private returnToMenu() {
    this.state = GameState.START_SCREEN;
    this.nextCheckpoint = 1;
    this.reachedCheckpoints = 0;
    this.skippedCheckpoints = 0;
    this.proximitySum = 0;
    this.proximitySamples = 0;
    this.finalScore = 0;
    this.proximity = null;
    this.buildWorld();
  }

  private calcFps() {
    const timeStamp = new Date().getTime();
    this.deltaT = (timeStamp - this.oldTimeStamp) / 1000;
    this.oldTimeStamp = timeStamp;
    this.fps = Math.round(1 / this.deltaT);
  }
}
