(function () {
  const ringsGroup = document.getElementById('rings');
  const iconsGroup = document.getElementById('icons');
  const spinGroup = document.getElementById('spin-group');
  const centerGroup = document.getElementById('center');
  const emptyState = document.getElementById('empty-state');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettingsBtn = document.getElementById('close-btn');
  const saveSettingsBtn = document.getElementById('save-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const openSettingsBtn = document.getElementById('open-settings');
  const shortcutInput = document.getElementById('shortcut-input');
  const opacityInput = document.getElementById('opacity-input');
  const strokeInput = document.getElementById('stroke-input');
  const colorsInput = document.getElementById('colors-input');
  const pathsInput = document.getElementById('paths-input');
  const rotationInput = document.getElementById('rotation-input');

  const CENTER = 360;
  const DEFAULT_COLORS = ['#FF6B9D', '#4ECDC4', '#FFE66D'];

  let apps = [];
  let settings = {};
  let layout = null;
  let rotationOffset = 0;
  let rotationId = null;
  let isSettingsOpen = false;

  async function loadSettings() {
    settings = await window.donut.getSettings();
    shortcutInput.value = settings.shortcut || 'Option+Space';
    opacityInput.value = settings.ringOpacity ?? 0.45;
    strokeInput.value = settings.ringStrokeWidth ?? 2;
    colorsInput.value = (settings.ringColors || DEFAULT_COLORS).join(', ');
    pathsInput.value = (settings.scanPaths || []).join('\n');
    rotationInput.checked = settings.enableRotation ?? true;
  }

  async function loadApps() {
    apps = await window.donut.getApps();
    console.log(`[renderer] Loaded ${apps.length} apps`);
    render();
  }

  function createSVGElement(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
    return el;
  }

  function renderRings(rings, opacity, strokeWidth) {
    ringsGroup.innerHTML = '';
    rings.forEach((ring, index) => {
      const circle = createSVGElement('circle', {
        cx: CENTER,
        cy: CENTER,
        r: ring.radius,
        stroke: ring.color,
        'stroke-width': strokeWidth,
        'stroke-opacity': opacity,
        fill: 'none',
        class: 'ring',
      });
      circle.dataset.ringIndex = index;
      ringsGroup.appendChild(circle);
    });
  }

  function renderIcons(icons, renderLayout) {
    iconsGroup.innerHTML = '';
    const iconSize = renderLayout.iconSize;
    const half = iconSize / 2;
    const labelFontSize = renderLayout.labelFontSize;

    icons.forEach((item) => {
      const g = createSVGElement('g', {
        class: 'app-icon',
        transform: `translate(${item.x}, ${item.y})`,
      });

      if (item.app.iconDataUrl) {
        const image = createSVGElement('image', {
          x: -half,
          y: -half,
          width: iconSize,
          height: iconSize,
          href: item.app.iconDataUrl,
          preserveAspectRatio: 'xMidYMid slice',
        });
        image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', item.app.iconDataUrl);
        g.appendChild(image);
      } else {
        const circle = createSVGElement('circle', {
          cx: 0,
          cy: 0,
          r: half,
          fill: 'rgba(255, 255, 255, 0.18)',
          stroke: 'rgba(255, 255, 255, 0.45)',
          'stroke-width': 1.5,
        });
        const letter = createSVGElement('text', {
          x: 0,
          y: 1,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          class: 'app-fallback-label',
        });
        letter.textContent = (item.app.name || '?').charAt(0).toUpperCase();
        letter.style.fontSize = `${Math.max(labelFontSize + 2, 9)}px`;
        g.appendChild(circle);
        g.appendChild(letter);
      }

      const label = createSVGElement('text', {
        class: 'app-label',
        y: half + 12,
      });
      label.textContent = item.app.name;
      label.style.fontSize = `${labelFontSize}px`;

      g.appendChild(label);
      g.addEventListener('click', () => {
        window.donut.launchApp(item.app.path);
      });
      iconsGroup.appendChild(g);
    });
  }

  function renderCenter() {
    centerGroup.innerHTML = '';
    const circle = createSVGElement('circle', {
      cx: CENTER,
      cy: CENTER,
      r: 44,
      fill: 'rgba(255, 255, 255, 0.12)',
      stroke: 'rgba(255, 255, 255, 0.3)',
      'stroke-width': 2,
    });

    const text = createSVGElement('text', {
      x: CENTER,
      y: CENTER,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': 36,
      class: 'center-emoji',
    });
    text.textContent = '🍩';

    const g = createSVGElement('g', { id: 'center-icon' });
    g.appendChild(circle);
    g.appendChild(text);
    g.addEventListener('click', () => {
      toggleSettings();
    });
    centerGroup.appendChild(g);
  }

  function applyTransform() {
    const scale = layout ? layout.fitScale : 1;
    spinGroup.setAttribute(
      'transform',
      `translate(${CENTER}, ${CENTER}) rotate(${rotationOffset}) scale(${scale}) translate(${-CENTER}, ${-CENTER})`,
    );
  }

  function render() {
    if (apps.length === 0) {
      emptyState.classList.remove('hidden');
      ringsGroup.innerHTML = '';
      iconsGroup.innerHTML = '';
      return;
    }
    emptyState.classList.add('hidden');
    const opacity = settings.ringOpacity ?? 0.45;
    const strokeWidth = settings.ringStrokeWidth ?? 2;
    const colors = settings.ringColors || DEFAULT_COLORS;
    layout = layoutApps(apps, colors);
    renderRings(layout.rings, opacity, strokeWidth);
    renderIcons(layout.icons, layout);
    renderCenter();
    applyTransform();
  }

  function startRotation() {
    if (rotationId) cancelAnimationFrame(rotationId);
    if (!(settings.enableRotation ?? true)) return;
    let last = performance.now();
    function frame(now) {
      const dt = now - last;
      last = now;
      rotationOffset = (rotationOffset + dt * 0.006) % 360;
      applyTransform();
      rotationId = requestAnimationFrame(frame);
    }
    rotationId = requestAnimationFrame(frame);
  }

  function stopRotation() {
    if (rotationId) {
      cancelAnimationFrame(rotationId);
      rotationId = null;
    }
  }

  function toggleSettings() {
    isSettingsOpen = !isSettingsOpen;
    if (isSettingsOpen) {
      settingsPanel.classList.remove('hidden');
      stopRotation();
    } else {
      settingsPanel.classList.add('hidden');
      startRotation();
    }
  }

  closeSettingsBtn.addEventListener('click', toggleSettings);
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', toggleSettings);
  }

  saveSettingsBtn.addEventListener('click', async () => {
    const colors = colorsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    const paths = pathsInput.value.split('\n').map((s) => s.trim()).filter(Boolean);
    await window.donut.setSettings({
      ringColors: colors,
      ringOpacity: parseFloat(opacityInput.value),
      ringStrokeWidth: parseFloat(strokeInput.value),
      scanPaths: paths,
      enableRotation: rotationInput.checked,
      shortcut: shortcutInput.value,
    });
    settings = await window.donut.getSettings();
    toggleSettings();
    await window.donut.refreshApps();
    await loadApps();
  });

  refreshBtn.addEventListener('click', async () => {
    await window.donut.refreshApps();
    await loadApps();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isSettingsOpen) {
        toggleSettings();
      } else {
        window.donut.hideWindow();
      }
    }
  });

  window.donut.onShow(() => {
    loadApps();
    startRotation();
  });

  async function init() {
    await loadSettings();
    await loadApps();
    renderCenter();
    startRotation();
  }

  init();
})();
