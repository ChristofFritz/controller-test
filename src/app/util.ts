export function isEqualArray<T>(prev: T[], curr: T[], comparator?: (prev: T, curr: T) => boolean) {
  if (prev.length != curr.length) {
    return;
  }

  let isEqual = true;
  for (let i = 0; i < prev.length; i++) {
    if (comparator != null) {
      isEqual = comparator(prev[i], curr[i]);
    } else {
      isEqual = prev[i] === curr[i];
    }

    if (!isEqual) {
      break;
    }
  }

  return isEqual;
}

export function isEqualReadonlyArray<T>(prev: ReadonlyArray<T>, curr: ReadonlyArray<T>, comparator?: (prev: T, curr: T) => boolean) {
  if (prev.length != curr.length) {
    return;
  }

  let isEqual = true;
  for (let i = 0; i < prev.length; i++) {
    if (comparator != null) {
      isEqual = comparator(prev[i], curr[i]);
    } else {
      isEqual = prev[i] === curr[i];
    }

    if (!isEqual) {
      break;
    }
  }

  return isEqual;
}

export function isEqualGamepadState(prev: Gamepad, curr: Gamepad) {
  return prev.index == curr.index
         && isEqualReadonlyArray(prev.axes, curr.axes)
         && isEqualReadonlyArray(
      prev.buttons,
      curr.buttons,
      (prev, curr) => prev.pressed === curr.pressed && prev.touched === curr.touched && prev.value === curr.value
    );
}
