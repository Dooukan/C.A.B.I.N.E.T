let _selectedCells = [];
let _selectedCellSide = null;
let _cellMarkers = [];
let _dialogResolve = null;
let _toastTimer = null;
let _exportData = [];
let _calcExpr = '';
let _calcDrag = { active: false, offsetX: 0, offsetY: 0 };

function renderTree() {
  const list = document.getElementById('treeList');
  list.innerHTML = '';
  if (!cabinet) return;
  const allChildren = cabinet.children.filter(c => !c._noMesh);
  const counts = {};
  for (const item of allChildren) {
    const base = item.name.replace(/\s*\d+$/, '');
    counts[base] = (counts[base] || 0) + 1;
    const displayName = counts[base] > 1 ? `${base} ${counts[base]}` : item.name;
    const li = document.createElement('li');
    if (selectedNode === item) li.classList.add('selected');
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = '▪';
    li.appendChild(icon);
    li.appendChild(document.createTextNode(displayName));
    li.addEventListener('click', () => {
      if (item.name.includes('kapak')) item.toggleOpen();
      item.select();
    });
    list.appendChild(li);
  }
}

function renderProps() {
  const panel = document.getElementById('props');
  const content = document.getElementById('propsContent');
  if (!selectedNode || selectedNode._noMesh) { panel.classList.remove('show'); return; }
  panel.classList.add('show');
  const n = selectedNode;
  const isDoor = n._hingeType !== null && n.name.includes('kapak');
  let hingeInfoHTML = '';
  if (isDoor) {
    hingeInfoHTML = `
    <div class="section">
      <div class="section-title">Menteşe Bilgisi</div>
      <div class="field"><label>Tip</label><select id="hType"><option value="1" ${n._hingeType === '1' ? 'selected' : ''}>Düz (Tam Bini)</option><option value="2" ${n._hingeType === '2' ? 'selected' : ''}>Yarım Deve (Yarım Bini)</option><option value="3" ${n._hingeType === '3' ? 'selected' : ''}>Süper Deve (Gömme)</option></select></div>
      <div class="field"><label>Genişlik Ofseti (cm)</label><input type="number" step="0.1" id="hOffset" value="${n._hingeOffset || 0}"></div>
      <div class="field"><label>Yön</label><select id="hSide"><option value="1" ${n._hingeSide === '1' ? 'selected' : ''}>Sol</option><option value="2" ${n._hingeSide === '2' ? 'selected' : ''}>Sağ</option></select></div>
    </div>`;
  }
  content.innerHTML = `
    <div class="section">
      <div class="section-title">Genel</div>
      <div class="field"><label>Ad</label><input id="pName" value="${n.name}"></div>
    </div>
    ${hingeInfoHTML}
    <div class="section">
      <div class="section-title">Konum</div>
      <div class="row">
        <div class="field"><label>X</label><input type="number" step="0.1" id="pX" value="${n.position.x.toFixed(1)}"></div>
        <div class="field"><label>Y</label><input type="number" step="0.1" id="pY" value="${n.position.y.toFixed(1)}"></div>
        <div class="field"><label>Z</label><input type="number" step="0.1" id="pZ" value="${n.position.z.toFixed(1)}"></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Boyut (cm)</div>
      <div class="row">
        <div class="field"><label>G</label><input type="number" step="0.1" id="pW" value="${n.size.x.toFixed(1)}"></div>
        <div class="field"><label>Y</label><input type="number" step="0.1" id="pH" value="${n.size.y.toFixed(1)}"></div>
        <div class="field"><label>K</label><input type="number" step="0.1" id="pD" value="${n.size.z.toFixed(1)}"></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Döndürme (°)</div>
      <div class="row">
        <div class="field"><label>G</label><input type="number" step="1" id="rX" value="${n.rotation.x}"></div>
        <div class="field"><label>Y</label><input type="number" step="1" id="rY" value="${n.rotation.y}"></div>
        <div class="field"><label>K</label><input type="number" step="1" id="rZ" value="${n.rotation.z}"></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Renk</div>
      <div class="field"><input type="color" id="pColor" value="${n.color}"></div>
    </div>
    <div class="actions">
      <button id="pCopy">📋 Kopyala</button>
      <button id="pRename">✏️ Adlandır</button>
      <button id="pDelete">🗑 Sil</button>
    </div>
  `;
  document.getElementById('pName').addEventListener('input', (e) => { n.name = e.target.value; autoSave(); });
  document.getElementById('pX').addEventListener('change', (e) => { n.updatePos(+e.target.value, n.position.y, n.position.z); autoSave(); });
  document.getElementById('pZ').addEventListener('change', (e) => { n.updatePos(n.position.x, n.position.y, +e.target.value); autoSave(); });
  document.getElementById('pW').addEventListener('change', (e) => { n.setSize(+e.target.value, n.size.y, n.size.z); autoSave(); });
  document.getElementById('pH').addEventListener('change', (e) => { n.setSize(n.size.x, +e.target.value, n.size.z); autoSave(); });
  document.getElementById('pD').addEventListener('change', (e) => { n.setSize(n.size.x, n.size.y, +e.target.value); autoSave(); });
  document.getElementById('rX').addEventListener('change', (e) => { n.setRotation(+e.target.value, n.rotation.y, n.rotation.z); autoSave(); });
  document.getElementById('rY').addEventListener('change', (e) => { n.setRotation(n.rotation.x, +e.target.value, n.rotation.z); autoSave(); });
  document.getElementById('rZ').addEventListener('change', (e) => { n.setRotation(n.rotation.x, n.rotation.y, +e.target.value); autoSave(); });
  document.getElementById('pY').addEventListener('change', (e) => { n.updatePos(n.position.x, +e.target.value, n.position.z); autoSave(); });
  if (isDoor) {
    document.getElementById('hSide').addEventListener('change', (e) => { n._hingeSide = e.target.value; autoSave(); });
    document.getElementById('hOffset').addEventListener('change', (e) => {
      n._hingeOffset = parseFloat(e.target.value) || 0;
      updateDoorSize(n);
      renderProps();
      autoSave();
    });
    document.getElementById('hType').addEventListener('change', (e) => {
      const newType = e.target.value;
      if (newType === n._hingeType) return;
      n._hingeType = newType;
      updateDoorSize(n);
      renderProps();
      autoSave();
    });
  }
  document.getElementById('pColor').addEventListener('input', (e) => { n.color = e.target.value; n.mesh.material.color.set(e.target.value); autoSave(); });
  document.getElementById('pCopy').addEventListener('click', () => {
    const copy = new CabinetNode(n.name + ' (kopya)', n.parent);
    copy.setSize(n.size.x, n.size.y, n.size.z);
    copy.setBaseRotation(n._baseRotation.x, n._baseRotation.y, n._baseRotation.z);
    copy.setRotation(n.rotation.x, n.rotation.y, n.rotation.z);
    copy.updatePos(n.position.x + n.size.x + 1, n.position.y, n.position.z);
    copy.color = n.color;
    copy._hingeType = n._hingeType;
    copy._hingeSide = n._hingeSide;
    copy.select();
    setActiveTool('move');
    renderProps();
    renderCellMarkers();
    showToast('Kopyalandı');
  });
  document.getElementById('pRename').addEventListener('click', async () => {
    const newName = await showDialog('Yeni Ad', 'Ad girin', n.name);
    if (newName && newName.trim()) { n.name = newName.trim(); renderProps(); autoSave(); }
  });
  document.getElementById('pDelete').addEventListener('click', () => { removeNode(n); showToast('Silindi'); autoSave(); });
}

function renderCellMarkers() {
  _cellMarkers.forEach(m => m.remove());
  _cellMarkers = [];
  _selectedCells = [];
  if (!cabinet || activeTool !== 'select') return;
  const cells = getCells();
  for (const cell of cells) {
    const v = new THREE.Vector3(cell.cx, cell.cy, 0);
    const screenPos = v.clone().project(camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
    if (screenPos.z > 1) continue;
    const el = document.createElement('div');
    el.className = 'cellMarker';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.cx = cell.cx;
    el.dataset.cy = cell.cy;
    el.dataset.xl = cell.xL;
    el.dataset.xr = cell.xR;
    el.dataset.yb = cell.yB;
    el.dataset.yt = cell.yT;
    el.dataset.w = cell.w;
    el.dataset.h = cell.h;
    const left = document.createElement('div');
    left.className = 'half';
    left.dataset.side = 'left';
    const right = document.createElement('div');
    right.className = 'half';
    right.dataset.side = 'right';
    el.appendChild(left);
    el.appendChild(right);
    const toggleSelect = (side) => {
      const idx = _selectedCells.indexOf(cell);
      el.querySelectorAll('.half').forEach(h => h.classList.remove('active'));
      if (idx >= 0) {
        _selectedCells.splice(idx, 1);
        el.classList.remove('selected');
        _selectedCellSide = null;
      } else {
        _selectedCells.push(cell);
        el.classList.add('selected');
        _selectedCellSide = side;
      }
      el.querySelector(`.half[data-side="${side}"]`).classList.add('active');
    };
    left.addEventListener('click', (e) => { e.stopPropagation(); toggleSelect('left'); });
    right.addEventListener('click', (e) => { e.stopPropagation(); toggleSelect('right'); });
    document.body.appendChild(el);
    _cellMarkers.push(el);
  }
}

function clearCellMarkers() {
  _cellMarkers.forEach(m => m.remove());
  _cellMarkers = [];
  _selectedCells = [];
  _selectedCellSide = null;
}

function clearDimensions() {}
function renderDimensions() {}

function showDialog(title, placeholder, defaultVal) {
  return new Promise(resolve => {
    _dialogResolve = resolve;
    document.getElementById('dialogTitle').textContent = title;
    const inp = document.getElementById('dialogInput');
    inp.placeholder = placeholder;
    inp.value = defaultVal ?? '';
    document.getElementById('dialog').classList.add('show');
    setTimeout(() => inp.focus(), 50);
  });
}

function closeDialog(val) {
  document.getElementById('dialog').classList.remove('show');
  if (_dialogResolve) _dialogResolve(val);
  _dialogResolve = null;
}

document.getElementById('dialogOk').addEventListener('click', () => closeDialog(document.getElementById('dialogInput').value));
document.getElementById('dialogCancel').addEventListener('click', () => closeDialog(null));
document.getElementById('dialogInput').addEventListener('keydown', e => { if (e.key === 'Enter') closeDialog(document.getElementById('dialogInput').value); if (e.key === 'Escape') closeDialog(null); });

function showToast(msg, duration) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), duration || 2000);
}

function buildExportData() {
  const map = new Map();
  for (const node of nodeMap.values()) {
    if (node._noMesh) continue;
    const w = Math.round(node.size.x * 10) / 10;
    const h = Math.round(node.size.y * 10) / 10;
    const key = `${w}x${h}`;
    if (!map.has(key)) map.set(key, { name: node.name, w, h, count: 1 });
    else map.get(key).count++;
  }
  _exportData = Array.from(map.values());
  return _exportData;
}

function showExport() {
  buildExportData();
  const total = _exportData.reduce((s, d) => s + d.count, 0);
  let html = `<table><tr><th>Parça</th><th>Boy (mm)</th><th>En (mm)</th><th>Adet</th></tr>`;
  for (const d of _exportData) {
    html += `<tr><td>${d.name}</td><td>${d.w}</td><td>${d.h}</td><td>${d.count}</td></tr>`;
  }
  html += `</table><div class="total">Toplam Parça: ${total}</div>`;
  document.getElementById('exportTable').innerHTML = html;
  document.getElementById('exportModal').classList.add('show');
}

function downloadCsv() {
  buildExportData();
  let csv = 'Parça,Boy (mm),En (mm),Adet\n';
  for (const d of _exportData) csv += `${d.name},${d.w},${d.h},${d.count}\n`;
  const total = _exportData.reduce((s, d) => s + d.count, 0);
  csv += `\nToplam Parça,${total}`;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'parca_listesi.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('btnExport').addEventListener('click', showExport);
document.getElementById('exportClose').addEventListener('click', () => document.getElementById('exportModal').classList.remove('show'));
document.getElementById('exportCsv').addEventListener('click', downloadCsv);
document.getElementById('exportModal').addEventListener('click', (e) => { if (e.target.id === 'exportModal') e.target.classList.remove('show'); });

const calcDisplay = document.getElementById('calcDisplay');
const calcPanel = document.getElementById('calcPanel');
document.getElementById('btnCalc').addEventListener('click', () => calcPanel.classList.toggle('show'));
document.getElementById('calcGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-v]');
  if (!btn) return;
  const v = btn.dataset.v;
  if (v === 'C') { _calcExpr = ''; calcDisplay.value = ''; return; }
  if (v === '⌫') { _calcExpr = _calcExpr.slice(0, -1); calcDisplay.value = _calcExpr; return; }
  if (v === '=') {
    try { calcDisplay.value = Function('"use strict";return (' + _calcExpr + ')')(); _calcExpr = String(calcDisplay.value); }
    catch { calcDisplay.value = 'Hata'; _calcExpr = ''; }
    return;
  }
  _calcExpr += v;
  calcDisplay.value = _calcExpr;
});

document.getElementById('calcHeader').addEventListener('mousedown', (e) => {
  _calcDrag.active = true;
  const rect = calcPanel.getBoundingClientRect();
  _calcDrag.offsetX = e.clientX - rect.left;
  _calcDrag.offsetY = e.clientY - rect.top;
  calcPanel.style.right = 'auto';
  e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (!_calcDrag.active) return;
  calcPanel.style.left = (e.clientX - _calcDrag.offsetX) + 'px';
  calcPanel.style.top = (e.clientY - _calcDrag.offsetY) + 'px';
});
document.addEventListener('mouseup', () => { _calcDrag.active = false; });
