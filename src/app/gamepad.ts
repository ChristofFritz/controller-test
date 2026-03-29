import {isEqualGamepadState} from './util';

export class GamepadService {
  active = false;
  gamepadIndex?: number;
  currentState: Gamepad | null = null;
  onStateChange?: (state: Gamepad) => void;
  private shouldStart = false;

  constructor() {
    window.addEventListener("gamepadconnected", (e) => {
      if (this.shouldStart) {
        this.start();
      }

      console.log(
        "Gamepad connected at index %d: %s. %d buttons, %d axes.",
        e.gamepad.index,
        e.gamepad.id,
        e.gamepad.buttons.length,
        e.gamepad.axes.length,
      );
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      console.log(
        "Gamepad disconnected from index %d: %s",
        e.gamepad.index,
        e.gamepad.id,
      );
    });
  }

  start() {
    if (this.gamepadIndex == null) {
      const gamepad = navigator.getGamepads().find(g => g != null);

      if (gamepad != null) {
        this.gamepadIndex = gamepad.index;
      } else {
        this.shouldStart = true;
        return;
      }
    } else {
      this.shouldStart = true;
      return;
    }

    this.active = true;
    this.shouldStart = false;
    this.pollGamepads();
  }

  stop() {
    this.active = false;
    this.shouldStart = false;
    this.gamepadIndex = undefined;
    this.currentState = null;
  }

  private updateState(gamepad: Gamepad) {
    if (!this.active) {
      return;
    }

    if (!this.currentState || !isEqualGamepadState(this.currentState, gamepad)) {
      this.currentState = gamepad;
      this.onStateChange?.(gamepad);
    }
  }

  private pollGamepads() {
    if (this.gamepadIndex == null) {
      return;
    }

    const gamepad = navigator.getGamepads()[this.gamepadIndex];
    if (!gamepad) {
      return;
    }

    this.updateState(gamepad);

    if (this.active) {
      requestAnimationFrame(() => this.pollGamepads());
    }
  }
}
