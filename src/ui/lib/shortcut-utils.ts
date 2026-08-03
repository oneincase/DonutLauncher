const KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Return',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
};

export const IS_MAC =
  typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

const CODE_TO_KEY: Record<string, string> = {
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
};

export function buildAccelerator(event: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Control');
  if (event.metaKey) parts.push(IS_MAC ? 'Command' : 'Win');
  if (event.altKey) parts.push(IS_MAC ? 'Option' : 'Alt');
  if (event.shiftKey) parts.push('Shift');
  let normalizedKey = KEY_MAP[event.key] || (event.code === 'Space' ? 'Space' : event.key);
  if (normalizedKey.length === 1) {
    if (/^[A-Za-z0-9]$/.test(normalizedKey)) {
      normalizedKey = normalizedKey.toUpperCase();
    } else {
      const alpha = event.code.match(/^Key([A-Z])$/);
      const digit = event.code.match(/^Digit(\d)$/);
      if (alpha) normalizedKey = alpha[1];
      else if (digit) normalizedKey = digit[1];
      else if (CODE_TO_KEY[event.code]) normalizedKey = CODE_TO_KEY[event.code];
      else return null;
    }
  }
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(normalizedKey)) return null;
  parts.push(normalizedKey);
  return parts.join('+');
}
