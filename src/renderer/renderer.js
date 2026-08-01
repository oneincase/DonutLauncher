(function () {
  const donutSvg = document.getElementById('donut');
  const ringsGroup = document.getElementById('rings');
  const iconsGroup = document.getElementById('icons');
  const spinGroup = document.getElementById('spin-group');
  const centerGroup = document.getElementById('center');
  const searchInput = document.getElementById('search-input');
  const gridView = document.getElementById('grid-view');
  const listView = document.getElementById('list-view');
  const emptyState = document.getElementById('empty-state');
  const emptyMessage = document.getElementById('empty-message');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettingsBtn = document.getElementById('close-btn');
  const saveSettingsBtn = document.getElementById('save-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const openSettingsBtn = document.getElementById('open-settings');
  const shortcutErrorEl = document.getElementById('shortcut-error');
  const shortcutInput = document.getElementById('shortcut-input');
  const layoutInput = document.getElementById('layout-input');
  const iconSizeInput = document.getElementById('icon-size-input');
  const opacityInput = document.getElementById('opacity-input');
  const strokeInput = document.getElementById('stroke-input');
  const rotationSpeedInput = document.getElementById('rotation-speed-input');
  const rotationInput = document.getElementById('rotation-input');
  const searchToggleInput = document.getElementById('search-toggle-input');
  const sortInput = document.getElementById('sort-input');
  const colorsInput = document.getElementById('colors-input');
  const pathsInput = document.getElementById('paths-input');
  const excludedInput = document.getElementById('excluded-input');

  const CENTER = 360;
  const DEFAULT_COLORS = ['#FF6B9D', '#4ECDC4', '#FFE66D'];

  let apps = [];
  let settings = {};
  let layout = null;
  let searchQuery = '';
  let selectedIndex = 0;
  let rotationOffset = 0;
  let rotationId = null;
  let isSettingsOpen = false;
  let lastShortcutError = '';

  function getVisibleApps() {
    const filtered = filterApps(apps, searchQuery, settings.excludedApps || []);
    return sortApps(filtered, settings.sortMode || 'name', settings.favorites || [], settings.recentUsage || {});
  }

  async function loadSettings() {
    settings = await window.donut.getSettings();
    shortcutInput.value = settings.shortcut || 'Option+Space';
    layoutInput.value = settings.layoutMode || 'ring';
    iconSizeInput.value = settings.iconSize ?? 64;
    opacityInput.value = settings.ringOpacity ?? 0.45;
    strokeInput.value = settings.ringStrokeWidth ?? 2;
    rotationSpeedInput.value = settings.rotationSpeed ?? 1;
    rotationInput.checked = settings.enableRotation ?? true;
    searchToggleInput.checked = settings.showSearchBar ?? true;
    sortInput.value = settings.sortMode || 'name';
    colorsInput.value = (settings.ringColors || DEFAULT_COLORS).join(', ');
    pathsInput.value = (settings.scanPaths || []).join('\n');
    excludedInput.value = (settings.excludedApps || []).join('\n');
  }

  async function loadApps() {
    apps = await window.donut.getApps();
    console.log(`[renderer] Loaded ${apps.length} apps`);
    renderAll();
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

    icons.forEach((item, index) => {
      const g = createSVGElement('g', {
        class: 'app-icon',
        transform: `translate(${item.x}, ${item.y})`,
      });
      g.dataset.index = index;

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

  function renderRing(visible) {
    const opacity = settings.ringOpacity ?? 0.45;
    const strokeWidth = settings.ringStrokeWidth ?? 2;
    const colors = settings.ringColors || DEFAULT_COLORS;
    layout = layoutApps(visible, colors);
    renderRings(layout.rings, opacity, strokeWidth);
    renderIcons(layout.icons, layout);
    renderCenter();
    applyTransform();
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

  function createAppItem(app, index, mode) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = mode === 'grid' ? 'app-item grid-item' : 'app-item list-item';
    item.dataset.index = index;
    item.addEventListener('click', () => {
      window.donut.launchApp(app.path);
    });

    const icon = document.createElement('span');
    icon.className = 'app-item-icon';
    if (app.iconDataUrl) {
      const img = document.createElement('img');
      img.src = app.iconDataUrl;
      img.alt = '';
      icon.appendChild(img);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'app-item-fallback';
      fallback.textContent = (app.name || '?').charAt(0).toUpperCase();
      icon.appendChild(fallback);
    }
    item.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'app-item-name';
    name.textContent = app.name;
    item.appendChild(name);

    const star = document.createElement('span');
    star.className = (settings.favorites || []).includes(app.id) ? 'app-item-star active' : 'app-item-star';
    star.textContent = '★';
    star.title = '收藏';
    star.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(app);
    });
    item.appendChild(star);
    return item;
  }

  function renderGrid(visible) {
    gridView.innerHTML = '';
    const grid = layoutGrid(visible, { iconSize: settings.iconSize || 64 });
    gridView.style.gridTemplateColumns = `repeat(${grid.cols}, minmax(0, 1fr))`;
    gridView.style.setProperty('--item-icon-size', `${settings.iconSize || 64}px`);
    visible.forEach((app, index) => {
      gridView.appendChild(createAppItem(app, index, 'grid'));
    });
  }

  function renderList(visible) {
    listView.innerHTML = '';
    listView.style.setProperty('--item-icon-size', `${settings.iconSize || 48}px`);
    visible.forEach((app, index) => {
      listView.appendChild(createAppItem(app, index, 'list'));
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

  function renderAll() {
    const visible = getVisibleApps();
    if (visible.length === 0) {
      emptyMessage.textContent = apps.length === 0 ? '暂无应用' : '没有匹配的应用';
      emptyState.classList.remove('hidden');
      donutSvg.classList.add('hidden');
      gridView.classList.add('hidden');
      listView.classList.add('hidden');
      ringsGroup.innerHTML = '';
      iconsGroup.innerHTML = '';
      searchInput.classList.toggle('hidden', !(settings.showSearchBar ?? true));
      stopRotation();
      return;
    }

    emptyState.classList.add('hidden');
    const mode = settings.layoutMode || 'ring';
    donutSvg.classList.toggle('hidden', mode !== 'ring');
    gridView.classList.toggle('hidden', mode !== 'grid');
    listView.classList.toggle('hidden', mode !== 'list');
    searchInput.classList.toggle('hidden', !(settings.showSearchBar ?? true));

    if (mode === 'grid') {
      renderGrid(visible);
    } else if (mode === 'list') {
      renderList(visible);
    } else {
      renderRing(visible);
    }
    updateSelection();
    syncRotation();
  }

  function updateSelection() {
    const visible = getVisibleApps();
    if (visible.length === 0) return;
    selectedIndex = clampIndex(selectedIndex, visible.length);
    document.querySelectorAll('.app-item').forEach((el) => {
      el.classList.toggle('selected', Number(el.dataset.index) === selectedIndex);
    });
    document.querySelectorAll('#icons .app-icon').forEach((el) => {
      el.classList.toggle('selected', Number(el.dataset.index) === selectedIndex);
    });
    const selectedEl = document.querySelector(`.app-item[data-index="${selectedIndex}"]`);
    if (selectedEl && selectedEl.scrollIntoView) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function moveSelection(dx, dy) {
    const visible = getVisibleApps();
    if (visible.length === 0) return;
    const mode = settings.layoutMode || 'ring';
    if (mode === 'grid') {
      const cols = layoutGrid(visible, { iconSize: settings.iconSize || 64 }).cols;
      const row = Math.floor(selectedIndex / cols);
      const col = selectedIndex % cols;
      const nextCol = (col + dx + cols) % cols;
      const nextRow = Math.min(Math.max(row + dy, 0), Math.ceil(visible.length / cols) - 1);
      let next = nextRow * cols + nextCol;
      if (next >= visible.length) next = Math.max(0, visible.length - 1);
      selectedIndex = next;
    } else {
      selectedIndex = clampIndex(selectedIndex + (dy !== 0 ? dy : dx), visible.length);
    }
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
    const mode = settings.layoutMode || 'ring';
    if (mode === 'ring' && (settings.enableRotation ?? true)) {
      startRotation();
    } else {
      stopRotation();
    }
  }

  function startRotation() {
    if (rotationId) cancelAnimationFrame(rotationId);
    const speed = settings.rotationSpeed ?? 1;
    if (speed <= 0) return;
    let last = performance.now();
    function frame(now) {
      const dt = now - last;
      last = now;
      rotationOffset = (rotationOffset + dt * 0.006 * speed) % 360;
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

  saveSettingsBtn.addEventListener('click', async () => {
    const colors = colorsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    const paths = pathsInput.value.split('\n').map((s) => s.trim()).filter(Boolean);
    const excluded = excludedInput.value.split('\n').map((s) => s.trim()).filter(Boolean);
    lastShortcutError = '';
    renderShortcutError();
    await window.donut.setSettings({
      ringColors: colors,
      ringOpacity: parseFloat(opacityInput.value),
      ringStrokeWidth: parseFloat(strokeInput.value),
      scanPaths: paths,
      enableRotation: rotationInput.checked,
      shortcut: shortcutInput.value,
      layoutMode: layoutInput.value,
      iconSize: parseFloat(iconSizeInput.value),
      rotationSpeed: parseFloat(rotationSpeedInput.value),
      showSearchBar: searchToggleInput.checked,
      sortMode: sortInput.value,
      excludedApps: excluded,
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
    if (isSettingsOpen) {
      if (e.key === 'Escape') toggleSettings();
      return;
    }
    switch (e.key) {
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        moveSelection(1, 0);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        moveSelection(-1, 0);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        moveSelection(0, 1);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
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
  });

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    selectedIndex = 0;
    renderAll();
  });

  window.donut.onShortcutError((shortcut) => {
    lastShortcutError = `快捷键 ${shortcut} 注册失败，可能已被其他应用占用`;
    renderShortcutError();
  });

  window.donut.onShow(async () => {
    settings = await window.donut.getSettings();
    await loadApps();
    searchInput.value = '';
    searchQuery = '';
    selectedIndex = 0;
    if (settings.showSearchBar ?? true) {
      searchInput.classList.remove('hidden');
      searchInput.focus();
    }
    syncRotation();
  });

  async function init() {
    await loadSettings();
    await loadApps();
    syncRotation();
  }

  init();
})();
