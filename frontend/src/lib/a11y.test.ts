import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { onEnterOrSpace } from './a11y';

describe('onEnterOrSpace', () => {
  it('activates the handler on Enter', () => {
    const handler = vi.fn();
    const fire = onEnterOrSpace<HTMLDivElement>(handler);
    fire({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLDivElement>);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('activates the handler on Space and prevents the default scroll', () => {
    const handler = vi.fn();
    const preventDefault = vi.fn();
    const fire = onEnterOrSpace<HTMLDivElement>(handler);
    fire({ key: ' ', preventDefault } as unknown as KeyboardEvent<HTMLDivElement>);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const handler = vi.fn();
    const fire = onEnterOrSpace<HTMLDivElement>(handler);
    fire({ key: 'a' } as unknown as KeyboardEvent<HTMLDivElement>);
    expect(handler).not.toHaveBeenCalled();
  });
});
