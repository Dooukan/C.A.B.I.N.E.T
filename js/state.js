// Kaydet/yukle, undo/redo, autoSave (exportState/importState/pushSnapshot)
const _undoStack = [];
const _redoStack = [];
let _skipSnapshot = false;
const MAX_UNDO = 50;
let _saveTimer = null;

function pushSnapshot() {
  if (_skipSnapshot) return;
  const state = exportState();
  if (!state) return;
  _undoStack.push(state);
  _redoStack.length = 0;
  if (_undoStack.length > MAX_UNDO) _undoStack.shift();
}

function undo() {
  if (_undoStack.length < 2) return;
  const current = _undoStack.pop();
  _redoStack.push(current);
  const prev = _undoStack[_undoStack.length - 1];
  _skipSnapshot = true;
  importState(prev);
  _skipSnapshot = false;
  showToast(__('toast.undo'));
}

function redo() {
  if (!_redoStack.length) return;
  const next = _redoStack.pop();
  _undoStack.push(next);
  _skipSnapshot = true;
  importState(next);
  _skipSnapshot = false;
  showToast(__('toast.redo'));
}

function clearScene() {
  transformControls.detach();
  selectedNode = null;
  clearCellMarkers();
  for (const node of nodeMap.values()) {
    node.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
    });
    if (node.parent) node.parent.group.remove(node.group);
    else scene.remove(node.group);
  }
  nodeMap.clear();
  meshToNode.clear();
  nextNodeId = 1;
}

let _saveVersion = Date.now();

function exportState() {
  if (!cabinet) return null;
  const nodes = [];
  const idMap = new Map();
  function walk(n, parentIdx) {
    const idx = nodes.length;
    idMap.set(n.id, idx);
    nodes.push({
      name: n.name,
      parentIdx,
      position: { x: n.position.x, y: n.position.y, z: n.position.z },
      size: { x: n.size.x, y: n.size.y, z: n.size.z },
      rotation: { x: n.rotation.x, y: n.rotation.y, z: n.rotation.z },
      _baseRotation: { x: n._baseRotation.x, y: n._baseRotation.y, z: n._baseRotation.z },
      color: n.color,
      _metalness: n._metalness,
      _roughness: n._roughness,
      _hingeType: n._hingeType,
      _hingeSide: n._hingeSide,
      _hingeOffset: n._hingeOffset,
      _isBodyPanel: n._isBodyPanel || false,
      _splitScope: n._splitScope || null,
      _noMesh: !!n._noMesh,
      _bodyDepth: n._bodyDepth,
      _outerDoorThickness: n._outerDoorThickness,
    });
    for (const child of n.children) walk(child, idx);
  }
  walk(cabinet, -1);
  _saveVersion = Date.now();
  return { cabinetIndex: 0, nodes, _saveVersion };
}

function importState(data) {
  clearScene();
  if (!data || !data.nodes || !data.nodes.length) return;
  const created = [];
  for (let i = 0; i < data.nodes.length; i++) {
    const nd = data.nodes[i];
    const parent = nd.parentIdx >= 0 ? created[nd.parentIdx] : null;
    const node = new CabinetNode(nd.name, parent, true);
    node.position = { x: nd.position.x, y: nd.position.y, z: nd.position.z };
    node.size = { x: nd.size.x, y: nd.size.y, z: nd.size.z };
    node.rotation = { x: nd.rotation.x, y: nd.rotation.y, z: nd.rotation.z };
    node._baseRotation = { x: nd._baseRotation.x, y: nd._baseRotation.y, z: nd._baseRotation.z };
    node.color = nd.color;
    node._metalness = nd._metalness;
    node._roughness = nd._roughness;
    node._hingeType = nd._hingeType;
    node._hingeSide = nd._hingeSide;
    node._hingeOffset = nd._hingeOffset;
    node._isBodyPanel = nd._isBodyPanel;
    node._splitScope = nd._splitScope;
    node._bodyDepth = nd._bodyDepth;
    node._outerDoorThickness = nd._outerDoorThickness;
    if (!nd._noMesh) node.buildMesh();
    node._applyRotation();
    node.updatePos(nd.position.x, nd.position.y, nd.position.z);
    created.push(node);
  }
  cabinet = created[data.cabinetIndex || 0];
  _saveVersion = data._saveVersion || Date.now();
  controls.target.set(0, cabinet.size.y / 2, 0);
  controls.update();
  renderTree();
  renderProps();
  renderCellMarkers();
  renderDimensions();
  document.getElementById('hint').classList.remove('hidden');
}

function saveToFile() {
  const state = exportState();
  if (!state) { showToast(__('toast.noProject')); return; }
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cabin-design.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(__('toast.saved'));
}

function loadFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        importState(data);
        showToast(__('toast.loaded'));
      } catch { showToast(__('toast.invalid')); }
    };
    reader.readAsText(file);
  });
  input.click();
}

function autoSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    const raw = localStorage.getItem('magicCabin');
    if (raw) {
      try {
        const existing = JSON.parse(raw);
        if (existing._saveVersion && existing._saveVersion !== _saveVersion) {
          showToast(__('toast.conflict'));
        }
      } catch {}
    }
    const state = exportState();
    if (state) localStorage.setItem('magicCabin', JSON.stringify(state));
  }, 500);
}

function autoRestore() {
  try {
    const raw = localStorage.getItem('magicCabin');
    if (raw) {
      const data = JSON.parse(raw);
      importState(data);
      return true;
    }
  } catch {}
  return false;
}
