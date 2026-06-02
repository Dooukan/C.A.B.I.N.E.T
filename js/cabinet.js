// CabinetNode sinifi, hucre sistemi (buildCells/getCells/findCellAt)
let nextNodeId = 1;
const nodeMap = new Map();
const meshToNode = new Map();

let _cells = [];

function buildCells() {
  if (!cabinet) { _cells = []; return; }
  const t = 1.8;
  const w = cabinet.size.x;
  const h = cabinet.size.y;
  _cells = [{ xL: -w / 2 + t / 2, xR: w / 2 - t / 2, yB: t, yT: h - t }];
  const dikmeler = cabinet.children.filter(c => c.name.includes('dikme'));
  const raflar = cabinet.children.filter(c => c.name.includes('raf'));
  for (const d of dikmeler) {
    const cx = d.position.x;
    const newCells = [];
    for (const cell of _cells) {
      const yOverlap = Math.min(cell.yT, d.position.y + d.size.y / 2) - Math.max(cell.yB, d.position.y - d.size.y / 2);
      if (cx > cell.xL && cx < cell.xR && yOverlap > 1) {
        newCells.push({ xL: cell.xL, xR: cx, yB: cell.yB, yT: cell.yT });
        newCells.push({ xL: cx, xR: cell.xR, yB: cell.yB, yT: cell.yT });
      } else { newCells.push(cell); }
    }
    _cells = newCells;
  }
  for (const r of raflar) {
    const cy = r.position.y;
    const rxL = r.position.x - r.size.x / 2;
    const rxR = r.position.x + r.size.x / 2;
    const newCells = [];
    for (const cell of _cells) {
      const xOverlap = Math.min(cell.xR, rxR) - Math.max(cell.xL, rxL);
      if (cy > cell.yB && cy < cell.yT && xOverlap > 1) {
        newCells.push({ xL: cell.xL, xR: cell.xR, yB: cell.yB, yT: cy });
        newCells.push({ xL: cell.xL, xR: cell.xR, yB: cy, yT: cell.yT });
      } else { newCells.push(cell); }
    }
    _cells = newCells;
  }
  _cells = _cells.filter(c => c.xR - c.xL > 0.1 && c.yT - c.yB > 0.1);
}

function getCells() {
  buildCells();
  return _cells.map(c => ({ ...c, cx: (c.xL + c.xR) / 2, cy: (c.yB + c.yT) / 2, w: c.xR - c.xL, h: c.yT - c.yB }));
}

function findCellAt(x, y) {
  const cells = getCells();
  for (const c of cells) {
    if (x >= c.xL && x <= c.xR && y >= c.yB && y <= c.yT) return c;
  }
  return cells.length ? cells[0] : null;
}

class CabinetNode {
  constructor(name, parent, noMesh) {
    this.id = nextNodeId++;
    this.name = name;
    this.parent = parent;
    this.children = [];
    this.position = { x: 0, y: 0, z: 0 };
    this.size = { x: 200, y: 240, z: 1.8 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this._baseRotation = { x: 0, y: 0, z: 0 };
    this.color = '#5d4037';
    this._metalness = 0.05;
    this._roughness = 0.6;
    this._hingeType = null;
    this._hingeSide = null;
    this._hingeOffset = 0;
    this.group = new THREE.Group();
    this.mesh = null;
    this._noMesh = !!noMesh;
    this._outline = null;
    this._snapPoints = [];
    this._isBodyPanel = false;
    this._splitScope = null;
    this._bodyDepth = null;
    this._outerDoorThickness = 0;
    this._animating = false;
    this._isOpen = false;
    this._pivot = null;
    if (parent) { parent.children.push(this); parent.group.add(this.group); }
    else scene.add(this.group);
    if (!this._noMesh) this.buildMesh();
    nodeMap.set(this.id, this);
  }

  buildOutline() {
    if (this._outline) { this.group.remove(this._outline); this._outline.geometry.dispose(); this._outline.material.dispose(); this._outline = null; }
    if (!this.mesh) return;
    const edges = new THREE.EdgesGeometry(this.mesh.geometry);
    const mat = new THREE.LineBasicMaterial({ color: '#ff8800' });
    this._outline = new THREE.LineSegments(edges, mat);
    this._outline.position.copy(this.mesh.position);
    this._outline.renderOrder = 1;
    this.group.add(this._outline);
    this._outline.visible = false;
  }

  buildSnapPoints() {
    this._snapPoints = [];
    if (!this.mesh) return;
    const { x, y, z } = this.size;
    const hx = x / 2, hy = y / 2, hz = z / 2;
    const F = (px, py, pz, t) => this._snapPoints.push({ x: px, y: py, z: pz, type: t });
    F(0, hy, 0, 'face'); F(0, -hy, 0, 'face');
    F(-hx, 0, 0, 'face'); F(hx, 0, 0, 'face');
    F(0, 0, hz, 'face'); F(0, 0, -hz, 'face');
    const s = [-1, 1];
    for (const sx of s) for (const sy of s) for (const sz of s)
      F(sx * hx, sy * hy, sz * hz, 'corner');
  }

  buildMesh() {
    if (this.mesh) { this.group.remove(this.mesh); meshToNode.delete(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    const { x, y, z } = this.size;
    const geo = new THREE.BoxGeometry(x, y, z);
    const mat = new THREE.MeshStandardMaterial({ color: this.color, roughness: this._roughness, metalness: this._metalness });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.set(0, 0, 0);
    this.group.add(this.mesh);
    meshToNode.set(this.mesh, this);
    this.buildOutline();
    this.buildSnapPoints();
    if (selectedNode === this && this._outline) this._outline.visible = true;
  }

  select() {
    if (selectedNode === this) { this.deselect(); return; }
    if (selectedNode) selectedNode.deselect();
    selectedNode = this;
    if (this._outline) this._outline.visible = true;
    renderProps();
    attachTransform();
    document.getElementById('hint').classList.add('hidden');
  }

  deselect() {
    if (selectedNode === this) selectedNode = null;
    if (this._outline) this._outline.visible = false;
    renderProps();
    attachTransform();
  }

  updatePos(x, y, z) {
    this.position.x = x; this.position.y = y; this.position.z = z;
    this.group.position.set(x, y, z);
    constrainToDoor(this);
  }

  setSize(x, y, z) {
    this.size.x = x; this.size.y = y; this.size.z = z;
    this.buildMesh();
    this._applyRotation();
  }

  setBaseRotation(x, y, z) {
    this._baseRotation.x = x; this._baseRotation.y = y; this._baseRotation.z = z;
    this._applyRotation();
  }

  setRotation(x, y, z) {
    this.rotation.x = x; this.rotation.y = y; this.rotation.z = z;
    this._applyRotation();
  }

  _applyRotation() {
    const rx = THREE.MathUtils.degToRad(this._baseRotation.x + this.rotation.x);
    const ry = THREE.MathUtils.degToRad(this._baseRotation.y + this.rotation.y);
    const rz = THREE.MathUtils.degToRad(this._baseRotation.z + this.rotation.z);
    this.group.rotation.set(rx, ry, rz);
    if (this.mesh) this.mesh.rotation.set(0, 0, 0);
    if (this._outline) this._outline.rotation.set(0, 0, 0);
    this.buildSnapPoints();
  }

  toggleOpen() {
    if (!this.name.includes('kapak')) return;
    if (this._animating) return;
    this._animating = true;
    const isLeftHinge = this._hingeSide === '1';
    const wasOpen = this._isOpen || false;
    this._isOpen = !wasOpen;

    const hx = isLeftHinge ? this.size.x / 2 : -this.size.x / 2;
    const hz = -this.size.z / 2;

    this._pivot = new THREE.Group();
    const offset = new THREE.Vector3(hx, 0, hz).applyQuaternion(this.group.quaternion);
    this._pivot.position.copy(this.group.position).add(offset);
    this._pivot.quaternion.copy(this.group.quaternion);
    const parent = this.group.parent;
    parent.add(this._pivot);
    this._pivot.attach(this.group);

    const startAngle = this._pivot.rotation.y;
    const targetAngle = this._isOpen ? (isLeftHinge ? Math.PI / 2 : -Math.PI / 2) : 0;

    const duration = 400;
    const startTime = Date.now();
    const animate = () => {
      const t = Math.min((Date.now() - startTime) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this._pivot.rotation.y = startAngle + (targetAngle - startAngle) * ease;
      if (t < 1) requestAnimationFrame(animate);
      else {
        parent.attach(this.group);
        parent.remove(this._pivot);
        this._pivot = null;
        this.position.x = this.group.position.x;
        this.position.y = this.group.position.y;
        this.position.z = this.group.position.z;
        this.rotation.y = THREE.MathUtils.radToDeg(this.group.rotation.y);
        this._animating = false;
        autoSave();
        renderTree();
      }
    };
    animate();
  }
}
