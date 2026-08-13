import type { KeyboardEvent } from 'react';

/**
 * Keyboard activation handler for clickable non-native elements.
 * Mirrors the element's onClick so Enter / Space behave like a native button.
 */
export function onEnterOrSpace<T = HTMLElement>(
  handler: () => void
): (event: KeyboardEvent<T>) => void {
  return (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  };
}
