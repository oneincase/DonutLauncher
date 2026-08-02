/**
 * 甜甜圈启动台 (Donut Launcher)
 * 开发人：oneincase <462534624@qq.com>
 * 更新日期：2026-08-02
 */
(function () {
  const donutSvg = document.getElementById('donut');
  const ringsGroup = document.getElementById('rings');
  const iconsGroup = document.getElementById('icons');
  const spinGroup = document.getElementById('spin-group');
  const centerGroup = document.getElementById('center');
  const searchInput = document.getElementById('search-input');
  const emptyState = document.getElementById('empty-state');
  const emptyMessage = document.getElementById('empty-message');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsTabs = document.getElementById('settings-tabs');
  const closeSettingsBtn = document.getElementById('close-btn');
  const saveSettingsBtn = document.getElementById('save-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const openSettingsBtn = document.getElementById('open-settings');
  const shortcutErrorEl = document.getElementById('shortcut-error');
  const shortcutInput = document.getElementById('shortcut-input');
  const recordBtn = document.getElementById('record-btn');
  const recordHint = document.getElementById('record-hint');
  const pickCenterBtn = document.getElementById('pick-center-btn');
  const resetCenterBtn = document.getElementById('reset-center-btn');
  const centerIconFile = document.getElementById('center-icon-file');
  const centerSizeInput = document.getElementById('center-size-input');
  const centerSizeValue = document.getElementById('center-size-value');
  const opacityInput = document.getElementById('opacity-input');
  const opacityValue = document.getElementById('opacity-value');
  const strokeInput = document.getElementById('stroke-input');
  const strokeValue = document.getElementById('stroke-value');
  const rotationSpeedInput = document.getElementById('rotation-speed-input');
  const rotationSpeedValue = document.getElementById('rotation-speed-value');
  const rotationInput = document.getElementById('rotation-input');
  const sortInput = document.getElementById('sort-input');
  const autoUpdateInput = document.getElementById('auto-update-input');
  const checkUpdateBtn = document.getElementById('check-update-btn');
  const updateDownloadBtn = document.getElementById('update-download-btn');
  const updateStatusEl = document.getElementById('update-status');
  const openBilibiliBtn = document.getElementById('open-bilibili-btn');
  const aboutVersionEl = document.getElementById('about-version');
  const colorPresets = document.getElementById('color-presets');
  const colorChips = document.getElementById('color-chips');
  const colorPreview = document.getElementById('color-preview');
  const colorHue = document.getElementById('color-hue');
  const colorSaturation = document.getElementById('color-saturation');
  const colorLightness = document.getElementById('color-lightness');
  const colorHex = document.getElementById('color-hex');
  const iconScaleInput = document.getElementById('icon-scale-input');
  const iconScaleValue = document.getElementById('icon-scale-value');
  const defaultPathsList = document.getElementById('default-paths-list');
  const customPathsList = document.getElementById('custom-paths-list');
  const addPathBtn = document.getElementById('add-path-btn');
  const hiddenAppsList = document.getElementById('hidden-apps-list');
  const unhideAllBtn = document.getElementById('unhide-all-btn');

  let viewSize = 720;
  const DEFAULT_COLORS = ['#FF6B9D', '#4ECDC4', '#FFE66D'];
  const COLOR_PRESETS = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#4C9AFF', '#51CF66', '#FF922B', '#AE7FF0', '#FFFFFF'];

  let apps = [];
  let settings = {};
  let layout = null;
  let searchQuery = '';
  let selectedIndex = 0;
  let rotationOffset = 0;
  let rotationId = null;
  let hoveredIcons = 0;
  let isSettingsOpen = false;
  let lastShortcutError = '';
  let ringColorsList = [];
  let recordingShortcut = false;
  let searchDebounceId = null;
  let initialLoadPromise = null;
  let iconBodies = [];
  let searchVisible = false;
  let latestUpdateInfo = null;

  function getVisibleApps() {
    const filtered = filterApps(apps, searchQuery, settings.excludedApps || []);
    return sortApps(filtered, settings.sortMode || 'name', settings.favorites || [], settings.recentUsage || {});
  }

  function getVisibleAppCount() {
    const excluded = new Set(settings.excludedApps || []);
    return apps.filter((app) => !excluded.has(app.name)).length;
  }

  async function loadSettings() {
    settings = await window.donut.getSettings();
    shortcutInput.value = settings.shortcut || 'Option+Space';
    opacityInput.value = settings.ringOpacity ?? 0.45;
    strokeInput.value = settings.ringStrokeWidth ?? 2;
    rotationSpeedInput.value = settings.rotationSpeed ?? 1;
    rotationInput.checked = settings.enableRotation ?? true;
    autoUpdateInput.checked = settings.autoCheckUpdate ?? true;
    sortInput.value = settings.sortMode || 'name';
    const version = await window.donut.getVersion();
    aboutVersionEl.textContent = `v${version}`;
    ringColorsList = settings.ringColors && settings.ringColors.length ? settings.ringColors.slice() : [...DEFAULT_COLORS];
    syncColorPicker(ringColorsList[ringColorsList.length - 1] || DEFAULT_COLORS[0]);
    centerSizeInput.value = settings.centerIconSize ?? 56;
    iconScaleInput.value = settings.iconScale ?? 1.25;
    renderHiddenApps();
    renderColorPresets();
    renderColorChips();
    renderScanPaths();
    applyIconScale();
    updateSliderLabels();
  }

  function updateSliderLabels() {
    opacityValue.textContent = Number(opacityInput.value).toFixed(2);
    strokeValue.textContent = strokeInput.value;
    rotationSpeedValue.textContent = rotationSpeedInput.value;
    centerSizeValue.textContent = centerSizeInput.value;
    iconScaleValue.textContent = Number(iconScaleInput.value).toFixed(2);
  }

  function applyIconScale() {
    donutSvg.style.setProperty('--icon-scale', String(settings.iconScale ?? 1.25));
  }

  function renderScanPaths() {
    const defaults = settings.defaultScanPaths || [];
    const stored = settings.scanPaths || [];
    const custom = stored.filter((p) => !defaults.includes(p));
    defaultPathsList.innerHTML = '';
    defaults.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'path-row';
      const label = document.createElement('span');
      label.textContent = p;
      row.appendChild(label);
      defaultPathsList.appendChild(row);
    });
    customPathsList.innerHTML = '';
    custom.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'path-row';
      const label = document.createElement('span');
      label.textContent = p;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '移除';
      button.addEventListener('click', () => {
        removeScanPath(p);
      });
      row.appendChild(label);
      row.appendChild(button);
      customPathsList.appendChild(row);
    });
  }

  async function saveScanPaths(customPaths) {
    const defaults = settings.defaultScanPaths || [];
    const updated = await window.donut.setSettings({ scanPaths: [...defaults, ...customPaths] });
    settings = updated;
    renderScanPaths();
  }

  async function addScanPath() {
    const folder = await window.donut.pickFolder();
    if (!folder) return;
    const defaults = settings.defaultScanPaths || [];
    const custom = (settings.scanPaths || []).filter((p) => !defaults.includes(p));
    if (!custom.includes(folder)) {
      custom.push(folder);
      await saveScanPaths(custom);
    }
  }

  function removeScanPath(folder) {
    const defaults = settings.defaultScanPaths || [];
    const custom = (settings.scanPaths || []).filter((p) => !defaults.includes(p) && p !== folder);
    saveScanPaths(custom);
  }

  async function loadApps() {
    apps = await window.donut.getApps();
    console.log(`[renderer] Loaded ${apps.length} apps`);
    await syncViewSize();
    renderAll();
  }

  async function syncViewSize() {
    try {
      const size = await window.donut.setWindowSize(getVisibleAppCount());
      if (size && size > 0) {
        viewSize = size;
        donutSvg.setAttribute('viewBox', `0 0 ${viewSize} ${viewSize}`);
      }
    } catch {
      // Keep the current view size when the window is not available.
    }
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
    const center = viewSize / 2;
    rings.forEach((ring, index) => {
      const circle = createSVGElement('circle', {
        cx: center,
        cy: center,
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
    hoveredIcons = 0;
    const iconSize = renderLayout.iconSize;
    const half = iconSize / 2;
    const labelFontSize = renderLayout.labelFontSize;
    const favorites = settings.favorites || [];

    icons.forEach((item, index) => {
      const g = createSVGElement('g', {
        class: 'app-icon',
        transform: `translate(${item.x}, ${item.y})`,
      });
      g.dataset.index = index;
      const body = createSVGElement('g', { class: 'app-icon-body' });

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
        body.appendChild(image);
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
        letter.textContent = (item.app.displayName || item.app.name || '?').charAt(0).toUpperCase();
        letter.style.fontSize = `${Math.max(labelFontSize + 2, 9)}px`;
        body.appendChild(circle);
        body.appendChild(letter);
      }

      const label = createSVGElement('text', {
        class: 'app-label',
        y: half + 12,
      });
      label.textContent = item.app.displayName || item.app.name;
      label.style.fontSize = `${labelFontSize}px`;
      body.appendChild(label);

      const star = createSVGElement('text', {
        x: half - 1,
        y: -half + 1,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        class: favorites.includes(item.app.id) ? 'app-star active' : 'app-star',
      });
      star.textContent = '★';
      star.style.fontSize = `${Math.max(12 * (iconSize / 48), 10)}px`;
      star.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleFavorite(item.app);
      });
      body.appendChild(star);

      const hideBtn = createSVGElement('text', {
        x: -half + 1,
        y: -half + 1,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        class: 'app-hide',
      });
      hideBtn.textContent = '×';
      hideBtn.style.fontSize = `${Math.max(14 * (iconSize / 48), 12)}px`;
      hideBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleHide(item.app);
      });
      body.appendChild(hideBtn);

      g.appendChild(body);
      g.addEventListener('click', () => {
        window.donut.launchApp(item.app.path);
      });
      iconsGroup.appendChild(g);
    });
    iconBodies = Array.from(iconsGroup.querySelectorAll('.app-icon-body'));
  }

  function renderCenter() {
    centerGroup.innerHTML = '';
    const center = viewSize / 2;
    const g = createSVGElement('g', { id: 'center-icon' });
    const size = settings.centerIconSize ?? 56;
    const centerIconPath = settings.centerIconPath || settings.defaultCenterIconPath;
    if (centerIconPath) {
      const inner = createSVGElement('g', { transform: `translate(${center}, ${center})` });
      const defs = createSVGElement('defs', {});
      const clip = createSVGElement('clipPath', { id: 'center-clip' });
      clip.appendChild(createSVGElement('circle', { cx: 0, cy: 0, r: size / 2 }));
      defs.appendChild(clip);
      inner.appendChild(defs);

      const image = createSVGElement('image', {
        x: -size / 2,
        y: -size / 2,
        width: size,
        height: size,
        href: centerIconPath,
        preserveAspectRatio: 'xMidYMid slice',
        'clip-path': 'url(#center-clip)',
      });
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', centerIconPath);
      inner.appendChild(image);

      const ring = createSVGElement('circle', {
        cx: 0,
        cy: 0,
        r: size / 2,
        fill: 'none',
        stroke: 'rgba(255, 255, 255, 0.35)',
        'stroke-width': 2,
      });
      inner.appendChild(ring);
      g.appendChild(inner);
      g.addEventListener('click', () => {
        toggleSettings();
      });
      centerGroup.appendChild(g);
      return;
    }

    const circle = createSVGElement('circle', {
      cx: center,
      cy: center,
      r: 44,
      fill: 'rgba(255, 255, 255, 0.12)',
      stroke: 'rgba(255, 255, 255, 0.3)',
      'stroke-width': 2,
    });

    const text = createSVGElement('text', {
      x: center,
      y: center,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': 36,
      class: 'center-emoji',
    });
    text.textContent = '🍩';

    g.appendChild(circle);
    g.appendChild(text);
    g.addEventListener('click', () => {
      toggleSettings();
    });
    centerGroup.appendChild(g);
  }

  function buildAccelerator(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('Control');
    if (event.metaKey) parts.push('Command');
    if (event.altKey) parts.push('Option');
    if (event.shiftKey) parts.push('Shift');
    const keyMap = {
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
    let key = keyMap[event.key] || (event.code === 'Space' ? 'Space' : event.key);
    if (key.length === 1) {
      if (!/^[A-Za-z0-9]$/.test(key)) return null;
      key = key.toUpperCase();
    }
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) return null;
    parts.push(key);
    return parts.join('+');
  }

  function cancelRecording() {
    recordingShortcut = false;
    recordBtn.textContent = '录制';
    recordBtn.classList.remove('active');
    recordHint.textContent = '请按下新的快捷键，Esc 取消';
    recordHint.classList.add('hidden');
  }

  function renderColorPresets() {
    colorPresets.innerHTML = '';
    COLOR_PRESETS.forEach((color) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-swatch';
      swatch.style.background = color;
      swatch.title = color;
      swatch.addEventListener('click', () => {
        addRingColor(color);
      });
      colorPresets.appendChild(swatch);
    });
  }

  function addRingColor(color) {
    if (!ringColorsList.includes(color)) {
      ringColorsList.push(color);
    }
    renderColorChips();
  }

  function removeRingColor(index) {
    ringColorsList.splice(index, 1);
    renderColorChips();
  }

  function renderColorChips() {
    colorChips.innerHTML = '';
    ringColorsList.forEach((color, index) => {
      const chip = document.createElement('div');
      chip.className = 'color-chip';
      chip.draggable = true;
      chip.dataset.index = index;
      chip.style.background = color;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'color-chip-remove';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        removeRingColor(index);
      });
      chip.appendChild(remove);

      chip.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', String(index));
        chip.classList.add('dragging');
      });
      chip.addEventListener('dragend', () => {
        chip.classList.remove('dragging');
      });
      chip.addEventListener('dragover', (event) => {
        event.preventDefault();
      });
      chip.addEventListener('drop', (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isNaN(from) || from === index) return;
        const [moved] = ringColorsList.splice(from, 1);
        const insertAt = from < index ? index - 1 : index;
        ringColorsList.splice(insertAt, 0, moved);
        renderColorChips();
      });

      colorChips.appendChild(chip);
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hslToHex(h, s, l) {
    const hue = (((h % 360) + 360) % 360) / 360;
    const sat = clamp(s / 100, 0, 1);
    const light = clamp(l / 100, 0, 1);
    const chroma = (1 - Math.abs(2 * light - 1)) * sat;
    const x = chroma * (1 - Math.abs(((hue * 6) % 2) - 1));
    const m = light - chroma / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hue < 1 / 6) {
      r = chroma;
      g = x;
    } else if (hue < 2 / 6) {
      r = x;
      g = chroma;
    } else if (hue < 3 / 6) {
      g = chroma;
      b = x;
    } else if (hue < 4 / 6) {
      g = x;
      b = chroma;
    } else if (hue < 5 / 6) {
      r = x;
      b = chroma;
    } else {
      r = chroma;
      b = x;
    }
    const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  function hexToHsl(hex) {
    const value = (hex || '').replace('#', '');
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / delta + 2) / 6;
      else h = ((r - g) / delta + 4) / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function normalizeHex(value) {
    const match = String(value || '').trim().match(/^#?([0-9a-fA-F]{6})$/);
    return match ? `#${match[1].toUpperCase()}` : null;
  }

  function updateColorPreview() {
    const hex = hslToHex(Number(colorHue.value), Number(colorSaturation.value), Number(colorLightness.value));
    colorPreview.style.background = hex;
    colorHex.value = hex;
    return hex;
  }

  function syncColorPicker(hex) {
    const normalized = normalizeHex(hex) || DEFAULT_COLORS[0];
    const { h, s, l } = hexToHsl(normalized);
    colorHue.value = h;
    colorSaturation.value = s;
    colorLightness.value = l;
    colorPreview.style.background = normalized;
    colorHex.value = normalized;
  }

  function applyTransform() {
    const scale = layout ? layout.fitScale : 1;
    const center = viewSize / 2;
    spinGroup.setAttribute(
      'transform',
      `translate(${center}, ${center}) rotate(${rotationOffset}) scale(${scale}) translate(${-center}, ${-center})`,
    );
  }

  function renderRing(visible) {
    const opacity = settings.ringOpacity ?? 0.45;
    const strokeWidth = settings.ringStrokeWidth ?? 2;
    const colors = settings.ringColors || DEFAULT_COLORS;
    layout = layoutApps(visible, colors, 0, viewSize);
    renderRings(layout.rings, opacity, strokeWidth);
    renderIcons(layout.icons, layout);
    renderCenter();
    applyTransform();
    updateIconTransforms();
  }

  function updateIconTransforms() {
    if (!layout) return;
    const transform = `rotate(${-rotationOffset} 0 0)`;
    iconBodies.forEach((body) => {
      body.setAttribute('transform', transform);
    });
  }

  function toggleFavorite(app) {
    const favorites = settings.favorites || [];
    const next = favorites.includes(app.id)
      ? favorites.filter((id) => id !== app.id)
      : [...favorites, app.id];
    window.donut.setSettings({ favorites: next }).then((updated) => {
      settings = updated;
      renderAll();
    });
  }

  function toggleHide(app) {
    const excluded = settings.excludedApps || [];
    const next = excluded.includes(app.name)
      ? excluded.filter((name) => name !== app.name)
      : [...excluded, app.name];
    window.donut.setSettings({ excludedApps: next }).then(async (updated) => {
      settings = updated;
      renderHiddenApps();
      await syncViewSize();
      renderAll();
    });
  }

  function unhideApp(name) {
    const excluded = (settings.excludedApps || []).filter((appName) => appName !== name);
    window.donut.setSettings({ excludedApps: excluded }).then(async (updated) => {
      settings = updated;
      renderHiddenApps();
      await syncViewSize();
      renderAll();
    });
  }

  function renderHiddenApps() {
    hiddenAppsList.innerHTML = '';
    const excluded = settings.excludedApps || [];
    if (excluded.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hidden-apps-empty';
      empty.textContent = '无';
      hiddenAppsList.appendChild(empty);
      return;
    }
    excluded.forEach((name) => {
      const row = document.createElement('div');
      row.className = 'hidden-app-row';
      const label = document.createElement('span');
      label.textContent = name;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '取消隐藏';
      button.addEventListener('click', () => {
        unhideApp(name);
      });
      row.appendChild(label);
      row.appendChild(button);
      hiddenAppsList.appendChild(row);
    });
  }

  function renderShortcutError() {
    if (lastShortcutError) {
      shortcutErrorEl.textContent = lastShortcutError;
      shortcutErrorEl.classList.remove('hidden');
    } else {
      shortcutErrorEl.classList.add('hidden');
    }
  }

  function updateSearchVisibility() {
    searchInput.classList.toggle('hidden', !searchVisible);
  }

  function toggleSearchVisibility() {
    searchVisible = !searchVisible;
    updateSearchVisibility();
    if (searchVisible) {
      searchInput.focus();
      return;
    }
    searchInput.value = '';
    searchQuery = '';
    selectedIndex = 0;
    renderAll();
  }

  function renderUpdateStatus() {
    const info = latestUpdateInfo;
    if (!info || info.error) {
      updateStatusEl.textContent = info && info.error ? `检查失败：${info.error}` : '检查更新失败';
      updateDownloadBtn.classList.add('hidden');
      return;
    }
    if (info.notice) {
      updateStatusEl.textContent = info.notice;
      updateDownloadBtn.classList.add('hidden');
      return;
    }
    if (info.hasUpdate) {
      updateStatusEl.textContent = `发现新版本 ${info.latestVersion}，当前版本 ${info.currentVersion}`;
      updateDownloadBtn.classList.remove('hidden');
    } else {
      updateStatusEl.textContent = `当前已是最新版本 ${info.currentVersion}`;
      updateDownloadBtn.classList.add('hidden');
    }
  }

  async function checkForUpdates() {
    checkUpdateBtn.disabled = true;
    updateStatusEl.textContent = '正在检查更新...';
    updateDownloadBtn.classList.add('hidden');
    try {
      latestUpdateInfo = await window.donut.checkUpdate();
      renderUpdateStatus();
    } catch {
      updateStatusEl.textContent = '检查更新失败，请稍后重试';
    } finally {
      checkUpdateBtn.disabled = false;
    }
  }

  function renderAll() {
    const visible = getVisibleApps();
    if (visible.length === 0) {
      emptyMessage.textContent = apps.length === 0 ? '暂无应用' : '没有匹配的应用';
      emptyState.classList.remove('hidden');
      donutSvg.classList.add('hidden');
      ringsGroup.innerHTML = '';
      iconsGroup.innerHTML = '';
      iconBodies = [];
      updateSearchVisibility();
      stopRotation();
      return;
    }

    emptyState.classList.add('hidden');
    donutSvg.classList.remove('hidden');
    updateSearchVisibility();
    renderRing(visible);
    updateSelection();
    syncRotation();
  }

  function updateSelection() {
    const visible = getVisibleApps();
    if (visible.length === 0) return;
    selectedIndex = clampIndex(selectedIndex, visible.length);
    document.querySelectorAll('#icons .app-icon').forEach((el) => {
      el.classList.toggle('selected', Number(el.dataset.index) === selectedIndex);
    });
  }

  function moveSelection(dx, dy) {
    const visible = getVisibleApps();
    if (visible.length === 0) return;
    selectedIndex = clampIndex(selectedIndex + (dy !== 0 ? dy : dx), visible.length);
    updateSelection();
  }

  function launchSelected() {
    const visible = getVisibleApps();
    const app = visible[selectedIndex];
    if (app) {
      window.donut.launchApp(app.path);
    }
  }

  function syncRotation() {
    if ((settings.enableRotation ?? true) && hoveredIcons === 0) {
      startRotation();
    } else {
      stopRotation();
    }
  }

  function pauseRotation() {
    if (rotationId) {
      cancelAnimationFrame(rotationId);
      rotationId = null;
    }
  }

  function resumeRotation() {
    if ((settings.enableRotation ?? true) && hoveredIcons === 0) {
      startRotation();
    }
  }

  function startRotation() {
    if (rotationId) cancelAnimationFrame(rotationId);
    const speed = settings.rotationSpeed ?? 1;
    if (speed <= 0) return;
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(now - last, 50);
      last = now;
      rotationOffset = (rotationOffset + dt * 0.006 * speed) % 360;
      applyTransform();
      updateIconTransforms();
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
      renderShortcutError();
      stopRotation();
    } else {
      settingsPanel.classList.add('hidden');
      syncRotation();
    }
  }

  closeSettingsBtn.addEventListener('click', toggleSettings);
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', toggleSettings);
  }

  [opacityInput, strokeInput, rotationSpeedInput, centerSizeInput, iconScaleInput].forEach((input) => {
    input.addEventListener('input', updateSliderLabels);
  });

  saveSettingsBtn.addEventListener('click', async () => {
    lastShortcutError = '';
    renderShortcutError();
    await window.donut.setSettings({
      ringColors: ringColorsList,
      ringOpacity: parseFloat(opacityInput.value),
      ringStrokeWidth: parseFloat(strokeInput.value),
      enableRotation: rotationInput.checked,
      shortcut: shortcutInput.value,
      rotationSpeed: parseFloat(rotationSpeedInput.value),
      iconScale: parseFloat(iconScaleInput.value),
      autoCheckUpdate: autoUpdateInput.checked,
      sortMode: sortInput.value,
      centerIconPath: settings.centerIconPath || '',
      centerIconSize: parseFloat(centerSizeInput.value),
    });
    settings = await window.donut.getSettings();
    renderHiddenApps();
    renderScanPaths();
    applyIconScale();
    toggleSettings();
    await window.donut.refreshApps();
    await loadApps();
  });

  refreshBtn.addEventListener('click', async () => {
    await window.donut.refreshApps();
    await loadApps();
  });

  addPathBtn.addEventListener('click', () => {
    addScanPath();
  });

  settingsTabs.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-tab]');
    if (!btn) return;
    settingsTabs.querySelectorAll('button').forEach((tabBtn) => {
      tabBtn.classList.toggle('active', tabBtn === btn);
    });
    settingsPanel.querySelectorAll('.settings-tab-pane').forEach((pane) => {
      pane.classList.toggle('hidden', pane.dataset.pane !== btn.dataset.tab);
    });
  });

  checkUpdateBtn.addEventListener('click', checkForUpdates);
  updateDownloadBtn.addEventListener('click', () => {
    if (latestUpdateInfo && latestUpdateInfo.releaseUrl) {
      window.donut.openExternal(latestUpdateInfo.releaseUrl);
    }
  });
  openBilibiliBtn.addEventListener('click', () => {
    window.donut.openExternal('https://space.bilibili.com/44240441');
  });

  recordBtn.addEventListener('click', () => {
    recordingShortcut = !recordingShortcut;
    recordBtn.textContent = recordingShortcut ? '取消' : '录制';
    recordBtn.classList.toggle('active', recordingShortcut);
    recordHint.textContent = '请按下新的快捷键，Esc 取消';
    recordHint.classList.toggle('hidden', !recordingShortcut);
  });

  pickCenterBtn.addEventListener('click', () => {
    centerIconFile.click();
  });

  centerIconFile.addEventListener('change', () => {
    const file = centerIconFile.files && centerIconFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      window.donut.setSettings({ centerIconPath: reader.result }).then((updated) => {
        settings = updated;
        renderCenter();
      });
    };
    reader.readAsDataURL(file);
  });

  resetCenterBtn.addEventListener('click', () => {
    window.donut.setSettings({ centerIconPath: '' }).then((updated) => {
      settings = updated;
      renderCenter();
    });
  });

  [colorHue, colorSaturation, colorLightness].forEach((input) => {
    input.addEventListener('input', updateColorPreview);
    input.addEventListener('change', () => {
      addRingColor(updateColorPreview());
    });
  });

  colorHex.addEventListener('change', () => {
    const hex = normalizeHex(colorHex.value);
    if (hex) {
      syncColorPicker(hex);
      addRingColor(hex);
    } else {
      colorHex.value = updateColorPreview();
    }
  });

  unhideAllBtn.addEventListener('click', () => {
    window.donut.setSettings({ excludedApps: [] }).then(async (updated) => {
      settings = updated;
      renderHiddenApps();
      await syncViewSize();
      renderAll();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (recordingShortcut) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        cancelRecording();
        return;
      }
      const accelerator = buildAccelerator(e);
      if (!accelerator) {
        if (e.key !== 'Meta' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') {
          recordHint.textContent = '该按键不支持，请使用字母、数字或功能键';
        }
        return;
      }
      shortcutInput.value = accelerator;
      cancelRecording();
      return;
    }
    if (isSettingsOpen) {
      if (e.key === 'Escape') toggleSettings();
      return;
    }
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        moveSelection(1, 0);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveSelection(-1, 0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(0, 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(0, -1);
        break;
      case 'Enter':
        e.preventDefault();
        launchSelected();
        break;
      case 'Escape':
        e.preventDefault();
        window.donut.hideWindow();
        break;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleSearchVisibility();
    }
  });

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    selectedIndex = 0;
    if (searchDebounceId) {
      clearTimeout(searchDebounceId);
    }
    searchDebounceId = setTimeout(() => {
      searchDebounceId = null;
      renderAll();
    }, 80);
  });

  iconsGroup.addEventListener('mouseover', (e) => {
    const icon = e.target.closest('.app-icon');
    if (!icon || icon.dataset.hovered) return;
    icon.dataset.hovered = '1';
    hoveredIcons += 1;
    if (hoveredIcons === 1) {
      pauseRotation();
    }
  });

  iconsGroup.addEventListener('mouseout', (e) => {
    const icon = e.target.closest('.app-icon');
    if (!icon || !icon.dataset.hovered) return;
    if (e.relatedTarget && icon.contains(e.relatedTarget)) return;
    delete icon.dataset.hovered;
    hoveredIcons -= 1;
    if (hoveredIcons === 0) {
      resumeRotation();
    }
  });

  window.donut.onShortcutError((shortcut) => {
    lastShortcutError = `快捷键 ${shortcut} 注册失败，可能被系统、输入法或其他应用占用；可尝试 Option+Shift+Space 或 Command+Option+Space`;
    renderShortcutError();
  });

  window.donut.onOpenSettings(() => {
    if (!isSettingsOpen) {
      toggleSettings();
    }
  });

  window.donut.onShow(async () => {
    settings = await window.donut.getSettings();
    renderHiddenApps();
    ringColorsList = settings.ringColors && settings.ringColors.length ? settings.ringColors.slice() : [...DEFAULT_COLORS];
    syncColorPicker(ringColorsList[ringColorsList.length - 1] || DEFAULT_COLORS[0]);
    centerSizeInput.value = settings.centerIconSize ?? 56;
    iconScaleInput.value = settings.iconScale ?? 1.25;
    renderColorChips();
    renderScanPaths();
    applyIconScale();
    updateSliderLabels();
    if (initialLoadPromise) {
      await initialLoadPromise;
    }
    searchInput.value = '';
    searchQuery = '';
    selectedIndex = 0;
    searchVisible = false;
    updateSearchVisibility();
    await syncViewSize();
    renderAll();
    syncRotation();
  });

  window.donut.onHide(() => {
    stopRotation();
    if (searchDebounceId) {
      clearTimeout(searchDebounceId);
      searchDebounceId = null;
    }
    hoveredIcons = 0;
    ringsGroup.innerHTML = '';
    iconsGroup.innerHTML = '';
    centerGroup.innerHTML = '';
    iconBodies = [];
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopRotation();
      if (searchDebounceId) {
        clearTimeout(searchDebounceId);
        searchDebounceId = null;
      }
      hoveredIcons = 0;
    } else {
      syncRotation();
    }
  });

  function init() {
    initialLoadPromise = (async () => {
      await loadSettings();
      await loadApps();
      syncRotation();
    })();
  }

  init();
})();
