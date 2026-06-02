// Sahne kurulumu, createCabinet, addElement, event listeners, animate loop
let cabinet = null;
let selectedNode = null;
let activeTool = 'select';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(200, 300, 200);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -300;
dirLight.shadow.camera.right = 300;
dirLight.shadow.camera.top = 300;
dirLight.shadow.camera.bottom = -300;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
fillLight.position.set(-150, 100, -100);
scene.add(fillLight);

const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
camera.position.set(250, 200, 350);

const controls = new THREE.OrbitControls(camera, canvas);
controls.target.set(0, 80, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 50;
controls.maxDistance = 1500;

const transformControls = new THREE.TransformControls(camera, canvas);
transformControls.setMode('translate');
transformControls.setSize(0.8);
transformControls.setSpace('local');
scene.add(transformControls);

let isTransforming = false;

transformControls.addEventListener('dragging-changed', (ev) => {
  isTransforming = ev.value;
  controls.enabled = !ev.value;
  if (ev.value) { _prevPos = null; _snapAxis = null; }
  if (!ev.value) autoSave();
});

transformControls.addEventListener('change', () => {
  if (selectedNode) {
    constrainToDoor(selectedNode);
    selectedNode.position.x = selectedNode.group.position.x;
    selectedNode.position.y = selectedNode.group.position.y;
    selectedNode.position.z = selectedNode.group.position.z;
    const px = document.getElementById('pX');
    const py = document.getElementById('pY');
    const pz = document.getElementById('pZ');
    if (px) px.value = selectedNode.position.x.toFixed(1);
    if (py) py.value = selectedNode.position.y.toFixed(1);
    if (pz) pz.value = selectedNode.position.z.toFixed(1);
    checkSnap();
    const isDivider = selectedNode.name.includes('dikme') || selectedNode.name.includes('raf');
    if (isDivider) updateChildSizes();
    renderCellMarkers();
    renderTree();
    renderDimensions();
  }
});

function constrainToDoor(node) {
  if (!node.parent || !node.parent.name.includes('kapak')) return;
  const door = node.parent;
  const hw = door.size.x / 2 - 1;
  const hh = door.size.y / 2 - 1;
  const backZ = -door.size.z / 2;
  node.group.position.x = Math.max(-hw, Math.min(hw, node.group.position.x));
  node.group.position.y = Math.max(-hh, Math.min(hh, node.group.position.y));
  node.group.position.z = backZ;
}

const snapThreshold = 3;
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
let _prevPos = null;
let _snapAxis = null;

function checkSnap() {
  if (!selectedNode || !selectedNode._snapPoints.length) return;
  const dragged = selectedNode;
  if (_prevPos) {
    const dx = Math.abs(dragged.group.position.x - _prevPos.x);
    const dy = Math.abs(dragged.group.position.y - _prevPos.y);
    const dz = Math.abs(dragged.group.position.z - _prevPos.z);
    if (dx > 0.01 && dx >= dy && dx >= dz) _snapAxis = 'x';
    else if (dy > 0.01 && dy >= dx && dy >= dz) _snapAxis = 'y';
    else if (dz > 0.01 && dz >= dx && dz >= dy) _snapAxis = 'z';
  }
  _prevPos = dragged.group.position.clone();
  dragged.group.updateMatrixWorld();
  const dwp = dragged._snapPoints.map(sp => {
    const v = new THREE.Vector3(sp.x, sp.y, sp.z);
    v.applyMatrix4(dragged.group.matrixWorld);
    return v;
  });
  let bestDist = snapThreshold;
  let bestDelta = null;
  for (const node of nodeMap.values()) {
    if (node === dragged || !node._snapPoints.length) continue;
    node.group.updateMatrixWorld();
    for (const sp of node._snapPoints) {
      _vA.set(sp.x, sp.y, sp.z).applyMatrix4(node.group.matrixWorld);
      for (let i = 0; i < dwp.length; i++) {
        const d = _vA.distanceTo(dwp[i]);
        if (d < bestDist) {
          bestDist = d;
          const localPt = dragged._snapPoints[i];
          _vB.set(localPt.x, localPt.y, localPt.z).applyMatrix4(dragged.group.matrixWorld);
          bestDelta = new THREE.Vector3().copy(_vA).sub(_vB);
        }
      }
    }
  }
  if (bestDelta) {
    if (_snapAxis === 'x') bestDelta.y = 0, bestDelta.z = 0;
    else if (_snapAxis === 'y') bestDelta.x = 0, bestDelta.z = 0;
    else if (_snapAxis === 'z') bestDelta.x = 0, bestDelta.y = 0;
    dragged.group.position.add(bestDelta);
    dragged.position.x = dragged.group.position.x;
    dragged.position.y = dragged.group.position.y;
    dragged.position.z = dragged.group.position.z;
  }
}

function updateChildSizes() {
  if (!cabinet) return;
  const t = 1.8;
  const d = cabinet.size.z;
  const cells = getCells();
  for (const node of cabinet.children) {
    if (node.name.includes('kapak')) continue;
    if (node.name.includes('dikme') || node.name.includes('raf')) continue;
    if (node._noMesh) continue;
    const nxL = node.position.x - node.size.x / 2;
    const nxR = node.position.x + node.size.x / 2;
    const nyB = node.position.y - node.size.y / 2;
    const nyT = node.position.y + node.size.y / 2;
    const matching = cells.filter(c => {
      const xO = Math.min(nxR, c.xR) - Math.max(nxL, c.xL);
      const yO = Math.min(nyT, c.yT) - Math.max(nyB, c.yB);
      return xO > 1 && yO > 1;
    });
    if (!matching.length) continue;
    const cMinX = Math.min(...matching.map(c => c.xL));
    const cMaxX = Math.max(...matching.map(c => c.xR));
    const cMinY = Math.min(...matching.map(c => c.yB));
    const cMaxY = Math.max(...matching.map(c => c.yT));
    const ccx = (cMinX + cMaxX) / 2;
    const ccy = (cMinY + cMaxY) / 2;
    if (node.name.includes('cekmece')) {
      node.setSize((cMaxX - cMinX) - 2 * t, 15, d);
      node.updatePos(ccx, t + 7.5, 0);
    } else if (node.name.includes('aski')) {
      node.setSize((cMaxX - cMinX) - 2, 1.5, 1.5);
      node.updatePos(ccx, cMaxY - 10, d / 2 - 5);
    }
  }
}

function createCabinet(w, h, d) {
  clearScene();
  const t = 1.8;
  const root = new CabinetNode('dolap', null, true);
  root.size = { x: w, y: h, z: d };
  root._bodyDepth = d;
  root._outerDoorThickness = 0;

  const top = new CabinetNode('üst panel', root);
  top.setSize(w, d, t);
  top.setBaseRotation(90, 0, 0);
  top.updatePos(0, h - t / 2, 0);
  top._isBodyPanel = true;

  const bot = new CabinetNode('alt panel', root);
  bot.setSize(w, d, t);
  bot.setBaseRotation(90, 0, 0);
  bot.updatePos(0, t / 2, 0);
  bot._isBodyPanel = true;

  const left = new CabinetNode('sol panel', root);
  left.setSize(d, h - 2 * t, t);
  left.setBaseRotation(0, 90, 0);
  left.updatePos(-w / 2 + t / 2, h / 2, 0);
  left._isBodyPanel = true;

  const right = new CabinetNode('sağ panel', root);
  right.setSize(d, h - 2 * t, t);
  right.setBaseRotation(0, 90, 0);
  right.updatePos(w / 2 - t / 2, h / 2, 0);
  right._isBodyPanel = true;

  const back = new CabinetNode('arka panel', root);
  back.setSize(w, h, 0.2);
  back.color = '#ffffff';
  back.buildMesh();
  back.updatePos(0, h / 2, -d / 2);
  back._isBodyPanel = true;

  root.updatePos(0, 0, 0);
  cabinet = root;
  renderTree();
  renderProps();
  renderCellMarkers();
  renderDimensions();
  controls.target.set(0, h / 2, 0);
  controls.update();
  document.getElementById('hint').classList.remove('hidden');
  pushSnapshot();
  autoSave();
}

function updateCabinetDepth() {
  if (!cabinet) return;
  const t = 1.8;
  const w = cabinet.size.x, h = cabinet.size.y;
  const oldDepth = cabinet.size.z;
  const newDepth = oldDepth + t;
  cabinet._outerDoorThickness = t;
  cabinet._bodyDepth = oldDepth;
  cabinet.size.z = newDepth;
  for (const node of nodeMap.values()) {
    if (!node._isBodyPanel) continue;
    if (node.name === 'üst panel' || node.name === 'alt panel') {
      node.setSize(w, newDepth, t);
      if (node.name === 'üst panel') node.updatePos(0, h - t / 2, 0);
      else node.updatePos(0, t / 2, 0);
    } else if (node.name === 'sol panel' || node.name === 'sağ panel') {
      node.setSize(newDepth, h - 2 * t, t);
      if (node.name === 'sol panel') node.updatePos(-w / 2 + t / 2, h / 2, 0);
      else node.updatePos(w / 2 - t / 2, h / 2, 0);
    } else if (node.name === 'arka panel') {
      node.updatePos(0, h / 2, -newDepth / 2);
    }
  }
  renderProps();
  renderCellMarkers();
  renderTree();
  renderProps();
}

function updateDoorSize(door) {
  if (!cabinet || !door.name.includes('kapak')) return;
  const offset = door._hingeOffset || 0;
  const newW = door.size.x + offset;
  if (newW > 0) {
    door.setSize(newW, door.size.y, door.size.z);
  }
}

function removeNode(node) {
  if (!node || node._noMesh) return;
  if (selectedNode === node) selectedNode.deselect();
  transformControls.detach();
  node.group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
  });
  node.parent.group.remove(node.group);
  node.parent.children = node.parent.children.filter(c => c !== node);
  nodeMap.delete(node.id);
  meshToNode.forEach((n, m) => { if (n === node) meshToNode.delete(m); });
  renderProps();
  renderCellMarkers();
  renderDimensions();
}

async function addElement(type) {
  if (!cabinet) return;
  const t = 1.8;
  const w = cabinet.size.x, h = cabinet.size.y, d = cabinet.size.z;
  const count = parseInt(document.getElementById('multiCount').value) || 1;
  const num = Math.max(1, count);
  let nodes = [];
  if (type === 'raf') {
    const cells = _selectedCells.length ? _selectedCells : [findCellAt(selectedNode ? selectedNode.position.x : 0, selectedNode ? selectedNode.position.y : h / 2)];
    if (!cells[0]) return;
    const minX = Math.min(...cells.map(c => c.xL));
    const maxX = Math.max(...cells.map(c => c.xR));
    const rafW = (maxX - minX) - 1.8;
    const cellH = cells[0].yT - cells[0].yB;
    pushSnapshot();
    for (let i = 0; i < num; i++) {
      const rafY = cells[0].yB + (i + 1) * cellH / (num + 1);
      const node = new CabinetNode('raf', cabinet);
      node.setSize(rafW, d, t);
      node.setBaseRotation(90, 0, 0);
      node.updatePos((minX + maxX) / 2, rafY, 0);
      node.color = '#6d4c41';
      node._splitScope = cells.map(c => ({ xL: c.xL, xR: c.xR, yB: c.yB, yT: c.yT }));
      nodes.push(node);
    }
  } else if (type === 'cekmece') {
    pushSnapshot();
    const node = new CabinetNode('çekmece', cabinet);
    node.setSize(w - 2 * t, 15, d);
    node.updatePos(0, t + 7.5, 0);
    node.color = '#795548';
    nodes.push(node);
  } else if (type === 'aski') {
    const cells = _selectedCells.length ? _selectedCells : [findCellAt(selectedNode ? selectedNode.position.x : 0, selectedNode ? selectedNode.position.y : h / 2)];
    if (!cells[0]) return;
    pushSnapshot();
    const minX = Math.min(...cells.map(c => c.xL));
    const maxX = Math.max(...cells.map(c => c.xR));
    const askiW = (maxX - minX) - 2;
    const askiY = cells[0].yT - 10;
    const askiZ = d / 2 - 5;
    const node = new CabinetNode('askı çubuğu', cabinet);
    node.setSize(askiW, 1.5, 1.5);
    node.updatePos((minX + maxX) / 2, askiY, askiZ);
    node.color = '#9e9e9e';
    nodes.push(node);
  } else if (type === 'dikme') {
    const cells = _selectedCells.length ? _selectedCells : [findCellAt(selectedNode ? selectedNode.position.x : 0, selectedNode ? selectedNode.position.y : h / 2)];
    if (!cells[0]) return;
    const minY = Math.min(...cells.map(c => c.yB));
    const maxY = Math.max(...cells.map(c => c.yT));
    const dikmeH = maxY - minY;
    const cellW = cells[0].xR - cells[0].xL;
    pushSnapshot();
    for (let i = 0; i < num; i++) {
      const dikmeX = cells[0].xL + (i + 1) * cellW / (num + 1);
      const node = new CabinetNode('dikme', cabinet);
      node.setSize(d, dikmeH, t);
      node.setBaseRotation(0, 90, 0);
      node.updatePos(dikmeX, (minY + maxY) / 2, 0);
      node.color = '#5d4037';
      node._splitScope = cells.map(c => ({ xL: c.xL, xR: c.xR, yB: c.yB, yT: c.yT }));
      nodes.push(node);
    }
  } else if (type === 'kapak-ic' || type === 'kapak-dis') {
    const cells = _selectedCells.length ? _selectedCells : getCells();
    if (!cells.length) return;
    pushSnapshot();
    const doorT = 1.8;
    const minX = Math.min(...cells.map(c => c.xL));
    const maxX = Math.max(...cells.map(c => c.xR));
    const minY = Math.min(...cells.map(c => c.yB));
    const maxY = Math.max(...cells.map(c => c.yT));
    const cellW = maxX - minX;
    const cellH = maxY - minY;
    const bodyD = cabinet._bodyDepth || d;
    const doorZ = type === 'kapak-dis' ? bodyD / 2 + doorT / 2 : bodyD / 2 - doorT / 2;
    const name = type === 'kapak-dis' ? 'dış kapak' : 'iç kapak';
    for (let i = 0; i < num; i++) {
      const partW = cellW / num;
      const doorW = (type === 'kapak-dis' ? partW + 0.5 : partW - 0.6) - 1.2;
      const doorH = type === 'kapak-dis' ? cellH + 1.8 : cellH - 0.6;
      const partCenterX = minX + (i + 0.5) * partW;
      let doorX = num === 1 && _selectedCellSide === 'left' ? minX + doorW / 2 : num === 1 && _selectedCellSide === 'right' ? maxX - doorW / 2 : partCenterX;
      let doorY = (minY + maxY) / 2;
      if (type === 'kapak-dis') {
        if (num === 1 && _selectedCellSide === 'left') doorX -= 0.9;
        else if (num === 1 && _selectedCellSide === 'right') doorX += 0.9;
        doorY += 0.9;
      }
      const node = new CabinetNode(name, cabinet);
      node.setSize(Math.max(0.1, doorW), doorH, doorT);
      node.updatePos(doorX, doorY, doorZ);
      node.color = '#8d6e63';
      node._hingeType = '1';
      node._hingeSide = i < num / 2 ? '1' : '2';
      node._hingeOffset = 0.5;
      nodes.push(node);
    }
    _selectedCells = [];
    _selectedCellSide = null;
    document.querySelectorAll('.cellMarker').forEach(m => m.classList.remove('selected'));
    renderCellMarkers();
    renderTree();
    renderDimensions();
    document.getElementById('hint').textContent = 'Bir panel seçmek için tıklayın';
    autoSave();
    document.getElementById('multiCount').value = 1;
    return;
  }
  if (nodes.length) {
    renderCellMarkers();
    renderTree();
    renderDimensions();
    document.getElementById('hint').textContent = 'Bir panel seçmek için tıklayın';
    autoSave();
    document.getElementById('multiCount').value = 1;
  }
}

document.getElementById('topbar').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-type]');
  if (!btn) return;
  await addElement(btn.dataset.type);
});

document.getElementById('btnNew').addEventListener('click', () => {
  document.getElementById('welcome').classList.remove('hidden');
});
document.getElementById('btnSave').addEventListener('click', saveToFile);
document.getElementById('btnLoad').addEventListener('click', loadFromFile);
document.getElementById('mCreate').addEventListener('click', () => {
  const w = +document.getElementById('mW').value;
  const h = +document.getElementById('mH').value;
  const d = +document.getElementById('mD').value;
  if (w > 0 && h > 0 && d > 0) {
    createCabinet(w, h, d);
    document.getElementById('welcome').classList.add('hidden');
  }
});

function setActiveTool(tool) {
  activeTool = tool;
  document.querySelectorAll('#toolbar button').forEach(b => b.classList.toggle('active', b.id === 'tool' + tool.charAt(0).toUpperCase() + tool.slice(1)));
  if (tool === 'move') {
    clearCellMarkers();
    if (selectedNode) {
      transformControls.setSpace('local');
      transformControls.attach(selectedNode.group);
      transformControls.showX = true;
      transformControls.showY = true;
      transformControls.showZ = true;
    }
  } else {
    transformControls.detach();
    renderCellMarkers();
  }
}

function attachTransform() {
  if (activeTool === 'move' && selectedNode) {
    transformControls.setSpace('local');
    transformControls.attach(selectedNode.group);
    transformControls.showX = true;
    transformControls.showY = true;
    transformControls.showZ = true;
    transformControls.update();
  }
  else transformControls.detach();
}

document.getElementById('toolSelect').addEventListener('click', () => setActiveTool('select'));
document.getElementById('toolMove').addEventListener('click', () => setActiveTool('move'));

let _ctrlHandled = false;
let _shiftLock = false;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Control' && !_ctrlHandled) {
    _ctrlHandled = true;
    setActiveTool(activeTool === 'select' ? 'move' : 'select');
  }
  if (e.key === 'Shift' && activeTool === 'select') {
    controls.enabled = false;
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Control') _ctrlHandled = false;
  if (e.key === 'Shift') {
    controls.enabled = true;
  }
});

document.addEventListener('keydown', async (e) => {
  const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA';

  if (e.key === 'Escape') {
    if (calcPanel.classList.contains('show')) calcPanel.classList.remove('show');
    else if (document.getElementById('exportModal').classList.contains('show')) document.getElementById('exportModal').classList.remove('show');
    else if (document.getElementById('dialog').classList.contains('show')) closeDialog(null);
    else if (selectedNode) { _clearBoxHighlights(); selectedNode.deselect(); }
    return;
  }

  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey && e.key === 'c') {
    if (!selectedNode || selectedNode._noMesh) return;
    e.preventDefault();
    const copy = new CabinetNode(selectedNode.name + ' (kopya)', selectedNode.parent);
    copy.setSize(selectedNode.size.x, selectedNode.size.y, selectedNode.size.z);
    copy.setBaseRotation(selectedNode._baseRotation.x, selectedNode._baseRotation.y, selectedNode._baseRotation.z);
    copy.setRotation(selectedNode.rotation.x, selectedNode.rotation.y, selectedNode.rotation.z);
    copy.updatePos(selectedNode.position.x + selectedNode.size.x + 1, selectedNode.position.y, selectedNode.position.z);
    copy.color = selectedNode.color;
    copy._hingeType = selectedNode._hingeType;
    copy._hingeSide = selectedNode._hingeSide;
    copy.select();
    setActiveTool('move');
    renderProps();
    renderCellMarkers();
    renderTree();
    renderDimensions();
    showToast('Kopyalandı');
    autoSave();
    return;
  }
  if (e.ctrlKey && e.key === 'e') { e.preventDefault(); showExport(); return; }
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); document.getElementById('welcome').classList.remove('hidden'); return; }

  if (e.key === 'Delete' && !isInput && selectedNode) { removeNode(selectedNode); showToast('Silindi'); autoSave(); return; }
  if (e.key === 'F2' && !isInput && selectedNode && !selectedNode._noMesh) {
    e.preventDefault();
    const newName = await showDialog('Yeni Ad', 'Ad girin', selectedNode.name);
    if (newName && newName.trim()) { selectedNode.name = newName.trim(); renderProps(); autoSave(); }
  }
  if (e.key === 'v' && !isInput) setActiveTool('select');
  if (e.key === 'g' && !isInput) setActiveTool('move');
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let _boxHighlighted = [];

function _clearBoxHighlights() {
  for (const n of _boxHighlighted) {
    if (n._outline) n._outline.visible = false;
  }
  _boxHighlighted = [];
}

function _boxSelectNodeIn(screenRect) {
  _clearBoxHighlights();
  if (selectedNode && selectedNode._outline) selectedNode._outline.visible = false;
  selectedNode = null;
  renderProps();
  const worldBox = new THREE.Box3();
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3());
  let firstHit = null;
  for (const node of nodeMap.values()) {
    if (node._noMesh || !node.mesh) continue;
    worldBox.setFromObject(node.mesh);
    if (worldBox.isEmpty()) continue;
    const b = worldBox;
    corners[0].set(b.min.x, b.min.y, b.min.z);
    corners[1].set(b.max.x, b.min.y, b.min.z);
    corners[2].set(b.min.x, b.max.y, b.min.z);
    corners[3].set(b.max.x, b.max.y, b.min.z);
    corners[4].set(b.min.x, b.min.y, b.max.z);
    corners[5].set(b.max.x, b.min.y, b.max.z);
    corners[6].set(b.min.x, b.max.y, b.max.z);
    corners[7].set(b.max.x, b.max.y, b.max.z);
    let hit = false;
    for (const c of corners) {
      c.project(camera);
      const sx = (c.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-c.y * 0.5 + 0.5) * window.innerHeight;
      if (c.z <= 1 && sx >= screenRect.x && sx <= screenRect.z && sy >= screenRect.y && sy <= screenRect.w) {
        hit = true;
        break;
      }
    }
    if (hit) {
      if (!firstHit) firstHit = node;
      if (node._outline) node._outline.visible = true;
      _boxHighlighted.push(node);
    }
  }
  if (firstHit) {
    selectedNode = firstHit;
    renderProps();
    attachTransform();
    document.getElementById('hint').classList.add('hidden');
  } else {
    document.getElementById('hint').classList.remove('hidden');
    attachTransform();
  }
}

const _boxSelect = { active: false, startX: 0, startY: 0, endX: 0, endY: 0, el: null };
_boxSelect.el = document.createElement('div');
_boxSelect.el.style.cssText = 'position:fixed;border:2px dashed #e67e22;background:rgba(230,126,34,0.08);pointer-events:none;z-index:100;display:none';
document.body.appendChild(_boxSelect.el);

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('mousedown', (e) => {
  const isBox = (e.button === 2 || (e.shiftKey && e.button === 0)) && activeTool === 'select' && !isTransforming;
  if (isBox) {
    e.stopImmediatePropagation();
    e.preventDefault();
    _boxSelect.active = true;
    _boxSelect.startX = _boxSelect.endX = e.clientX;
    _boxSelect.startY = _boxSelect.endY = e.clientY;
    _boxSelect.el.style.display = '';
    _boxSelect.el.style.left = e.clientX + 'px';
    _boxSelect.el.style.top = e.clientY + 'px';
    _boxSelect.el.style.width = '0px';
    _boxSelect.el.style.height = '0px';
  }
}, { capture: true });

document.addEventListener('mousemove', (e) => {
  if (!_boxSelect.active) return;
  _boxSelect.endX = e.clientX;
  _boxSelect.endY = e.clientY;
  const x = Math.min(_boxSelect.startX, _boxSelect.endX);
  const y = Math.min(_boxSelect.startY, _boxSelect.endY);
  const w = Math.abs(_boxSelect.endX - _boxSelect.startX);
  const h = Math.abs(_boxSelect.endY - _boxSelect.startY);
  _boxSelect.el.style.left = x + 'px';
  _boxSelect.el.style.top = y + 'px';
  _boxSelect.el.style.width = w + 'px';
  _boxSelect.el.style.height = h + 'px';
});

document.addEventListener('mouseup', (e) => {
  if (!_boxSelect.active) return;
  _boxSelect.active = false;
  _boxSelect.el.style.display = 'none';
  const dx = Math.abs(_boxSelect.endX - _boxSelect.startX);
  const dy = Math.abs(_boxSelect.endY - _boxSelect.startY);
  if (dx < 5 && dy < 5) return;
  _selectedCells = [];
  _selectedCellSide = null;
  document.querySelectorAll('.cellMarker').forEach(m => m.classList.remove('selected'));
  _boxSelectNodeIn({
    x: Math.min(_boxSelect.startX, _boxSelect.endX),
    y: Math.min(_boxSelect.startY, _boxSelect.endY),
    z: Math.max(_boxSelect.startX, _boxSelect.endX),
    w: Math.max(_boxSelect.startY, _boxSelect.endY),
  });
});

renderer.domElement.addEventListener('click', (e) => {
  if (isTransforming) return;
  _clearBoxHighlights();
  _selectedCells = [];
  _selectedCellSide = null;
  document.querySelectorAll('.cellMarker').forEach(m => m.classList.remove('selected'));
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const meshes = [];
  for (const node of nodeMap.values()) { if (node.mesh) meshes.push(node.mesh); }
  const hits = raycaster.intersectObjects(meshes);
  const node = hits.length > 0 ? meshToNode.get(hits[0].object) : null;
  if (node) node.select();
  else if (selectedNode) selectedNode.deselect();
});

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderCellMarkers();
}
window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (selectedNode && activeTool === 'move') {
    const dist = camera.position.distanceTo(selectedNode.group.position);
    const s = Math.max(0.4, dist / 400);
    transformControls.setSize(s);
  }
  if (_cellMarkers.length && activeTool === 'select') {
    const cells = getCells();
    _cellMarkers.forEach((el, i) => {
      if (i >= cells.length) return;
      const cell = cells[i];
      const v = new THREE.Vector3(cell.cx, cell.cy, 0);
      const screenPos = v.clone().project(camera);
      const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.display = screenPos.z > 1 ? 'none' : '';
    });
  }
  renderer.render(scene, camera);
}
animate();

if (!autoRestore()) document.getElementById('welcome').classList.remove('hidden');
