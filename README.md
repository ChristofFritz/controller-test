# Cave Pilot

A 2D top-down spaceship game built with Angular 18 and HTML5 Canvas. Navigate a procedurally generated cave, follow a path through checkpoints, and reach the goal.

## Gameplay

- Fly a thrust-based spaceship through a Perlin noise generated cave
- Follow the marked path from start (S) to goal (G)
- Pass through checkpoints in order to earn points (+100 each)
- Skipping checkpoints costs points (-150 each)
- Stay close to the path to build a proximity multiplier (0.5x - 2.0x)
- Colliding with walls deals damage based on impact speed
- Ship respawns at start on death
- Final score shown on reaching the goal

## Controls

| Action | Keyboard | Controller |
|---|---|---|
| Left thruster | Arrow Left | Left trigger |
| Right thruster | Arrow Right | Right trigger |
| Strafe left | A | D-Pad left |
| Strafe right | D | D-Pad right |
| Rotate CCW | Q | - |
| Rotate CW | E | - |

## Development

```sh
npm install
npm start
```

Open `http://localhost:4444`.

## Build

```sh
npm run build
```

## Tech

- Angular 18 (standalone components)
- HTML5 Canvas 2D rendering
- Perlin noise terrain generation
- Marching squares for smooth cave contours
- Rigid body impulse collision physics
- Gamepad API support
