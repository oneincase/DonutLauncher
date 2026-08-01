const { spawn } = require('child_process');
const path = require('path');

function launchApp(appPath) {
  const normalized = path.normalize(appPath);
  const child = spawn('open', [normalized], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return { success: true };
}

module.exports = { launchApp };
