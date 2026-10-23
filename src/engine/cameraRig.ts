// Camera transitions and navigation limits on top of WAMR3D's OrbitControls.

import { W, type OrbitControls } from './wamr';

export interface Bounds {
  /** Keep the camera (and target) within this distance of the origin. */
  maxRadius?: number;
  /** Spheres the camera may not enter (e.g. the nucleus). */
  avoid?: { center: W.Vector3; radius: number }[];
}

export interface Limits {
  minDistance: number;
  maxDistance: number;
  enablePan: boolean;
  enableRotate?: boolean;
  minPolarAngle?: number;
  maxPolarAngle?: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  private tween: { fromPos: W.Vector3; toPos: W.Vector3; fromTarget: W.Vector3; toTarget: W.Vector3; t: number; dur: number; done?: () => void } | null = null;
  bounds: Bounds = {};
  reducedMotion = false;
  move = { forward: 0, right: 0, up: 0 };
  moveSpeed = 4;

  private readonly v = new W.Vector3();
  private readonly fwd = new W.Vector3();
  private readonly right = new W.Vector3();

  constructor(readonly camera: W.PerspectiveCamera, readonly controls: OrbitControls) {}

  get animating() { return this.tween !== null; }

  setLimits(l: Limits) {
    const c = this.controls;
    c.minDistance = l.minDistance;
    c.maxDistance = l.maxDistance;
    c.enablePan = l.enablePan;
    c.enableRotate = l.enableRotate ?? true;
    c.minPolarAngle = l.minPolarAngle ?? 0;
    c.maxPolarAngle = l.maxPolarAngle ?? Math.PI;
  }

  /** Smoothly moves camera and orbit target. Instant when reduced motion is on. */
  flyTo(pos: W.Vector3, target: W.Vector3, duration = 1.2, done?: () => void) {
    const dur = this.reducedMotion ? 0 : duration;
    this.tween = { fromPos: this.camera.position.clone(), toPos: pos.clone(), fromTarget: this.controls.target.clone(), toTarget: target.clone(), t: 0, dur, done };
    this.controls.enabled = false;
    if (dur === 0) this.update(0);
  }

  jumpTo(pos: W.Vector3, target: W.Vector3) {
    this.tween = null;
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.enabled = true;
    this.controls.update();
  }

  /** Dolly toward (factor < 1) or away from (factor > 1) the target, within limits. */
  zoom(factor: number) {
    const c = this.controls;
    this.v.subVectors(this.camera.position, c.target);
    const d = Math.min(c.maxDistance, Math.max(c.minDistance, this.v.length() * factor));
    this.v.setLength(d);
    this.flyTo(this.v.add(c.target).clone(), c.target.clone(), 0.35);
  }

  update(dt: number) {
    const tw = this.tween;
    if (tw) {
      tw.t = tw.dur === 0 ? 1 : Math.min(1, tw.t + dt / tw.dur);
      const k = ease(tw.t);
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
      this.camera.lookAt(this.controls.target);
      if (tw.t >= 1) {
        this.tween = null;
        this.controls.enabled = true;
        this.controls.update();
        tw.done?.();
      }
      return;
    }
    const { forward, right, up } = this.move;
    if (forward || right || up) {
      this.camera.getWorldDirection(this.fwd);
      this.right.crossVectors(this.fwd, this.camera.up).normalize();
      this.v.set(0, 0, 0).addScaledVector(this.fwd, forward).addScaledVector(this.right, right).addScaledVector(this.camera.up, up);
      this.v.multiplyScalar(this.moveSpeed * Math.min(dt, 0.1));
      this.camera.position.add(this.v);
      this.controls.target.add(this.v);
    }
    this.controls.update();
    this.applyBounds();
  }

  private applyBounds() {
    const { maxRadius, avoid } = this.bounds;
    const p = this.camera.position, t = this.controls.target;
    if (maxRadius !== undefined) {
      if (p.length() > maxRadius) p.setLength(maxRadius);
      if (t.length() > maxRadius) t.setLength(maxRadius);
    }
    for (const s of avoid ?? []) {
      this.v.subVectors(p, s.center);
      const d = this.v.length();
      if (d < s.radius) p.copy(s.center).addScaledVector(this.v.normalize(), s.radius);
    }
  }
}
