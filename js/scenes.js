/* ============================================================
   Q/LAB — WebGL scenes
   Hero phase cloud · Bloch sphere · amplitude ring ·
   dilution refrigerator · surface-code patch
   ============================================================ */
(function () {
  'use strict';

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [r + m, g + m, b + m];
  }

  function phaseColorRgb(rad) {
    let deg = (rad * 180 / Math.PI) % 360;
    // avoid dull red: shift into cyan-violet-orange band
    let h = 155 + (deg / 360) * 245;
    return hslToRgb(h, 78, 66);
  }

  function darken(c, f) { return [c[0]*f, c[1]*f, c[2]*f]; }

  function seeded(seed) {
    let x = seed >>> 0;
    return function () {
      x = (x * 1664525 + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function starfield(count, radius, seed) {
    const rnd = seeded(seed || 41);
    const verts = [];
    for (let i = 0; i < count; i++) {
      const th = Math.acos(1 - 2 * rnd());
      const ph = rnd() * Math.PI * 2;
      const r = radius * (0.75 + rnd() * 0.7);
      const x = r * Math.sin(th) * Math.cos(ph);
      const y = r * Math.cos(th);
      const z = r * Math.sin(th) * Math.sin(ph);
      const w = 0.45 + rnd() * 0.55;
      verts.push(x, y, z,
        0.48 * w + 0.06, 0.92 * w, 0.81 * w,
        0.65 + rnd() * 1.7);
    }
    return verts;
  }

  function glowPoint(x,y,z,color,size) {
    return [x,y,z,color[0],color[1],color[2],size];
  }

  /* ============================================================
     HERO — 4-qubit phase cloud
     ============================================================ */
  class HeroScene extends GL.Scene {
    constructor(canvas) {
      super(canvas);
      this.orbit = new GL.Orbit(canvas, {
        theta: 0.72, phi: 1.24, distance: 6.4, autoRotate: !this.reducedMotion,
        speed: 0.075, minDistance: 4.2, maxDistance: 8.5
      });
      const gl = this.renderer.gl;
      this.stars = this.renderer.createPoints(starfield(720, 6.3, 175));
      this.sphere = this.renderer.createLines(GL.sphereWire(1.65, 8, 32, [0.32, 0.95, 0.76], 0.14));
      this.equator = this.renderer.createLines(GL.lineRing(1.66, 0, 160, [0.4, 1, 0.8], { fade: true }));
      const ring1 = GL.lineRing(2.22, 0, 160, [0.38, 0.95, 0.75], { fade: true });
      const ring2 = GL.lineRing(2.55, 0, 160, [0.55, 0.48, 1.0], { fade: true });
      this.rings = [
        { geom: this.renderer.createLines(ring1), rot: 0.55, axis: 'x' },
        { geom: this.renderer.createLines(ring2), rot: -0.72, axis: 'z' }
      ];
      this.orbitDots = this.renderer.createPoints(GL.torusPointsMesh(2.18, 0.09, 42, 4, [0.5,1,0.85]));
      this.core = this.renderer.createPoints([glowPoint(0,0,0,[0.45,1,0.82],58)]);
      this.nodes = [];
      this.setNodes(this.makeState());
    }

    makeState() {
      const n = 4, size = 1 << n;
      const s = new Float64Array(size * 2);
      const groups = Array.from({ length: n + 1 }, () => []);
      for (let i = 0; i < size; i++) groups[Q.hamming(i)].push(i);
      for (let k = 0; k <= n; k++) {
        groups[k].forEach((idx, pos) => {
          const mag = 0.76 + 0.24 * Math.sin(idx * 2.1 + 0.9);
          const phase = (pos / groups[k].length) * Math.PI * 2 + k * 0.62 + 0.18;
          s[idx * 2] = mag * Math.cos(phase);
          s[idx * 2 + 1] = mag * Math.sin(phase);
        });
      }
      Q.normalize(s);
      return s;
    }

    setNodes(s) {
      const n = 4, size = 1 << n;
      const verts = [];
      for (let i = 0; i < size; i++) {
        const re = s[i*2], im = s[i*2+1];
        const prob = re*re + im*im;
        if (prob < 1e-7) continue;
        const k = Q.hamming(i);
        const theta = Math.PI * k / n;
        const y = Math.cos(theta) * 1.65;
        const r = Math.sin(theta) * 1.65;
        const phase = Math.atan2(im, re);
        const x = Math.cos(phase) * r;
        const z = Math.sin(phase) * r;
        const col = phaseColorRgb(phase);
        const sizePx = 3.2 + Math.sqrt(prob) * 15;
        verts.push(x, y, z, col[0], col[1], col[2], sizePx);
      }
      if (this.nodeGeom) this.renderer.updatePoints(this.nodeGeom, verts);
      else this.nodeGeom = this.renderer.createPoints(verts);
    }

    update(dt) {
      this.orbit.update(dt);
    }

    draw(t) {
      const r = this.renderer;
      r.begin(this.orbit.camera({ fov: Math.PI * 0.21, near: 0.1, far: 60 }));
      r.drawPoints(this.stars, null, { alpha: 0.55, softness: 1.8 });
      r.drawLines(this.sphere, null, { alpha: 0.9 });
      r.drawLines(this.equator, null, { alpha: 0.4 });

      const m1 = GL.M4.rotX(new Float32Array(16), this.rings[0].rot + (this.reducedMotion ? 0 : t * 0.045));
      r.drawLines(this.rings[0].geom, m1, { alpha: 0.3 });
      const m2 = GL.M4.rotZ(new Float32Array(16), this.rings[1].rot - (this.reducedMotion ? 0 : t * 0.035));
      r.drawLines(this.rings[1].geom, m2, { alpha: 0.22 });
      r.drawPoints(this.orbitDots, m1, { alpha: 0.28, softness: 1.4 });

      const pulse = 0.82 + Math.sin(t * 1.2) * 0.12;
      const core = GL.M4.scaling(new Float32Array(16), pulse, pulse, pulse);
      r.drawPoints(this.core, core, { alpha: 0.32, softness: 2.2 });

      // Keep the cloud and node sizes breathing very slightly.
      const s = 1 + Math.sin(t * 0.42) * 0.018;
      const model = GL.M4.scaling(new Float32Array(16), s, s, s);
      r.drawPoints(this.nodeGeom, model, { alpha: 1, softness: 1.55 });
    }
  }

  /* ============================================================
     BLOCH SPHERE
     ============================================================ */
  class BlochScene extends GL.Scene {
    constructor(canvas, options) {
      super(canvas);
      this.options = options || {};
      this.orbit = new GL.Orbit(canvas, {
        theta: 0.88, phi: 1.18, distance: 4.85, autoRotate: false,
        minDistance: 3.2, maxDistance: 7.5
      });
      const r = this.renderer;
      this.sphere = r.createLines(GL.sphereWire(1.5, 10, 36, [0.32, 0.9, 0.74], 0.115));
      this.equator = r.createLines(GL.lineRing(1.5, 0, 160, [0.35, 0.92, 0.76], { fade: false }));
      this.meridian = r.createLines(this.makeMeridian());

      const axis = [];
      const pushAxis = (a, b, c, alpha) => {
        axis.push(a[0],a[1],a[2], c[0]*alpha,c[1]*alpha,c[2]*alpha);
        axis.push(b[0],b[1],b[2], c[0]*alpha,c[1]*alpha,c[2]*alpha);
      };
      pushAxis([0,0,0],[1.7,0,0],[1,0.6,0.4],0.42);
      pushAxis([0,0,0],[0,0,1.7],[0.62,0.55,1],0.42);
      pushAxis([0,-1.7,0],[0,1.7,0],[0.45,0.72,1],0.42);
      this.axes = r.createLines(axis);
      this.axisDots = r.createPoints([
        glowPoint(1.72,0,0,[1,0.62,0.42],5),
        glowPoint(0,0,1.72,[0.66,0.57,1],5),
        glowPoint(0,1.72,0,[0.45,0.78,1],5),
        glowPoint(0,-1.72,0,[1,0.6,0.48],5)
      ]);

      this.arrowGeom = r.createLines(this.arrowVerts([0,0,1.5]));
      this.arrowTip = r.createPoints([glowPoint(0,0,1.5,[0.45,1,0.8],10)]);
      this.arrowBase = r.createPoints([glowPoint(0,0,0,[0.45,1,0.8],7)]);
      this.trailGeom = r.createPoints([]);
      this.target = [0,0,1];
      this.current = [0,0,1];
      this.labels = {};
      if (this.options.labels) this.labels = this.options.labels;
    }

    makeMeridian() {
      const verts = [];
      const c = [0.45, 0.9, 0.8];
      for (let i = 0; i < 90; i++) {
        const a0 = i / 90 * Math.PI * 2;
        const a1 = (i + 1) / 90 * Math.PI * 2;
        verts.push(0, 1.5 * Math.cos(a0), 1.5 * Math.sin(a0), c[0]*.09, c[1]*.09, c[2]*.09);
        verts.push(0, 1.5 * Math.cos(a1), 1.5 * Math.sin(a1), c[0]*.09, c[1]*.09, c[2]*.09);
      }
      return verts;
    }

    setVector(v) {
      const len = Math.hypot(v[0], v[1], v[2]);
      if (len > 1) { v[0] /= len; v[1] /= len; v[2] /= len; }
      this.target = v.slice();
    }

    arrowVerts(v) {
      const [x,y,z] = v;
      const len = Math.hypot(x,y,z) || 1;
      const ux = x/len, uy = y/len, uz = z/len;
      const base = [ux*1.62, uy*1.62, uz*1.62];
      // perpendicular helper
      let px = -uy, py = ux, pz = 0;
      if (Math.hypot(px,py,pz) < .1) { px = 0; py = -uz; pz = uy; }
      const pl = Math.hypot(px,py,pz) || 1; px/=pl; py/=pl; pz/=pl;
      const back = 0.17;
      const w = 0.075;
      const a = [base[0]-ux*back + px*w, base[1]-uy*back + py*w, base[2]-uz*back + pz*w];
      const b = [base[0]-ux*back - px*w, base[1]-uy*back - py*w, base[2]-uz*back - pz*w];
      return [
        0,0,0, 0.32,0.96,0.78,
        base[0],base[1],base[2], 0.32,0.96,0.78,
        base[0],base[1],base[2], 0.5,1,0.85,
        a[0],a[1],a[2], 0.45,1,0.82,
        base[0],base[1],base[2], 0.5,1,0.85,
        b[0],b[1],b[2], 0.45,1,0.82
      ];
    }

    update(dt) {
      this.orbit.update(dt);
      const lerp = Math.min(1, dt * 7.5);
      for (let i = 0; i < 3; i++) this.current[i] += (this.target[i] - this.current[i]) * lerp;
      if (Math.hypot(this.current[0],this.current[1],this.current[2]) < 0.001) this.current = this.target.slice();
    }

    draw(t) {
      const r = this.renderer;
      r.begin(this.orbit.camera({ fov: Math.PI * 0.24, near: 0.1, far: 30 }));
      r.drawLines(this.sphere, null, { alpha: .95 });
      r.drawLines(this.equator, null, { alpha: .32 });
      r.drawLines(this.meridian, null, { alpha: .5 });
      r.drawLines(this.axes, null, { alpha: .95 });
      r.drawPoints(this.axisDots, null, { alpha: .5, softness: 1.5 });

      const len = Math.hypot(this.current[0], this.current[1], this.current[2]);
      const v = [this.current[0]*1.5, this.current[1]*1.5, this.current[2]*1.5];
      this.renderer.updateLines(this.arrowGeom, this.arrowVerts(v));
      r.drawLines(this.arrowGeom, null, { alpha: 1, additive: true });
      const tip = this.arrowVerts(v);
      const tipPos = [tip[6], tip[7], tip[8]];
      this.renderer.updatePoints(this.arrowTip, [glowPoint(tipPos[0],tipPos[1],tipPos[2],[0.5,1,.85], 11 + Math.sin(t*3)*1.5)]);
      r.drawPoints(this.arrowTip, null, { alpha: 1, softness: 1.3 });
      r.drawPoints(this.arrowBase, null, { alpha: .6, softness: 1.6 });

      if (Object.keys(this.labels).length) this.updateLabels();
    }

    updateLabels() {
      const r = this.renderer;
      const positions = {
        '0': [0, 1.85, 0],
        '1': [0, -1.85, 0],
        'x': [1.88, 0, 0],
        'y': [0, 0, 1.88],
        'z': [0.28, 1.42, 0]
      };
      for (const key in this.labels) {
        const el = this.labels[key];
        if (!el) continue;
        const p = positions[key];
        if (!p) continue;
        const s = r.project(p);
        if (!s) { el.style.opacity = 0; continue; }
        el.style.opacity = 1;
        el.style.left = s.x + 'px';
        el.style.top = s.y + 'px';
      }
    }
  }

  /* ============================================================
     AMPLITUDE RING — circuit inspector
     ============================================================ */
  class StateBarsScene extends GL.Scene {
    constructor(canvas, options) {
      super(canvas);
      this.options = options || {};
      this.orbit = new GL.Orbit(canvas, {
        theta: 0.72, phi: 1.02, distance: 6.6, target: [0, .65, 0],
        autoRotate: !this.reducedMotion, speed: 0.06,
        minDistance: 4.2, maxDistance: 10
      });
      this.base = this.renderer.createLines(this.baseVerts());
      this.grid = this.renderer.createLines(this.gridVerts());
      this.bars = this.renderer.createLines([]);
      this.tips = this.renderer.createPoints([]);
      this.stateN = 3;
      this.probs = [];
    }

    baseVerts() {
      const v = [];
      const c = [0.3, 0.85, 0.7];
      for (let i = 0; i < 160; i++) {
        const a0 = i/160*Math.PI*2, a1 = (i+1)/160*Math.PI*2;
        v.push(Math.cos(a0)*2.25,0,Math.sin(a0)*2.25, c[0]*.15,c[1]*.15,c[2]*.15);
        v.push(Math.cos(a1)*2.25,0,Math.sin(a1)*2.25, c[0]*.15,c[1]*.15,c[2]*.15);
      }
      return v;
    }

    gridVerts() {
      const v = [];
      const c = [0.35,0.7,0.62];
      for (let ring = 1; ring <= 3; ring++) {
        const radius = 0.6 + ring * 0.55;
        for (let i = 0; i < 80; i++) {
          const a0 = i/80*Math.PI*2, a1=(i+1)/80*Math.PI*2;
          v.push(Math.cos(a0)*radius,0,Math.sin(a0)*radius,c[0]*.07,c[1]*.07,c[2]*.07);
          v.push(Math.cos(a1)*radius,0,Math.sin(a1)*radius,c[0]*.07,c[1]*.07,c[2]*.07);
        }
      }
      return v;
    }

    setState(s, n) {
      this.stateN = n;
      const size = 1 << n;
      this.probs = Q.probabilities(s);
      const bars = [], tips = [];
      const maxH = 2.55;
      for (let i = 0; i < size; i++) {
        const angle = i / size * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * 2.25;
        const z = Math.sin(angle) * 2.25;
        const p = this.probs[i];
        const h = 0.035 + Math.pow(p, 0.72) * maxH;
        const phase = Math.atan2(s[i*2+1], s[i*2]);
        const c = phaseColorRgb(phase);
        bars.push(x,0,z, c[0]*.08,c[1]*.08,c[2]*.08);
        bars.push(x,h,z, c[0],c[1],c[2]);
        tips.push(x,h,z, c[0],c[1],c[2], 1.6 + Math.sqrt(p)*7.5);
      }
      this.renderer.updateLines(this.bars, bars);
      this.renderer.updatePoints(this.tips, tips);
    }

    update(dt) { this.orbit.update(dt); }

    draw(t) {
      const r = this.renderer;
      r.begin(this.orbit.camera({ fov: Math.PI * 0.22, near: .1, far: 40 }));
      r.drawLines(this.base, null, { alpha: .9 });
      r.drawLines(this.grid, null, { alpha: .9 });
      r.drawLines(this.bars, null, { alpha: .84, additive: true });
      r.drawPoints(this.tips, null, { alpha: .95, softness: 1.4 });
    }
  }

  /* ============================================================
     CRYOSTAT — dilution refrigerator schematic
     ============================================================ */
  class CryostatScene extends GL.Scene {
    constructor(canvas) {
      super(canvas);
      this.orbit = new GL.Orbit(canvas, {
        theta: 0.58, phi: 1.08, distance: 9.2, target: [0, .35, 0],
        autoRotate: !this.reducedMotion, speed: 0.045,
        minDistance: 6.2, maxDistance: 13
      });
      const r = this.renderer;
      this.plates = [];
      const specs = [
        [2.08, 2.72, 0.075, [0.64, 0.50, 0.28]],
        [1.77, 2.08, 0.07, [0.54, 0.43, 0.28]],
        [1.52, 1.38, 0.065, [0.66, 0.40, 0.22]],
        [1.25, 0.62, 0.06, [0.66, 0.38, 0.20]],
        [0.98, -0.16, 0.055, [0.58, 0.35, 0.20]],
        [0.72, -0.92, 0.05, [0.56, 0.32, 0.18]],
        [0.45, -1.55, 0.045, [0.62, 0.45, 0.25]]
      ];
      this.plateMeshes = specs.map(([rad, y, h, col]) => {
        const mesh = r.createMesh(...Object.values(GL.cylinderMesh(rad, rad * 1.015, h, 56)));
        this.plates.push({ mesh, rad, y, h, col });
        return { rad, y, col };
      });
      this.chip = r.createMesh(...Object.values(GL.boxMesh(0.58, 0.07, 0.58)));
      this.can = [];
      this.can.push(r.createMesh(...Object.values(GL.cylinderMesh(2.16, 2.16, 0.025, 64))));
      this.can.push(r.createMesh(...Object.values(GL.cylinderMesh(0.55, 0.55, 0.035, 48))));

      // structural rods
      const rods = [];
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + 0.4;
        rods.push({ mesh: r.createMesh(...Object.values(GL.cylinderMesh(0.025, 0.025, 4.65, 10))), x: Math.cos(a) * 1.42, z: Math.sin(a) * 1.42 });
      }
      this.rods = rods;

      const frame = [];
      for (const y of [2.85, 2.1, 1.4, .65, -.15, -.9, -1.58]) {
        const rad = 2.15 - (2.85 - y) * 0.12;
        frame.push(...GL.lineRing(rad, y, 120, [0.48, 0.66, 0.62], {}).map((v, i) => i % 6 >= 3 ? v * 0.22 : v));
      }
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const c = [0.35, 0.48, 0.46];
        frame.push(Math.cos(a)*1.95, 2.85, Math.sin(a)*1.95, c[0]*.15, c[1]*.15, c[2]*.15);
        frame.push(Math.cos(a)*1.18, -1.58, Math.sin(a)*1.18, c[0]*.15, c[1]*.15, c[2]*.15);
      }
      this.frame = r.createLines(frame);

      // cable paths and travelling pulses
      this.paths = [];
      const cableVerts = [];
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2 + 0.2;
        const rr = 0.82 + (i % 3) * 0.24;
        const pts = [
          [Math.cos(a)*rr, 2.9, Math.sin(a)*rr],
          [Math.cos(a+0.15)*rr*1.2, 2.25, Math.sin(a+0.15)*rr*1.2],
          [Math.cos(a)*rr*0.8, 1.55, Math.sin(a)*rr*0.8],
          [Math.cos(a+0.1)*rr*0.55, 0.72, Math.sin(a+0.1)*rr*0.55],
          [Math.cos(a)*0.31, -0.61, Math.sin(a)*0.31],
          [Math.cos(a)*0.18, -1.48, Math.sin(a)*0.18]
        ];
        this.paths.push(pts);
        for (let j = 0; j < pts.length - 1; j++) {
          const c = [0.72, 0.56, 0.28];
          const fade = j === pts.length - 2 ? 0.45 : 0.22;
          cableVerts.push(pts[j][0],pts[j][1],pts[j][2],c[0]*fade,c[1]*fade,c[2]*fade);
          cableVerts.push(pts[j+1][0],pts[j+1][1],pts[j+1][2],c[0]*fade,c[1]*fade,c[2]*fade);
        }
      }
      this.cables = r.createLines(cableVerts);
      this.pulses = r.createPoints([]);
      this.chipGlow = r.createPoints([
        glowPoint(0,-1.51,0,[0.55,1,.85],26),
        glowPoint(0,-1.48,0,[0.65,1,.9],10)
      ]);
      this.stageGlows = r.createPoints(this.plateMeshes.flatMap((p, ix) => {
        const pts = [glowPoint(0, p.y + .005, 0, [0.65,.92,.78], 4 + ix * .4)];
        return pts;
      }));
      this.ringDots = [];
    }

    update(dt) {
      this.orbit.update(dt);
      const verts = [];
      this.paths.forEach((pts, i) => {
        const speed = 0.16 + (i % 3) * 0.03;
        const progress = (this.t * speed + i * 0.091) % 1;
        const scaled = progress * (pts.length - 1);
        const seg = Math.min(pts.length - 2, Math.floor(scaled));
        const f = scaled - seg;
        const a = pts[seg], b = pts[seg+1];
        const x = a[0] + (b[0]-a[0])*f;
        const y = a[1] + (b[1]-a[1])*f;
        const z = a[2] + (b[2]-a[2])*f;
        const c = [0.65, 1, 0.82];
        verts.push(x,y,z,c[0],c[1],c[2], 1.8 + Math.sin(progress * Math.PI) * 2.1);
        if (f < 0.35 && seg > 0) {
          const p0 = pts[seg-1];
          verts.push(
            p0[0]+(a[0]-p0[0])*f, p0[1]+(a[1]-p0[1])*f, p0[2]+(a[2]-p0[2])*f,
            c[0]*.2,c[1]*.2,c[2]*.2,1.2
          );
        }
      });
      this.renderer.updatePoints(this.pulses, verts);
    }

    draw(t) {
      const r = this.renderer;
      r.begin(this.orbit.camera({ fov: Math.PI * 0.20, near: 0.1, far: 60 }));
      // plates with a faint gold sheen
      for (const p of this.plates) {
        const m = GL.M4.translation(new Float32Array(16), 0, p.y, 0);
        r.drawMesh(p.mesh, m, p.col, { alpha: 0.98 });
      }
      for (const rod of this.rods) {
        const m = GL.M4.translation(new Float32Array(16), rod.x, 0.62, rod.z);
        r.drawMesh(rod.mesh, m, [0.28, 0.32, 0.35], { alpha: 0.8 });
      }
      const chipM = GL.M4.translation(new Float32Array(16), 0, -1.59, 0);
      r.drawMesh(this.chip, chipM, [0.72, 0.56, 0.29], { alpha: 1 });

      r.drawLines(this.frame, null, { alpha: .7 });
      r.drawLines(this.cables, null, { alpha: .9 });
      for (const p of this.plates) {
        const ring = GL.lineRing(p.rad, p.y + 0.045, 120, [0.55, 0.95, 0.8], { fade: true, phase: t * 0.4 });
        if (!p.ringGeom) p.ringGeom = r.createLines(ring);
        r.drawLines(p.ringGeom, null, { alpha: .25 });
      }
      r.drawPoints(this.pulses, null, { alpha: .95, softness: 1.35 });
      r.drawPoints(this.chipGlow, null, { alpha: .55, softness: 1.7 });
      r.drawPoints(this.stageGlows, null, { alpha: .3, softness: 2 });
    }
  }

  /* ============================================================
     SURFACE CODE — interactive d=5 schematic patch
     ============================================================ */
  class SurfaceScene extends GL.Scene {
    constructor(canvas, options) {
      super(canvas);
      this.options = options || {};
      this.onChange = this.options.onChange || function () {};
      this.d = 5;
      this.spacing = 0.92;
      this.mode = 'X';
      this.errors = { X: new Set(), Z: new Set() };
      this.orbit = new GL.Orbit(canvas, {
        theta: -0.72, phi: 0.91, distance: 7.8, target: [0,0,0],
        autoRotate: false, minDistance: 5.4, maxDistance: 12
      });
      const r = this.renderer;
      this.dataPositions = [];
      this.faceList = [];
      this.screenPositions = [];
      this.setupGeometry();
      this.faceMesh = r.createMesh(...Object.values(GL.boxMesh(1, 1, 1)));
      this.grid = r.createLines(this.gridVerts());
      this.borders = r.createLines(this.faceBorderVerts());
      this.dataGlow = r.createPoints(this.dataVerts());
      this.errorGlow = r.createPoints([]);
      this.syndromeGlow = r.createPoints([]);
      this.syndromeLines = r.createLines([]);
      this.hoverRing = r.createPoints([glowPoint(0,0,0,[0.6,1,0.85],0)]);
      this._onClick = this._onClick.bind(this);
      this._onMove = this._onMove.bind(this);
      canvas.addEventListener('click', this._onClick);
      canvas.addEventListener('pointermove', this._onMove);
      this.emit();
    }

    setupGeometry() {
      const d = this.d, s = this.spacing;
      const offset = (d - 1) * s / 2;
      for (let row = 0; row < d; row++) {
        for (let col = 0; col < d; col++) {
          this.dataPositions.push({
            index: row * d + col, row, col,
            world: [col * s - offset, 0.06, row * s - offset]
          });
        }
      }
      for (let fr = 0; fr < d - 1; fr++) {
        for (let fc = 0; fc < d - 1; fc++) {
          const type = (fr + fc) % 2 === 0 ? 'Z' : 'X';
          const corners = [
            (fr) * d + fc,
            (fr) * d + fc + 1,
            (fr + 1) * d + fc + 1,
            (fr + 1) * d + fc
          ];
          const cx = (fc + 0.5) * s - offset;
          const cz = (fr + 0.5) * s - offset;
          this.faceList.push({ index: fr * (d-1) + fc, fr, fc, type, corners, center: [cx, 0.015, cz] });
        }
      }
    }

    gridVerts() {
      const v = [];
      const d = this.d, s = this.spacing;
      const offset = (d - 1) * s / 2;
      const c = [0.43, 0.67, 0.61];
      for (let i = 0; i < d; i++) {
        const p = i * s - offset;
        v.push(-offset, 0, p, c[0]*.22,c[1]*.22,c[2]*.22);
        v.push(offset, 0, p, c[0]*.22,c[1]*.22,c[2]*.22);
        v.push(p, 0, -offset, c[0]*.22,c[1]*.22,c[2]*.22);
        v.push(p, 0, offset, c[0]*.22,c[1]*.22,c[2]*.22);
      }
      return v;
    }

    faceBorderVerts() {
      const v = [];
      const s = this.spacing;
      for (const f of this.faceList) {
        const c = f.type === 'X' ? [0.62, 0.56, 1] : [0.42, 0.96, 0.78];
        const x0 = f.center[0] - s * .42, x1 = f.center[0] + s * .42;
        const z0 = f.center[2] - s * .42, z1 = f.center[2] + s * .42;
        const y = 0.03;
        const alpha = .35;
        const pts = [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]];
        for (let i = 0; i < 4; i++) {
          const a = pts[i], b = pts[(i+1)%4];
          v.push(a[0],a[1],a[2], c[0]*alpha,c[1]*alpha,c[2]*alpha);
          v.push(b[0],b[1],b[2], c[0]*alpha,c[1]*alpha,c[2]*alpha);
        }
      }
      return v;
    }

    dataVerts() {
      const v = [];
      for (const d of this.dataPositions) {
        v.push(d.world[0], d.world[1]+.03, d.world[2], 0.72, 0.95, 0.89, 6.2);
      }
      return v;
    }

    faceSyndrome(type, errors) {
      const set = new Set();
      for (const f of this.faceList) {
        if (f.type !== type) continue;
        let parity = 0;
        for (const c of f.corners) if (errors.has(c)) parity ^= 1;
        if (parity) set.add(f.index);
      }
      return set;
    }

    getSyndromes() {
      const faceType = this.mode === 'X' ? 'Z' : 'X';
      return this.faceSyndrome(faceType, this.errors[this.mode]);
    }

    emit(extra) {
      const anyons = this.getSyndromes();
      this.onChange(Object.assign({
        mode: this.mode,
        errors: this.errors[this.mode].size,
        totalErrors: this.errors.X.size + this.errors.Z.size,
        anyons: Array.from(anyons).map(i => this.faceList[i]),
        anyonCount: anyons.size,
        residualX: this.errors.X.size,
        residualZ: this.errors.Z.size
      }, extra || {}));
    }

    setMode(mode) {
      this.mode = mode;
      this.emit({ message: mode === 'X' ? 'X hataları Z-stabilizer plaquette’lerinde sendrom üretir.' : 'Z hataları X-stabilizer plaquette’lerinde sendrom üretir.' });
      this.rebuildDynamic();
    }

    toggleError(index) {
      const set = this.errors[this.mode];
      const added = !set.has(index);
      if (added) set.add(index); else set.delete(index);
      this.rebuildDynamic();
      const anyons = this.getSyndromes().size;
      this.emit({
        message: added
          ? `q${index} üzerinde ${this.mode} hatası eklendi → ${anyons} anyon. Dekoderi çalıştırarak eşlemeyi deneyin.`
          : `q${index} üzerindeki ${this.mode} hatası kaldırıldı → ${anyons} anyon.`
      });
    }

    addRandomError() {
      const candidates = this.dataPositions.filter(d => !this.errors[this.mode].has(d.index));
      if (!candidates.length) return;
      const d = candidates[Math.floor(Math.random() * candidates.length)];
      this.errors[this.mode].add(d.index);
      this.rebuildDynamic();
      this.emit({ message: `q${d.index} üzerinde ${this.mode} hatası enjekte edildi.` });
    }

    clearErrors() {
      this.errors.X.clear(); this.errors.Z.clear();
      this.rebuildDynamic();
      this.emit({ message: 'Yama temizlendi. Tüm stabilizer’lar +1 özdeğerine döndü.' });
    }

    rebuildDynamic() {
      const errVerts = [];
      for (const [mode, set] of Object.entries(this.errors)) {
        const col = mode === 'X' ? [1, .55, .34] : [.66, .56, 1];
        for (const idx of set) {
          const d = this.dataPositions[idx];
          errVerts.push(d.world[0], d.world[1]+.035, d.world[2], col[0],col[1],col[2], 11);
        }
      }
      this.renderer.updatePoints(this.errorGlow, errVerts);

      const syn = this.getSyndromes();
      const faceType = this.mode === 'X' ? 'Z' : 'X';
      const col = this.mode === 'X' ? [0.55, 1, .78] : [.76, .65, 1];
      const pts = [], lines = [];
      for (const fi of syn) {
        const f = this.faceList[fi];
        pts.push(f.center[0], .12, f.center[2], col[0],col[1],col[2], 14);
        const s = this.spacing * .47;
        const y = .09;
        const x0 = f.center[0]-s, x1=f.center[0]+s, z0=f.center[2]-s, z1=f.center[2]+s;
        const p = [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]];
        for (let i=0;i<4;i++) {
          const a=p[i], b=p[(i+1)%4];
          lines.push(a[0],a[1],a[2], col[0],col[1],col[2]);
          lines.push(b[0],b[1],b[2], col[0],col[1],col[2]);
        }
      }
      this.renderer.updatePoints(this.syndromeGlow, pts);
      this.renderer.updateLines(this.syndromeLines, lines);
    }

    decode() {
      const type = this.mode;
      const errors = this.errors[type];
      const target = this.faceSyndrome(type === 'X' ? 'Z' : 'X', errors);
      if (target.size === 0) {
        this.emit({ message: 'Sendrom temiz; dekoder düzeltme uygulamadı.' });
        return;
      }
      const all = Array.from({ length: this.d * this.d }, (_, i) => i);
      const syndromeFor = (set) => this.faceSyndrome(type === 'X' ? 'Z' : 'X', new Set(set));
      const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
      let correction = null;
      // Exhaustive search for small weights: pedagogical, exact for ≤3 errors.
      for (const q of all) if (same(syndromeFor([q]), target)) { correction = [q]; break; }
      if (!correction) {
        outer:
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            if (same(syndromeFor([all[i], all[j]]), target)) { correction = [all[i], all[j]]; break outer; }
          }
        }
      }
      if (!correction) {
        outer3:
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            for (let k = j + 1; k < all.length; k++) {
              if (same(syndromeFor([all[i], all[j], all[k]]), target)) {
                correction = [all[i], all[j], all[k]]; break outer3;
              }
            }
          }
        }
      }
      if (!correction) {
        // Greedy fallback: flip the qubit that maximally reduces the syndrome.
        const working = new Set(errors);
        for (let step = 0; step < 8; step++) {
          const active = this.faceSyndrome(type === 'X' ? 'Z' : 'X', working);
          if (!active.size) break;
          let best = null, bestScore = Infinity;
          for (const q of all) {
            const next = new Set(working);
            if (next.has(q)) next.delete(q); else next.add(q);
            const score = this.faceSyndrome(type === 'X' ? 'Z' : 'X', next).size;
            if (score < bestScore) { bestScore = score; best = q; }
          }
          if (best == null) break;
          if (working.has(best)) working.delete(best); else working.add(best);
        }
        this.errors[type] = working;
      } else {
        for (const q of correction) {
          if (errors.has(q)) errors.delete(q); else errors.add(q);
        }
      }
      this.rebuildDynamic();
      const residual = this.errors[type].size;
      this.emit({
        message: residual
          ? `Dekoder ${correction ? correction.length : 'birkaç'} kübitlik bir düzeltme seçti; ${residual} artık hata kaldı (dejenere çözüm).`
          : 'Dekoder anyonları eşleştirdi; artık hata kalmadı.',
        decoded: true
      });
    }

    update(dt) {
      this.orbit.update(dt);
    }

    _pointerData(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let best = null, bestD = 22;
      for (let i = 0; i < this.screenPositions.length; i++) {
        const s = this.screenPositions[i];
        if (!s) continue;
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }

    _onClick(e) {
      if (this.orbit.didDrag) return;
      const idx = this._pointerData(e);
      if (idx != null) this.toggleError(idx);
    }

    _onMove(e) {
      if (this.orbit.dragging) return;
      const idx = this._pointerData(e);
      if (idx == null) {
        this.renderer.updatePoints(this.hoverRing, [glowPoint(0,0,0,[0.6,1,0.85],0)]);
        return;
      }
      const d = this.dataPositions[idx];
      this.renderer.updatePoints(this.hoverRing, [glowPoint(d.world[0], d.world[1]+.04, d.world[2], [.65,1,.9], 16)]);
    }

    draw(t) {
      const r = this.renderer;
      r.begin(this.orbit.camera({ fov: Math.PI * 0.24, near: .1, far: 40 }));
      // Face fills. The model matrix is rebuilt once per face (translation × scale).
      const syndromes = this.getSyndromes();
      for (const f of this.faceList) {
        const active = syndromes.has(f.index);
        const c = f.type === 'X' ? [0.45, 0.38, 0.95] : [0.28, 0.8, 0.62];
        const alpha = active ? 0.4 : 0.115;
        const sm = GL.M4.scaling(new Float32Array(16), this.spacing * .84, 0.012, this.spacing * .84);
        const tm = GL.M4.translation(new Float32Array(16), f.center[0], -0.015, f.center[2]);
        const model = GL.M4.multiply(new Float32Array(16), tm, sm);
        r.drawMesh(this.faceMesh, model, c, { alpha });
      }
      r.drawLines(this.grid, null, { alpha: .8 });
      r.drawLines(this.borders, null, { alpha: .8 });
      r.drawLines(this.syndromeLines, null, { alpha: 1 });
      r.drawPoints(this.dataGlow, null, { alpha: 1, softness: 1.3 });
      r.drawPoints(this.errorGlow, null, { alpha: 1, softness: 1.2 });
      r.drawPoints(this.syndromeGlow, null, { alpha: .95, softness: 1.1 });
      r.drawPoints(this.hoverRing, null, { alpha: .4, softness: 1.3 });

      // cache projected data qubit positions for picking
      this.screenPositions = this.dataPositions.map(d => r.project(d.world));
    }
  }

  window.Scenes = { HeroScene, BlochScene, StateBarsScene, CryostatScene, SurfaceScene, hslToRgb, phaseColorRgb, glowPoint };
})();
