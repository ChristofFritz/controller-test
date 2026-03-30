export class InputState {
  readonly pressedKeys = new Set<string>();
  readonly gamepadValues = new Map<number, number>();

  keyDown(key: string): void {
    this.pressedKeys.add(key);
  }

  keyUp(key: string): void {
    this.pressedKeys.delete(key);
  }

  setGamepadButton(index: number, value: number): void {
    this.gamepadValues.set(index, value);
  }

  clearGamepad(): void {
    this.gamepadValues.clear();
  }

  getThrustForBindings(keys: string[], gamepadButtons: number[]): number {
    let max = 0;
    for (const key of keys) {
      if (this.pressedKeys.has(key)) {
        max = 1;
        break;
      }
    }
    for (const btn of gamepadButtons) {
      const v = this.gamepadValues.get(btn) ?? 0;
      if (v > max) max = v;
    }
    return max;
  }
}
