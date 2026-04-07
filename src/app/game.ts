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
import {nanoid} from 'nanoid';

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
  private currentSeed: string;
  private seedUi: HTMLDivElement;
  private seedInput: HTMLInputElement;

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
    this.currentSeed = nanoid(10);
    this.buildWorld(this.currentSeed);
    const {seedUi, seedInput} = this.createSeedUi();
    this.seedUi = seedUi;
    this.seedInput = seedInput;

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

  private createSeedUi(): {seedUi: HTMLDivElement; seedInput: HTMLInputElement} {
    const seedUi = document.createElement('div');
    seedUi.style.cssText = `
      position: absolute;
      left: 50%;
      top: 24px;
      transform: translateX(-50%);
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: monospace;
      color: #aaa;
      background: rgba(10, 10, 26, 0.85);
      border: 1px solid #333;
      padding: 8px;
    `;

    const label = document.createElement('label');
    label.textContent = 'Seed';
    label.htmlFor = 'seed-input';

    const seedInput = document.createElement('input');
    seedInput.id = 'seed-input';
    seedInput.type = 'text';
    seedInput.placeholder = 'Leave empty for random';
    seedInput.autocomplete = 'off';
    seedInput.style.cssText = `
      width: 220px;
      background: #111;
      border: 1px solid #555;
      color: #ddd;
      padding: 4px 6px;
      font-family: monospace;
      font-size: 12px;
    `;
    seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.state === GameState.START_SCREEN) {
        e.preventDefault();
        e.stopPropagation();
        this.startGameFromMenu();
      }
    });

    seedUi.appendChild(label);
    seedUi.appendChild(seedInput);
    this.container.appendChild(seedUi);
    return {seedUi, seedInput};
  }

  private seedToNumber(seed: string, salt: string): number {
    const input = `${seed}:${salt}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private resolveSeedFromInput(): string {
    const value = this.seedInput.value.trim();
    if (value) return value;
    const generated = nanoid(10);
    this.seedInput.value = generated;
    return generated;
  }

  private startGameFromMenu() {
    this.currentSeed = this.resolveSeedFromInput();
    this.buildWorld(this.currentSeed);
    this.nextCheckpoint = 1;
    this.reachedCheckpoints = 0;
    this.skippedCheckpoints = 0;
    this.proximitySum = 0;
    this.proximitySamples = 0;
    this.finalScore = 0;
    this.proximity = null;
    this.state = GameState.PLAYING;
  }

  private buildWorld(seed: string) {
    const caveSeed = this.seedToNumber(seed, 'cave');
    const pathSeed = this.seedToNumber(seed, 'path');
    this.caveGrid = new CaveGrid({seed: caveSeed});
    this.caveGrid.generate();
    const pathGen = new PathGenerator(this.caveGrid, undefined, pathSeed);
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
      this.startGameFromMenu();
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
    if (e.key === 'Escape' && this.state !== GameState.START_SCREEN) {
      if (this.state === GameState.EDITOR) {
        this.editor.exit();
      } else {
        this.returnToMenu();
      }
      return;
    }

    if (this.state === GameState.START_SCREEN) {
      if (document.activeElement === this.seedInput) return;
      this.startGameFromMenu();
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
        this.startGameFromMenu();
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
        return;
      }
    }
    if ((this.state === GameState.PLAYING || this.state === GameState.FINISHED)
        && this.renderer.isSeedClicked(e.offsetX, e.offsetY)) {
      navigator.clipboard.writeText(this.currentSeed);
      this.renderer.triggerSeedCopiedAnimation();
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
    this.seedUi.style.display = this.state === GameState.START_SCREEN ? 'flex' : 'none';

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
      seed: this.currentSeed,
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
  }

  private calcFps() {
    const timeStamp = new Date().getTime();
    this.deltaT = (timeStamp - this.oldTimeStamp) / 1000;
    this.oldTimeStamp = timeStamp;
    this.fps = Math.round(1 / this.deltaT);
  }
}
