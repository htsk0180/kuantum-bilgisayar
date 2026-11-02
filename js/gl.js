/* ============================================================
   Q/LAB — minimal WebGL engine
   mat4, procedural meshes, orbit controls, additive sprites.
   ============================================================ */
(function () {
  'use strict';

  /* ----------------------------- mat4 ----------------------------- */
  const M4 = {
    identity(out) {
      out = out || new Float32Array(16);
      out.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
      return out;
    },
    copy(out, a) { out.set(a); return out; },
    multiply(out, a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
          o[c * 4 + r] =
            a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
            a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
      }
      out.set(o);
      return out;
    },
    perspective(out, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2);
      out = out || new Float32Array(16);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[10] = (far + near) / (near - far);
      out[11] = -1;
      out[14] = (2 * far * near) / (near - far);
      return out;
    },
    lookAt(out, eye, target, up) {
      out = out || new Float32Array(16);
      let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
      let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
      let xx = up[1] * zz - up[2] * zy;
      let xy = up[2] * zx - up[0] * zz;
      let xz = up[0] * zy - up[1] * zx;
      let xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
      const yx = zy * xz - zz * xy;
      const yy = zz * xx - zx * xz;
      const yz = zx * xy - zy * xx;
      out.set([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
        -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
        -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
        1
      ]);
      return out;
    },
    translation(out, x, y, z) {
      out = out || new Float32Array(16);
      M4.identity(out);
      out[12] = x; out[13] = y; out[14] = z;
      return out;
    },
    scaling(out, x, y, z) {
      out = out || new Float32Array(16);
      M4.identity(out);
      out[0] = x; out[5] = y; out[10] = z;
      return out;
    },
    rotX(out, a) {
      out = out || new Float32Array(16);
      const c = Math.cos(a), s = Math.sin(a);
      out.set([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
      return out;
    },
    rotY(out, a) {
      out = out || new Float32Array(16);
      const c = Math.cos(a), s = Math.sin(a);
      out.set([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
      return out;
    },
    rotZ(out, a) {
      out = out || new Float32Array(16);
      const c = Math.cos(a), s = Math.sin(a);
      out.set([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
      return out;
    },
    transpose(out, a) {
      const o = new Float32Array(16);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = a[c * 4 + r];
      out.set(o); return out;
    },
    transformPoint(m, p) {
      const x = p[0], y = p[1], z = p[2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
      return [
        (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
        (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
        (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
        w
      ];
    }
  };

  /* ----------------------------- GL utils ----------------------------- */
  function compile(gl, type, source) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      console.error('Shader compile error:', log, source);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function program(gl, vsrc, fsrc) {
    const vs = compile(gl, gl.VERTEX_SHADER, vsrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(p));
      return null;
    }
    gl.deleteShader(vs); gl.deleteShader(fs);
    return p;
  }

  const SPRITE_VS = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    attribute float aSize;
    uniform mat4 uVP;
    uniform mat4 uModel;
    uniform float uDpr;
    varying vec3 vColor;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      gl_Position = uVP * world;
      gl_PointSize = aSize * uDpr;
      vColor = aColor;
    }
  `;
  const SPRITE_FS = `
    precision mediump float;
    uniform float uAlpha;
    uniform float uSoftness;
    varying vec3 vColor;
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      float d = length(p);
      if (d > 1.0) discard;
      float core = smoothstep(1.0, 0.0, d);
      float glow = pow(core, uSoftness);
      float alpha = glow * uAlpha;
      if (alpha < 0.008) discard;
      gl_FragColor = vec4(vColor * (0.7 + core * 0.7), alpha);
    }
  `;
  const LINE_VS = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uVP;
    uniform mat4 uModel;
    varying vec3 vColor;
    varying float vDepth;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      gl_Position = uVP * world;
      vColor = aColor;
      vDepth = gl_Position.z / gl_Position.w;
    }
  `;
  const LINE_FS = `
    precision mediump float;
    uniform float uAlpha;
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, uAlpha);
    }
  `;
  const LIT_VS = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uVP;
    uniform mat4 uModel;
    varying vec3 vNormal;
    varying vec3 vWorld;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorld = world.xyz;
      vNormal = mat3(uModel) * aNormal;
      gl_Position = uVP * world;
    }
  `;
  const LIT_FS = `
    precision mediump float;
    uniform vec3 uColor;
    uniform float uAlpha;
    uniform vec3 uCamera;
    varying vec3 vNormal;
    varying vec3 vWorld;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 L1 = normalize(vec3(-0.45, 0.8, 0.55));
      vec3 L2 = normalize(vec3(0.75, 0.2, -0.35));
      float d1 = max(dot(n, L1), 0.0);
      float d2 = max(dot(n, L2), 0.0);
      vec3 V = normalize(uCamera - vWorld);
      float rim = pow(1.0 - max(dot(n, V), 0.0), 2.4);
      vec3 col = uColor * (0.16 + 0.65 * d1 + 0.28 * d2);
      col += uColor * rim * 0.7;
      gl_FragColor = vec4(col, uAlpha);
    }
  `;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl', {
        alpha: true, antialias: true, premultipliedAlpha: false,
        powerPreference: 'high-performance', preserveDrawingBuffer: false
      }) || canvas.getContext('experimental-webgl');
      if (!this.gl) throw new Error('WebGL is not available');
      const gl = this.gl;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = 1; this.height = 1;
      this.pointProgram = program(gl, SPRITE_VS, SPRITE_FS);
      this.lineProgram = program(gl, LINE_VS, LINE_FS);
      this.litProgram = program(gl, LIT_VS, LIT_FS);
      this.locations = {
        sprite: this._locations(this.pointProgram, ['uVP','uModel','uDpr','uAlpha','uSoftness']),
        line: this._locations(this.lineProgram, ['uVP','uModel','uAlpha']),
        lit: this._locations(this.litProgram, ['uVP','uModel','uColor','uAlpha','uCamera'])
      };
      this.attrs = {};
      this.attrs.sprite = {
        position: gl.getAttribLocation(this.pointProgram, 'aPosition'),
        color: gl.getAttribLocation(this.pointProgram, 'aColor'),
        size: gl.getAttribLocation(this.pointProgram, 'aSize')
      };
      this.attrs.line = {
        position: gl.getAttribLocation(this.lineProgram, 'aPosition'),
        color: gl.getAttribLocation(this.lineProgram, 'aColor')
      };
      this.attrs.lit = {
        position: gl.getAttribLocation(this.litProgram, 'aPosition'),
        normal: gl.getAttribLocation(this.litProgram, 'aNormal')
      };
      this.camera = null;
      this.vp = new Float32Array(16);
      this.proj = new Float32Array(16);
      this.view = new Float32Array(16);
      this.eye = [0,0,6];
      this.resize();
    }

    _locations(p, names) {
      const o = {};
      for (const n of names) o[n] = this.gl.getUniformLocation(p, n);
      return o;
    }

    resize() {
      const c = this.canvas;
      const w = Math.max(1, Math.floor(c.clientWidth));
      const h = Math.max(1, Math.floor(c.clientHeight));
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.floor(w * this.dpr), ph = Math.floor(h * this.dpr);
      if (c.width !== pw || c.height !== ph) {
        c.width = pw; c.height = ph;
      }
      this.width = w; this.height = h;
      this.gl.viewport(0, 0, pw, ph);
    }

    clear() {
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    setCamera(camera) {
      this.camera = camera;
      const eye = camera.eye || [0,0,6];
      this.eye = eye;
      M4.perspective(this.proj, camera.fov || Math.PI / 4, this.width / this.height, camera.near || 0.1, camera.far || 100);
      M4.lookAt(this.view, eye, camera.target || [0,0,0], camera.up || [0,1,0]);
      M4.multiply(this.vp, this.proj, this.view);
    }

    begin(camera) {
      this.resize();
      this.clear();
      this.setCamera(camera);
      this.gl.enable(this.gl.BLEND);
    }

    setBlend(additive) {
      const gl = this.gl;
      if (additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    createPoints(vertices) {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      return { buffer: buf, count: vertices.length / 7, type: 'points' };
    }

    updatePoints(geom, vertices) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, geom.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      geom.count = vertices.length / 7;
    }

    createLines(vertices) {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      return { buffer: buf, count: vertices.length / 6, type: 'lines' };
    }

    updateLines(geom, vertices) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, geom.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      geom.count = vertices.length / 6;
    }

    drawPoints(geom, model, options) {
      if (!geom || !geom.count) return;
      options = options || {};
      const gl = this.gl;
      gl.useProgram(this.pointProgram);
      gl.uniformMatrix4fv(this.locations.sprite.uVP, false, this.vp);
      gl.uniformMatrix4fv(this.locations.sprite.uModel, false, model || M4.identity());
      gl.uniform1f(this.locations.sprite.uDpr, this.dpr);
      gl.uniform1f(this.locations.sprite.uAlpha, options.alpha == null ? 1 : options.alpha);
      gl.uniform1f(this.locations.sprite.uSoftness, options.softness == null ? 1.4 : options.softness);
      gl.bindBuffer(gl.ARRAY_BUFFER, geom.buffer);
      const stride = 7 * 4;
      gl.enableVertexAttribArray(this.attrs.sprite.position);
      gl.vertexAttribPointer(this.attrs.sprite.position, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this.attrs.sprite.color);
      gl.vertexAttribPointer(this.attrs.sprite.color, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(this.attrs.sprite.size);
      gl.vertexAttribPointer(this.attrs.sprite.size, 1, gl.FLOAT, false, stride, 24);
      gl.disable(gl.DEPTH_TEST);
      this.setBlend(true);
      gl.drawArrays(gl.POINTS, 0, geom.count);
    }

    drawLines(geom, model, options) {
      if (!geom || !geom.count) return;
      options = options || {};
      const gl = this.gl;
      gl.useProgram(this.lineProgram);
      gl.uniformMatrix4fv(this.locations.line.uVP, false, this.vp);
      gl.uniformMatrix4fv(this.locations.line.uModel, false, model || M4.identity());
      gl.uniform1f(this.locations.line.uAlpha, options.alpha == null ? 1 : options.alpha);
      gl.bindBuffer(gl.ARRAY_BUFFER, geom.buffer);
      const stride = 6 * 4;
      gl.enableVertexAttribArray(this.attrs.line.position);
      gl.vertexAttribPointer(this.attrs.line.position, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this.attrs.line.color);
      gl.vertexAttribPointer(this.attrs.line.color, 3, gl.FLOAT, false, stride, 12);
      gl.disable(gl.DEPTH_TEST);
      this.setBlend(options.additive !== false);
      gl.lineWidth(1);
      gl.drawArrays(options.loop ? gl.LINE_LOOP : gl.LINES, 0, geom.count);
    }

    createMesh(positions, normals, indices) {
      const gl = this.gl;
      const pos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, pos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
      const nor = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, nor);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
      const idx = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
      return { pos, nor, idx, count: indices.length, type: 'mesh' };
    }

    drawMesh(mesh, model, color, options) {
      if (!mesh) return;
      options = options || {};
      const gl = this.gl;
      gl.useProgram(this.litProgram);
      gl.uniformMatrix4fv(this.locations.lit.uVP, false, this.vp);
      gl.uniformMatrix4fv(this.locations.lit.uModel, false, model || M4.identity());
      gl.uniform3fv(this.locations.lit.uColor, new Float32Array(color));
      gl.uniform1f(this.locations.lit.uAlpha, options.alpha == null ? 1 : options.alpha);
      gl.uniform3fv(this.locations.lit.uCamera, new Float32Array(this.eye));
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pos);
      gl.enableVertexAttribArray(this.attrs.lit.position);
      gl.vertexAttribPointer(this.attrs.lit.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nor);
      gl.enableVertexAttribArray(this.attrs.lit.normal);
      gl.vertexAttribPointer(this.attrs.lit.normal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      this.setBlend(false);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.DEPTH_TEST);
    }

    project(point) {
      const m = this.vp;
      const x = point[0], y = point[1], z = point[2];
      const w = m[3]*x + m[7]*y + m[11]*z + m[15];
      if (w <= 0) return null;
      const nx = (m[0]*x + m[4]*y + m[8]*z + m[12]) / w;
      const ny = (m[1]*x + m[5]*y + m[9]*z + m[13]) / w;
      return {
        x: (nx * 0.5 + 0.5) * this.width,
        y: (1 - (ny * 0.5 + 0.5)) * this.height,
        depth: w
      };
    }
  }

  /* ----------------------------- meshes ----------------------------- */
  function cylinderMesh(radiusTop, radiusBottom, height, segments) {
    segments = segments || 48;
    const positions = [], normals = [], indices = [];
    const half = height / 2;
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const slope = (radiusBottom - radiusTop) / height;
      const nl = Math.hypot(1, slope);
      positions.push(radiusTop * ca, half, radiusTop * sa);
      normals.push(ca / nl, slope / nl, sa / nl);
      positions.push(radiusBottom * ca, -half, radiusBottom * sa);
      normals.push(ca / nl, slope / nl, sa / nl);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    // top cap
    const topCenter = positions.length / 3;
    positions.push(0, half, 0); normals.push(0, 1, 0);
    const tb = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      positions.push(radiusTop * Math.cos(a), half, radiusTop * Math.sin(a));
      normals.push(0, 1, 0);
    }
    for (let i = 0; i < segments; i++) indices.push(topCenter, tb + i + 1, tb + i);
    // bottom cap
    const botCenter = positions.length / 3;
    positions.push(0, -half, 0); normals.push(0, -1, 0);
    const bb = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      positions.push(radiusBottom * Math.cos(a), -half, radiusBottom * Math.sin(a));
      normals.push(0, -1, 0);
    }
    for (let i = 0; i < segments; i++) indices.push(botCenter, bb + i, bb + i + 1);
    return { positions, normals, indices };
  }

  function boxMesh(w, h, d) {
    const x = w / 2, y = h / 2, z = d / 2;
    const positions = [], normals = [], indices = [];
    const faces = [
      { n: [0,0,1], v: [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]] },
      { n: [0,0,-1], v: [[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]] },
      { n: [1,0,0], v: [[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]] },
      { n: [-1,0,0], v: [[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]] },
      { n: [0,1,0], v: [[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]] },
      { n: [0,-1,0], v: [[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]] }
    ];
    for (const f of faces) {
      const base = positions.length / 3;
      for (const p of f.v) { positions.push(p[0],p[1],p[2]); normals.push(f.n[0],f.n[1],f.n[2]); }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return { positions, normals, indices };
  }

  function lineRing(radius, y, segments, color, opts) {
    segments = segments || 96;
    opts = opts || {};
    const verts = [];
    const c = color || [0.45, 1, 0.78];
    for (let i = 0; i < segments; i++) {
      const a0 = i / segments * Math.PI * 2;
      const a1 = (i + 1) / segments * Math.PI * 2;
      const alpha0 = opts.fade ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(a0 + (opts.phase || 0))) : 1;
      const alpha1 = opts.fade ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(a1 + (opts.phase || 0))) : 1;
      verts.push(radius * Math.cos(a0), y, radius * Math.sin(a0), c[0]*alpha0, c[1]*alpha0, c[2]*alpha0);
      verts.push(radius * Math.cos(a1), y, radius * Math.sin(a1), c[0]*alpha1, c[1]*alpha1, c[2]*alpha1);
    }
    return verts;
  }

  function lineTorus(radius, tube, segments, tubeSegments, color, axis) {
    // Render as wireframe rings, not triangles.
    const verts = [];
    const c = color || [0.4, 0.9, 0.75];
    axis = axis || 'xz';
    for (let i = 0; i < tubeSegments; i++) {
      const phi = i / tubeSegments * Math.PI * 2;
      for (let j = 0; j < segments; j++) {
        const t0 = j / segments * Math.PI * 2;
        const t1 = (j + 1) / segments * Math.PI * 2;
        const p0 = torusPoint(radius, tube, t0, phi, axis);
        const p1 = torusPoint(radius, tube, t1, phi, axis);
        verts.push(p0[0],p0[1],p0[2], c[0],c[1],c[2]);
        verts.push(p1[0],p1[1],p1[2], c[0],c[1],c[2]);
      }
    }
    return verts;
  }

  function torusPoint(R, r, theta, phi, axis) {
    const x = (R + r * Math.cos(phi)) * Math.cos(theta);
    const y = (R + r * Math.cos(phi)) * Math.sin(theta);
    const z = r * Math.sin(phi);
    if (axis === 'xy') return [x, y, z];
    if (axis === 'yz') return [z, x, y];
    return [x, z, y];
  }

  function sphereWire(radius, latSegments, lonSegments, color, alpha) {
    const verts = [];
    const c = color || [0.45, 1, 0.78];
    alpha = alpha == null ? 0.25 : alpha;
    const push = (a, b) => {
      verts.push(a[0],a[1],a[2], c[0]*alpha, c[1]*alpha, c[2]*alpha);
      verts.push(b[0],b[1],b[2], c[0]*alpha, c[1]*alpha, c[2]*alpha);
    };
    for (let i = 1; i < latSegments; i++) {
      const theta = i / latSegments * Math.PI;
      for (let j = 0; j < lonSegments; j++) {
        const p0 = i / latSegments * Math.PI;
        const t0 = j / lonSegments * Math.PI * 2;
        const t1 = (j + 1) / lonSegments * Math.PI * 2;
        push(sph(radius,p0,t0), sph(radius,p0,t1));
      }
    }
    for (let j = 0; j < lonSegments; j++) {
      const t = j / lonSegments * Math.PI * 2;
      for (let i = 0; i < latSegments; i++) {
        const p0 = i / latSegments * Math.PI;
        const p1 = (i + 1) / latSegments * Math.PI;
        const ca = Math.cos(t), sa = Math.sin(t);
        verts.push(radius*Math.sin(p0)*ca, radius*Math.cos(p0), radius*Math.sin(p0)*sa, c[0]*alpha, c[1]*alpha, c[2]*alpha);
        verts.push(radius*Math.sin(p1)*ca, radius*Math.cos(p1), radius*Math.sin(p1)*sa, c[0]*alpha, c[1]*alpha, c[2]*alpha);
      }
    }
    return verts;
  }

  function sph(r, theta, phi) {
    return [r*Math.sin(theta)*Math.cos(phi), r*Math.cos(theta), r*Math.sin(theta)*Math.sin(phi)];
  }

  function torusPointsMesh(R, r, segs, tubeSegs, color) {
    // small spheres on a torus orbit
    const verts = [];
    const c = color || [0.45,1,0.78];
    for (let i = 0; i < segs; i++) {
      const theta = i / segs * Math.PI * 2;
      const phi = i / segs * Math.PI * 2 * 3;
      const x = (R + r * Math.cos(phi)) * Math.cos(theta);
      const y = (R + r * Math.cos(phi)) * Math.sin(theta);
      const z = r * Math.sin(phi);
      verts.push(x, z, y, c[0],c[1],c[2], 1.4);
    }
    return verts;
  }

  /* ----------------------------- orbit controls ----------------------------- */
  class Orbit {
    constructor(canvas, opts) {
      opts = opts || {};
      this.canvas = canvas;
      this.theta = opts.theta == null ? 0.5 : opts.theta;
      this.phi = opts.phi == null ? 1.15 : opts.phi;
      this.distance = opts.distance || 6;
      this.minDistance = opts.minDistance || 2.6;
      this.maxDistance = opts.maxDistance || 12;
      this.target = opts.target || [0,0,0];
      this.autoRotate = opts.autoRotate == null ? true : opts.autoRotate;
      this.speed = opts.speed == null ? 0.08 : opts.speed;
      this.enabled = true;
      this.dragging = false;
      this.didDrag = false;
      this.lastX = 0; this.lastY = 0;
      this._onDown = this._onDown.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onUp = this._onUp.bind(this);
      this._onWheel = this._onWheel.bind(this);
      canvas.addEventListener('pointerdown', this._onDown);
      window.addEventListener('pointermove', this._onMove);
      window.addEventListener('pointerup', this._onUp);
      canvas.addEventListener('wheel', this._onWheel, { passive: false });
      this.idle = 0;
    }
    _onDown(e) {
      if (!this.enabled) return;
      this.dragging = true; this.didDrag = false;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
    }
    _onMove(e) {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.didDrag = true;
      this.theta -= dx * 0.006;
      this.phi = Math.max(0.12, Math.min(Math.PI - 0.12, this.phi + dy * 0.006));
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.idle = 0;
    }
    _onUp() {
      this.dragging = false;
      this.idle = 0;
    }
    _onWheel(e) {
      if (!this.enabled) return;
      e.preventDefault();
      this.distance *= e.deltaY > 0 ? 1.08 : 0.925;
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
      this.idle = 0;
    }
    update(dt) {
      if (this.autoRotate && !this.dragging) {
        this.idle += dt;
        if (this.idle > 1.2) this.theta += this.speed * dt;
      }
    }
    eye() {
      const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
      return [
        this.target[0] + this.distance * sp * Math.cos(this.theta),
        this.target[1] + this.distance * cp,
        this.target[2] + this.distance * sp * Math.sin(this.theta)
      ];
    }
    camera(opts) {
      opts = opts || {};
      return {
        eye: this.eye(),
        target: this.target,
        fov: opts.fov || Math.PI / 4,
        near: opts.near || 0.1,
        far: opts.far || 100
      };
    }
    destroy() {
      this.canvas.removeEventListener('pointerdown', this._onDown);
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      this.canvas.removeEventListener('wheel', this._onWheel);
    }
  }

  /* ----------------------------- scene base ----------------------------- */
  class Scene {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new Renderer(canvas);
      this.running = false;
      this.t = 0;
      this.last = 0;
      this.visible = false;
      this._raf = null;
      this._loop = this._loop.bind(this);
      this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    start() {
      if (this.running) return;
      if (this._raf) cancelAnimationFrame(this._raf);
      this.running = true;
      this.last = 0;
      this._raf = requestAnimationFrame(this._loop);
    }
    stop() {
      this.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    _loop(now) {
      this._raf = null;
      if (!this.running) return;
      if (!this.last) this.last = now;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      if (this.canvas.clientWidth > 0 && this.canvas.clientHeight > 0) {
        this.renderer.resize();
        this.update(dt, this.t);
        this.draw(this.t);
      }
      if (this.running) this._raf = requestAnimationFrame(this._loop);
    }
    update() {}
    draw() {}
  }

  function showFallback(canvas, message) {
    const parent = canvas.parentElement;
    if (!parent || parent.querySelector('.webgl-fallback')) return;
    const el = document.createElement('div');
    el.className = 'webgl-fallback';
    el.innerHTML = '<b>WebGL başlatılamadı</b><span>' + (message || 'Tarayıcınızda WebGL desteğini etkinleştirin.') + '</span>';
    parent.appendChild(el);
  }

  window.GL = {
    M4, Renderer, Orbit, Scene, program,
    cylinderMesh, boxMesh, lineRing, lineTorus, sphereWire, torusPointsMesh,
    showFallback
  };
})();
