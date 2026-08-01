const icnsLib = require('icns-lib');

const ICNS_PNG_TYPES = ['ic10', 'ic14', 'ic09', 'ic13', 'ic08', 'ic12', 'ic07', 'icp6', 'ic11', 'icp5', 'icp4'];

function extractBestIconBuffer(icnsBuffer) {
  if (!icnsBuffer || icnsBuffer.length < 8) return null;
  try {
    const icons = icnsLib.parse(icnsBuffer);
    for (const type of ICNS_PNG_TYPES) {
      if (icons[type] && icons[type].length > 0) {
        return icons[type];
      }
    }
    const candidates = Object.keys(icons)
      .filter((type) => icnsLib.isImageType(type))
      .sort((a, b) => icons[b].length - icons[a].length);
    return candidates.length > 0 ? icons[candidates[0]] : null;
  } catch {
    return null;
  }
}

module.exports = { extractBestIconBuffer };
