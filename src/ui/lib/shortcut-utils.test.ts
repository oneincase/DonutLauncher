import { describe, expect, it } from 'vitest';
import { buildAccelerator, IS_MAC } from './shortcut-utils';

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
    const option = IS_MAC ? 'Option' : 'Alt';
    const command = IS_MAC ? 'Command' : 'Win';
    expect(buildAccelerator(keyEvent({ key: ' ', altKey: true }))).toBe(`${option}+Space`);
    expect(buildAccelerator(keyEvent({ key: 'a', metaKey: true, shiftKey: true }))).toBe(
      `${command}+Shift+A`,
    );
    expect(buildAccelerator(keyEvent({ key: 'ArrowRight' }))).toBe('Right');
    expect(buildAccelerator(keyEvent({ key: 'å', code: 'KeyA', altKey: true }))).toBe(
      `${option}+A`,
    );
    expect(buildAccelerator(keyEvent({ key: '，', code: 'Comma', shiftKey: true }))).toBe('Shift+,');
  });

  it('rejects bare modifier keys', () => {
    expect(buildAccelerator(keyEvent({ key: 'Meta' }))).toBeNull();
    expect(buildAccelerator(keyEvent({ key: 'Control' }))).toBeNull();
  });
});
