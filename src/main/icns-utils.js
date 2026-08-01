const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const icnsLib = require('icns-lib');

const execFileAsync = promisify(execFile);

const ICNS_PNG_TYPES = ['ic10', 'ic14', 'ic09', 'ic13', 'ic08', 'ic12', 'ic07', 'icp6', 'ic11', 'icp5', 'icp4'];
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPngBuffer(buffer) {
  return buffer && buffer.length >= PNG_MAGIC.length && buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}

function asBuffer(data) {
  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

async function convertIcnsToPng(icnsBuffer) {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'donut-icns-'));
  const inputPath = path.join(tmpDir, 'icon.icns');
  const outputPath = path.join(tmpDir, 'icon.png');
  try {
    await fs.promises.writeFile(inputPath, icnsBuffer);
    await execFileAsync('sips', ['-s', 'format', 'png', inputPath, '--out', outputPath]);
    return await fs.promises.readFile(outputPath);
  } catch {
    return null;
  } finally {
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Temp cleanup must never break icon extraction.
    }
  }
}

async function extractBestIconBuffer(icnsBuffer, convertIcnsToPngFn = convertIcnsToPng) {
  if (!icnsBuffer || icnsBuffer.length < 8) return null;
  let icons;
  try {
    icons = icnsLib.parse(icnsBuffer);
  } catch {
    return null;
  }
  for (const type of ICNS_PNG_TYPES) {
    const data = icons[type];
    if (!data || data.length === 0) continue;
    const buffer = asBuffer(data);
    if (isPngBuffer(buffer)) return buffer;
  }
  return convertIcnsToPngFn(icnsBuffer);
}

module.exports = { extractBestIconBuffer };
