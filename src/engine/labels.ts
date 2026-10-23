// Positions DOM labels over the 3D view. React renders the label elements once; this
// layer moves them every frame with transforms, so camera motion never re-renders React.
// Overlapping labels are hidden, keeping emphasized (selected) and nearer ones.

import { W } from './wamr';

interface Placed { key: string; el: HTMLElement; x: number; y: number; depth: number; emphasis: boolean; anchor: 'bottom' | 'top' | 'center' }

export class LabelLayer {
  private readonly elements = new Map<string, HTMLElement>();
  private readonly sizes = new Map<HTMLElement, { w: number; h: number }>();
  private readonly v = new W.Vector3();
  private frame = 0;
  visible = true;

  bind(key: string, el: HTMLElement | null) {
    const old = this.elements.get(key);
    if (old) this.sizes.delete(old);
    if (el) this.elements.set(key, el);
    else this.elements.delete(key);
  }

  private size(el: HTMLElement) {
    let s = this.sizes.get(el);
    if (!s || s.w === 0) {
      const inner = (el.firstElementChild as HTMLElement | null) ?? el;
      s = { w: inner.offsetWidth, h: inner.offsetHeight };
      this.sizes.set(el, s);
    }
    return s;
  }

  update(camera: W.PerspectiveCamera, width: number, height: number, positions: Map<string, W.Vector3>, fade?: { near: number; far: number }) {
    // Sizes change rarely (text, emphasis); re-measure occasionally, before any writes.
    if (++this.frame % 45 === 0) this.sizes.clear();
    const items: Placed[] = [];
    for (const [key, el] of this.elements) {
      const p = positions.get(key);
      if (!this.visible || !p) { el.style.opacity = '0'; continue; }
      this.v.copy(p).project(camera);
      if (this.v.z > 1 || this.v.z < -1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) { el.style.opacity = '0'; continue; }
      const cls = el.classList;
      items.push({
        key, el,
        x: (this.v.x * 0.5 + 0.5) * width,
        y: (-this.v.y * 0.5 + 0.5) * height,
        depth: p.distanceTo(camera.position),
        emphasis: cls.contains('emphasis'),
        anchor: cls.contains('lab-node') ? 'top' : cls.contains('lab-bond') ? 'center' : 'bottom',
      });
    }
    items.sort((a, b) => (a.emphasis === b.emphasis ? a.depth - b.depth : a.emphasis ? -1 : 1));
    const boxes: [number, number, number, number][] = [];
    for (const it of items) {
      const { w, h } = this.size(it.el);
      const x0 = it.x - w / 2 - 3, x1 = it.x + w / 2 + 3;
      const y0 = it.anchor === 'bottom' ? it.y - h - 8 : it.anchor === 'top' ? it.y : it.y - h / 2;
      const y1 = y0 + h + 2;
      const hidden = !it.emphasis && boxes.some((b) => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]);
      let opacity = 1;
      if (fade && !it.emphasis) opacity = it.depth < fade.near ? 1 : it.depth > fade.far ? 0.3 : 1 - 0.7 * ((it.depth - fade.near) / (fade.far - fade.near));
      it.el.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0)`;
      it.el.style.opacity = hidden ? '0' : opacity.toFixed(2);
      if (!hidden) boxes.push([x0, y0, x1, y1]);
    }
  }
}
