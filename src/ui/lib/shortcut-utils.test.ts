import { describe, expect, it } from 'vitest';
import { buildAccelerator } from './shortcut-utils';

function keyEvent(init: KeyboardEventInit): KeyboardEvent {
  return {
    key: init.key ?? '',
    code: init.code ?? '',
    ctrlKey: Boolean(init.ctrlKey),
    metaKey: Boolean(init.metaKey),
    altKey: Boolean(init.altKey),
    shiftKey: Boolean(init.shiftKey),
  } as KeyboardEvent;
}

describe('shortcut utils', () => {
  it('builds accelerators with modifiers', () => {
    expect(buildAccelerator(keyEvent({ key: ' ', altKey: true }))).toBe('Option+Space');
    expect(buildAccelerator(keyEvent({ key: 'a', metaKey: true, shiftKey: true }))).toBe(
      'Command+Shift+A',
    );
    expect(buildAccelerator(keyEvent({ key: 'ArrowRight' }))).toBe('Right');
    expect(buildAccelerator(keyEvent({ key: 'å', code: 'KeyA', altKey: true }))).toBe('Option+A');
    expect(buildAccelerator(keyEvent({ key: '，', code: 'Comma', shiftKey: true }))).toBe('Shift+,');
  });

  it('rejects bare modifier keys', () => {
    expect(buildAccelerator(keyEvent({ key: 'Meta' }))).toBeNull();
    expect(buildAccelerator(keyEvent({ key: 'Control' }))).toBeNull();
  });
});
