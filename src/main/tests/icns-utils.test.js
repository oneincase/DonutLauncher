const test = require('node:test');
const assert = require('node:assert');
const { extractBestIconBuffer } = require('../icns-utils.js');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

function icnsChunk(type, pngBuffer) {
  const chunk = Buffer.alloc(8 + pngBuffer.length);
  chunk.write(type, 0, 'ascii');
  chunk.writeUInt32BE(chunk.length, 4);
  pngBuffer.copy(chunk, 8);
  return chunk;
}

function makeIcns(chunks) {
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  const body = Buffer.concat(chunks);
  header.writeUInt32BE(header.length + body.length, 4);
  return Buffer.concat([header, body]);
}

test('extracts png chunk from icns', () => {
  const result = extractBestIconBuffer(makeIcns([icnsChunk('icp5', TINY_PNG)]));
  assert.ok(result);
  assert.ok(result.equals(TINY_PNG));
});

test('prefers larger png chunks', () => {
  const larger = Buffer.concat([TINY_PNG, Buffer.alloc(32)]);
  const icns = makeIcns([icnsChunk('icp4', TINY_PNG), icnsChunk('icp5', larger)]);
  assert.ok(extractBestIconBuffer(icns).equals(larger));
});

test('returns null for invalid input', () => {
  assert.strictEqual(extractBestIconBuffer(null), null);
  assert.strictEqual(extractBestIconBuffer(Buffer.from('nope')), null);
});
