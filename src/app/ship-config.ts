import {GameObject, Spaceship} from './game-objects/game-object';
import {Vector} from './vector';

export interface Vec2 {
  x: number;
  y: number;
}

export interface ThrusterConfig {
  position: Vec2;
  width: number;
  height: number;
  rotation: number;
  origin: Vec2;
  thrustOrigin: Vec2;
  thrustDirection: Vec2;
  keys: string[];
  gamepadButtons: number[];
}

export interface ShipConfig {
  width: number;
  height: number;
  mass: number;
  inertia: number;
  origin: Vec2;
  thrusters: ThrusterConfig[];
}

export const DEFAULT_SHIP_CONFIG: ShipConfig = {
  width: 16,
  height: 30,
  mass: 1,
  inertia: 200,
  origin: {x: 8, y: 15},
  thrusters: [
    {
      position: {x: -12, y: 0}, width: 4, height: 10, rotation: 0,
      origin: {x: 2, y: 5}, thrustOrigin: {x: 0, y: 5}, thrustDirection: {x: 0, y: 20},
      keys: ['ArrowLeft'], gamepadButtons: [6],
    },
    {
      position: {x: 12, y: 0}, width: 4, height: 10, rotation: 0,
      origin: {x: 2, y: 5}, thrustOrigin: {x: 0, y: 5}, thrustDirection: {x: 0, y: 20},
      keys: ['ArrowRight'], gamepadButtons: [7],
    },
    {
      position: {x: 10, y: -10}, width: 4, height: 4, rotation: -1.57,
      origin: {x: 2, y: 5}, thrustOrigin: {x: 0, y: 5}, thrustDirection: {x: 0, y: 10},
      keys: ['a', 'q'], gamepadButtons: [14],
    },
    {
      position: {x: 10, y: 10}, width: 4, height: 4, rotation: -1.57,
      origin: {x: 2, y: 5}, thrustOrigin: {x: 0, y: 5}, thrustDirection: {x: 0, y: 10},
      keys: ['a', 'e'], gamepadButtons: [],
    },
    {
      position: {x: -10, y: -10}, width: 4, height: 4, rotation: 1.57,
      origin: {x: 2, y: 5}, thrustOrigin: {x: 0, y: 5}, thrustDirection: {x: 0, y: 10},
      keys: ['d', 'e'], gamepadButtons: [15],
    },
    {
      position: {x: -10, y: 10}, width: 4, height: 4, rotation: 1.57,
      origin: {x: 2, y: 5}, thrustOrigin: {x: 0, y: 5}, thrustDirection: {x: 0, y: 10},
      keys: ['d', 'q'], gamepadButtons: [],
    },
  ],
};

export function normalizeShipConfig(config: ShipConfig): ShipConfig {
  const thrusters = Array.isArray(config.thrusters) ? config.thrusters : [];
  return {
    width: config.width,
    height: config.height,
    mass: config.mass,
    inertia: config.inertia,
    origin: {x: config.origin.x, y: config.origin.y},
    thrusters: thrusters.map((t) => ({
      position: {x: t.position.x, y: t.position.y},
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      origin: {x: t.origin.x, y: t.origin.y},
      thrustOrigin: {x: t.thrustOrigin.x, y: t.thrustOrigin.y},
      thrustDirection: {x: t.thrustDirection.x, y: t.thrustDirection.y},
      keys: Array.isArray(t.keys) ? [...t.keys] : [],
      gamepadButtons: Array.isArray(t.gamepadButtons) ? [...t.gamepadButtons] : [],
    })),
  };
}

export function configToSpaceship(config: ShipConfig): Spaceship {
  return new Spaceship({
    position: new Vector(0, 0),
    width: config.width,
    height: config.height,
    mass: config.mass,
    inertia: config.inertia,
    origin: new Vector(config.origin.x, config.origin.y),
    rotation: 0,
    thrusters: config.thrusters.map(t => new GameObject({
      position: new Vector(t.position.x, t.position.y),
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      origin: new Vector(t.origin.x, t.origin.y),
      thrustOrigin: new Vector(t.thrustOrigin.x, t.thrustOrigin.y),
      thrustDirection: new Vector(t.thrustDirection.x, t.thrustDirection.y),
      keys: [...t.keys],
      gamepadButtons: [...t.gamepadButtons],
    })),
  });
}

export function spaceshipToConfig(ship: Spaceship): ShipConfig {
  return normalizeShipConfig({
    width: ship.width,
    height: ship.height,
    mass: ship.mass,
    inertia: ship.inertia,
    origin: {x: ship.origin.x, y: ship.origin.y},
    thrusters: ship.thrusters.map(t => ({
      position: {x: t.position.x, y: t.position.y},
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      origin: {x: t.origin.x, y: t.origin.y},
      thrustOrigin: {x: t.thrustOrigin.x, y: t.thrustOrigin.y},
      thrustDirection: {x: t.thrustDirection.x, y: t.thrustDirection.y},
      keys: [...t.keys],
      gamepadButtons: [...t.gamepadButtons],
    })),
  });
}

const STORAGE_KEY = 'hollowburn_ship';
const HISTORY_KEY = 'hollowburn_ship_history';
const MAX_HISTORY = 20;

export function saveShipConfig(config: ShipConfig): void {
  const normalized = normalizeShipConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

  const history = loadShipHistory();
  history.unshift(normalized);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function loadShipConfig(): ShipConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeShipConfig(JSON.parse(raw) as ShipConfig);
  } catch {
    return null;
  }
}

export function loadShipHistory(): ShipConfig[] {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as ShipConfig[]).map(normalizeShipConfig);
  } catch {
    return [];
  }
}

export function encodeShareString(config: ShipConfig): string {
  return btoa(JSON.stringify(config));
}

export function decodeShareString(str: string): ShipConfig | null {
  try {
    return normalizeShipConfig(JSON.parse(atob(str)) as ShipConfig);
  } catch {
    return null;
  }
}
