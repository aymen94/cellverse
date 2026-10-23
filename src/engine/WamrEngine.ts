// The WAMR3D adapter: owns the renderer, camera, controls and stages, routes pointer
// input to picking, and runs the render loop. The UI talks to it only through the
// SceneController interface.

import type { OrganelleId, StructureRef } from '../types/science';
import type { CameraRig } from './cameraRig';
import { CELL_RADIUS } from './constants';
import type { LabelLayer } from './labels';
import type { CellStage } from './stages/cellStage';
import type { LabStage } from './stages/labStage';
import type { MoleculeStage } from './stages/moleculeStage';
import type { Stage } from './stages/stage';
import type { EngineCallbacks, LabSnapshot, MoleculeViewOptions, NavMode, Quality, SceneController, StageId, ViewStyle } from './types';
import { loadEngine, W, type OrbitControls } from './wamr';

const PIXEL_RATIO: Record<Quality, number> = { high: 2, balanced: 1.5, low: 1 };

export class WamrEngine implements SceneController {
  private renderer!: W.WebGPURenderer;
  private camera!: W.PerspectiveCamera;
  private controls!: OrbitControls;
  private rig!: CameraRig;
  private cell!: CellStage;
  private molecule!: MoleculeStage;
  private lab!: LabStage;
  private stage!: Stage;
  private stageId: StageId = 'cell';
  private readonly activated = new Set<StageId>();
  private readonly savedViews = new Map<StageId, { pos: W.Vector3; target: W.Vector3 }>();
  // Engine objects can only be created after WAMR3D's init(); they are set in init().
  private labels!: LabelLayer;
  private raycaster!: W.Raycaster;
  private pointer!: W.Vector2;
  private labPlane!: W.Plane;
  private pendingLabelBindings = new Map<string, HTMLElement | null>();
  private readonly cleanup: (() => void)[] = [];
  private width = 1;
  private height = 1;
  private quality: Quality = 'high';
  private navMode: NavMode = 'exterior';
  private debug = false;
  private labelsVisible = true;
  private running = false;
  private disposed = false;
  private lastTime = 0;
  private elapsed = 0;
  private frames = 0;
  private frameAccum = 0;
  private lastHover = 0;
  private hoverKey = '';
  private drag: { id: string; startX: number; startY: number; moved: boolean; offset: W.Vector3 } | null = null;
  private down: { x: number; y: number; shift: boolean } | null = null;
  backend = 'unknown';

  constructor(private readonly container: HTMLElement, private readonly callbacks: EngineCallbacks) {}

  /** Creates the renderer and the cell scene. Throws when no supported GPU API is available. */
  async init(progress: (msg: string) => void) {
    progress('Loading WAMR3D engine…');
    const { OrbitControls } = await loadEngine();
    // Modules that create engine objects when evaluated are imported after init().
    const [{ CameraRig }, { LabelLayer }, { CellStage }, { MoleculeStage }, { LabStage }] = await Promise.all([
      import('./cameraRig'), import('./labels'), import('./stages/cellStage'), import('./stages/moleculeStage'), import('./stages/labStage'),
    ]);
    if (this.disposed) return;
    this.labels = new LabelLayer();
    this.labels.visible = this.labelsVisible;
    for (const [k, el] of this.pendingLabelBindings) this.labels.bind(k, el);
    this.pendingLabelBindings.clear();
    this.raycaster = new W.Raycaster();
    this.pointer = new W.Vector2();
    this.labPlane = new W.Plane(new W.Vector3(0, 0, 1), 0);
    progress('Starting renderer…');
    this.renderer = new W.WebGPURenderer({ antialias: true, powerPreference: 'high-performance' });
    await this.renderer.init();
    if (this.disposed) { this.renderer.dispose(); return; }
    this.backend = this.renderer.backend?.name ?? 'unknown';
    // ACESFilmicToneMapping (4); the compat typings do not re-export the named constant.
    this.renderer.toneMapping = 4 as W.ToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    const canvas = this.renderer.domElement;
    canvas.className = 'viewport-canvas';
    canvas.setAttribute('aria-label', '3D view of the cell. Use the sidebar or search to select structures without the mouse.');
    canvas.setAttribute('role', 'img');
    this.container.prepend(canvas);

    this.camera = new W.PerspectiveCamera(45, 1, 0.05, 400);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.zoomSpeed = 0.8;
    this.rig = new CameraRig(this.camera, this.controls);

    progress('Building the cell…');
    this.cell = new CellStage();
    this.molecule = new MoleculeStage();
    this.molecule.onChange = () => this.publishLabels();
    this.molecule.onFramed = () => { if (this.stageId === 'molecule') this.molecule.frame(this.rig, false); };
    this.lab = new LabStage();
    this.lab.onChange = () => { if (this.stageId === 'lab') this.publishLabels(); };
    this.stage = this.cell;
    this.resize();
    this.cell.activate(this.rig, true);
    this.activated.add('cell');
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.container);
    this.cleanup.push(() => ro.disconnect());
    this.bindInput(canvas);

    progress('Compiling shaders…');
    try { await this.renderer.compileAsync(this.cell.scene, this.camera); } catch { /* compiled lazily on first frame instead */ }
    if (this.disposed) return;

    const onVisibility = () => (document.hidden ? this.stop() : this.start());
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));
    this.publishLabels();
    this.start();
  }

  // --- Loop ----------------------------------------------------------------------

  private start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = performance.now();
    // Timestamps come from performance.now(): the loop callback's time argument is not
    // guaranteed to share its time base.
    this.renderer.setAnimationLoop(() => this.frame(performance.now()));
  }

  private stop() {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private frame(now: number) {
    const raw = Math.max(0, (now - this.lastTime) / 1000);
    // Camera transitions follow wall-clock time even on slow devices; scene animation
    // uses a tighter clamp so a stalled tab does not make vesicles jump.
    const dt = Math.min(0.1, raw);
    this.lastTime = now;
    this.elapsed += dt;
    this.rig.update(Math.min(0.5, raw));
    this.stage.update(dt, this.elapsed, this.camera);
    if (this.stageId === 'cell') this.updateNavMode();
    this.renderer.render(this.stage.scene, this.camera);
    this.labels.update(this.camera, this.width, this.height, this.stage.labelPositions(), this.stage.labelFade?.());

    this.frames++;
    this.frameAccum += dt;
    if (this.debug && this.frameAccum >= 1 && this.callbacks.onStats) {
      const info = this.renderer.info.render;
      this.callbacks.onStats({
        backend: this.backend, fps: this.frames / this.frameAccum, frameMs: (this.frameAccum / this.frames) * 1000,
        drawCalls: info.calls, triangles: info.triangles, pixelRatio: this.renderer.getPixelRatio(), stage: this.stageId,
      });
      this.frames = 0;
      this.frameAccum = 0;
    } else if (this.frameAccum >= 1) {
      this.frames = 0;
      this.frameAccum = 0;
    }
  }

  private updateNavMode() {
    if (this.rig.animating || this.navMode === 'closeup') return;
    const inside = this.camera.position.length() < CELL_RADIUS - 0.5;
    const mode: NavMode = inside ? 'interior' : 'exterior';
    if (mode !== this.navMode) this.setNavMode(mode);
  }

  private setNavMode(mode: NavMode) {
    if (mode === this.navMode) return;
    this.navMode = mode;
    this.callbacks.onNavModeChange(mode);
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[this.quality]));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.applyViewInset();
  }

  private viewInset = 0;

  /** Shifts the projection so the scene is centred in the part of the canvas left visible. */
  private applyViewInset() {
    const shift = Math.min(this.viewInset, this.height * 0.6) / 2;
    if (shift > 0) this.camera.setViewOffset(this.width, this.height, 0, shift, this.width, this.height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  setViewInset(bottom: number) {
    this.viewInset = Math.max(0, bottom);
    if (this.camera) this.applyViewInset();
  }

  // --- Input -----------------------------------------------------------------------

  private setPointer(e: PointerEvent | MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private pick(e: PointerEvent | MouseEvent) {
    this.setPointer(e);
    const hits = this.raycaster.intersectObjects(this.stage.pickables(), false);
    return this.stage.resolvePick(hits);
  }

  private bindInput(canvas: HTMLCanvasElement) {
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      canvas.addEventListener(type, fn as EventListener);
      this.cleanup.push(() => canvas.removeEventListener(type, fn as EventListener));
    };

    on('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.down = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
      if (this.stageId === 'lab') {
        const p = this.pick(e);
        if (p?.target.stage === 'lab') {
          const pos = this.lab.nodePosition(p.target.nodeId);
          const hit = this.raycaster.ray.intersectPlane(this.labPlane, new W.Vector3());
          if (pos && hit) {
            this.drag = { id: p.target.nodeId, startX: e.clientX, startY: e.clientY, moved: false, offset: pos.clone().sub(hit) };
            this.controls.enabled = false;
            canvas.setPointerCapture(e.pointerId);
          }
        }
      }
    });

    on('pointermove', (e) => {
      if (this.drag) {
        if (Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 4) this.drag.moved = true;
        if (this.drag.moved) {
          this.setPointer(e);
          const hit = this.raycaster.ray.intersectPlane(this.labPlane, new W.Vector3());
          if (hit) {
            hit.add(this.drag.offset);
            this.lab.dragTo(this.drag.id, Math.round(hit.x * 10) / 10, Math.round(hit.y * 10) / 10);
          }
        }
        return;
      }
      const now = performance.now();
      if (now - this.lastHover < 70 || e.buttons) return;
      this.lastHover = now;
      const p = this.pick(e);
      const key = p ? JSON.stringify(p.target) : '';
      canvas.style.cursor = p ? 'pointer' : this.stageId === 'lab' ? 'default' : 'grab';
      if (key !== this.hoverKey || p) this.callbacks.onHover(p ? { label: p.label, sub: p.sub } : null, e.clientX, e.clientY);
      this.hoverKey = key;
    });

    on('pointerleave', () => { this.hoverKey = ''; this.callbacks.onHover(null, 0, 0); });

    on('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (this.drag) {
        const drag = this.drag;
        this.drag = null;
        this.controls.enabled = true;
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (drag.moved) {
          const pos = this.lab.nodePosition(drag.id);
          if (pos) this.callbacks.onLabNodeMoved(drag.id, pos.x, pos.y);
          return;
        }
      }
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      const p = this.pick(e);
      this.callbacks.onPick(p?.target ?? null, { shiftKey: d.shift, double: false });
    });

    on('dblclick', (e) => {
      const p = this.pick(e);
      if (p) this.callbacks.onPick(p.target, { shiftKey: e.shiftKey, double: true });
    });
  }

  // --- SceneController -----------------------------------------------------------------

  setStage(stage: StageId) {
    if (!this.renderer || stage === this.stageId) return;
    this.savedViews.set(this.stageId, { pos: this.camera.position.clone(), target: this.controls.target.clone() });
    this.stageId = stage;
    this.stage = stage === 'cell' ? this.cell : stage === 'molecule' ? this.molecule : this.lab;
    const first = !this.activated.has(stage);
    this.activated.add(stage);
    this.rig.move = { forward: 0, right: 0, up: 0 };
    if (stage === 'cell') {
      // Return to where the cell view was left, in the matching navigation limits.
      this.cell.activate(this.rig, first);
      const saved = this.savedViews.get('cell');
      if (this.navMode === 'exterior') this.cell.applyExterior(this.rig, true);
      else this.cell.setInteriorLimits(this.rig);
      if (saved) this.rig.jumpTo(saved.pos, saved.target);
    } else {
      this.stage.activate(this.rig, first);
      const saved = this.savedViews.get(stage);
      if (saved && stage === 'lab') this.rig.jumpTo(saved.pos, saved.target);
    }
    this.publishLabels();
  }

  selectOrganelle(id: OrganelleId | null, instance?: number) {
    this.cell?.select(id, instance);
    this.publishLabels();
  }

  focusOrganelle(id: OrganelleId, instance?: number) {
    if (!this.cell) return;
    this.setStage('cell');
    if (this.cell.applyCloseup(this.rig, id, instance)) this.setNavMode('closeup');
  }

  highlightOrganelles(ids: OrganelleId[]) {
    this.cell?.highlight(ids);
    this.publishLabels();
  }

  enterCell() {
    if (!this.cell) return;
    this.setStage('cell');
    this.cell.applyInterior(this.rig);
    this.setNavMode('interior');
  }

  exitCell() {
    if (!this.cell) return;
    this.setStage('cell');
    this.cell.applyExterior(this.rig);
    this.setNavMode('exterior');
  }

  resetView() {
    if (!this.renderer) return;
    if (this.stageId === 'cell') this.exitCell();
    else if (this.stageId === 'molecule') this.molecule.frame(this.rig, false);
    else this.rig.flyTo(new W.Vector3(0, 0, 30), new W.Vector3(), 0.8);
  }

  zoom(factor: number) {
    this.rig?.zoom(factor);
  }

  setMoveInput(input: { forward: number; right: number; up: number }) {
    if (!this.rig) return;
    // Free movement only inside the cell; elsewhere it would fight the orbit limits.
    this.rig.move = this.stageId === 'cell' && this.navMode !== 'exterior' ? input : { forward: 0, right: 0, up: 0 };
  }

  setViewStyle(style: ViewStyle) {
    this.cell?.setCutaway(style === 'cutaway');
  }

  setAnimate(on: boolean) {
    if (this.cell) this.cell.animate = on;
    if (this.molecule) this.molecule.autoRotate = on;
  }

  async showMolecule(ref: StructureRef, options: MoleculeViewOptions) {
    if (!this.molecule) return;
    this.setStage('molecule');
    await this.molecule.show(ref, options);
  }

  syncLab(snapshot: LabSnapshot) {
    this.lab?.sync(snapshot);
  }

  screenToLab(clientX: number, clientY: number) {
    if (!this.renderer || this.stageId !== 'lab') return null;
    this.setPointer({ clientX, clientY } as MouseEvent);
    const hit = this.raycaster.ray.intersectPlane(this.labPlane, new W.Vector3());
    return hit ? { x: Math.round(hit.x * 10) / 10, y: Math.round(hit.y * 10) / 10 } : null;
  }

  private publishLabels() {
    if (this.stage) this.callbacks.onLabelsChanged(this.stage.labelAnchors());
  }

  bindLabelElement(key: string, el: HTMLElement | null) {
    if (this.labels) this.labels.bind(key, el);
    else this.pendingLabelBindings.set(key, el);
  }

  setLabelsVisible(on: boolean) {
    this.labelsVisible = on;
    if (this.labels) this.labels.visible = on;
  }

  setReducedMotion(on: boolean) {
    if (this.rig) this.rig.reducedMotion = on;
  }

  setQuality(q: Quality) {
    this.quality = q;
    if (this.renderer) this.resize();
  }

  setDebug(on: boolean) {
    this.debug = on;
  }

  dispose() {
    this.disposed = true;
    this.stop();
    for (const fn of this.cleanup) fn();
    this.cleanup.length = 0;
    this.controls?.dispose();
    this.cell?.dispose();
    this.molecule?.dispose();
    this.lab?.dispose();
    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
  }
}
