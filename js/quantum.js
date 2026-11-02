/* ============================================================
   Q/LAB — quantum state-vector kernel
   Zero dependencies. Big-endian qubit ordering: q0 is the MSB.
   ============================================================ */
(function () {
  'use strict';

  const C = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    scale: (a, s) => [a[0] * s, a[1] * s],
    abs2: (a) => a[0] * a[0] + a[1] * a[1],
    abs: (a) => Math.hypot(a[0], a[1]),
    phase: (a) => Math.atan2(a[1], a[0]),
    conj: (a) => [a[0], -a[1]],
    exp: (re, im) => [Math.exp(re) * Math.cos(im), Math.exp(re) * Math.sin(im)],
    zero: () => [0, 0],
    one: () => [1, 0]
  };

  const SQ2 = Math.SQRT1_2;
  const gates = {
    I: [[[1,0],[0,0]], [[0,0],[1,0]]],
    H: [[[SQ2,0],[SQ2,0]], [[SQ2,0],[-SQ2,0]]],
    X: [[[0,0],[1,0]], [[1,0],[0,0]]],
    Y: [[[0,0],[0,-1]], [[0,1],[0,0]]],
    Z: [[[1,0],[0,0]], [[0,0],[-1,0]]],
    S: [[[1,0],[0,0]], [[0,0],[0,1]]],
    T: [[[1,0],[0,0]], [[0,0],[SQ2,SQ2]]],
    SX: [[[0.5,0.5],[0.5,-0.5]], [[0.5,-0.5],[0.5,0.5]]]
  };

  function rx(theta) {
    const c = Math.cos(theta / 2), s = Math.sin(theta / 2);
    return [[[c,0],[0,-s]], [[0,-s],[c,0]]];
  }
  function ry(theta) {
    const c = Math.cos(theta / 2), s = Math.sin(theta / 2);
    return [[[c,0],[-s,0]], [[s,0],[c,0]]];
  }
  function rz(theta) {
    return [[[Math.cos(-theta/2), Math.sin(-theta/2)], [0,0]], [[0,0],[Math.cos(theta/2), Math.sin(theta/2)]]];
  }
  function phaseGate(phi) {
    return [[[1,0],[0,0]], [[0,0],[Math.cos(phi), Math.sin(phi)]]];
  }

  function state(n) {
    const size = 1 << n;
    const s = new Float64Array(size * 2);
    s[0] = 1;
    return s;
  }

  function clone(s) { return new Float64Array(s); }

  function applySingle(s, n, qubit, matrix) {
    const size = 1 << n;
    const mask = 1 << (n - 1 - qubit);
    const a = matrix[0][0], b = matrix[0][1], c = matrix[1][0], d = matrix[1][1];
    for (let i = 0; i < size; i++) {
      if (i & mask) continue;
      const j = i | mask;
      const a0 = [s[i * 2], s[i * 2 + 1]];
      const a1 = [s[j * 2], s[j * 2 + 1]];
      const n0 = C.add(C.mul(a, a0), C.mul(b, a1));
      const n1 = C.add(C.mul(c, a0), C.mul(d, a1));
      s[i * 2] = n0[0]; s[i * 2 + 1] = n0[1];
      s[j * 2] = n1[0]; s[j * 2 + 1] = n1[1];
    }
  }

  function applyCNOT(s, n, control, target) {
    if (control === target) return;
    const size = 1 << n;
    const cm = 1 << (n - 1 - control);
    const tm = 1 << (n - 1 - target);
    for (let i = 0; i < size; i++) {
      if (!(i & cm) || (i & tm)) continue;
      const j = i | tm;
      const ar = s[i * 2], ai = s[i * 2 + 1];
      s[i * 2] = s[j * 2]; s[i * 2 + 1] = s[j * 2 + 1];
      s[j * 2] = ar; s[j * 2 + 1] = ai;
    }
  }

  function applyCZ(s, n, a, b) {
    const size = 1 << n;
    const am = 1 << (n - 1 - a), bm = 1 << (n - 1 - b);
    for (let i = 0; i < size; i++) {
      if ((i & am) && (i & bm)) {
        s[i * 2] = -s[i * 2];
        s[i * 2 + 1] = -s[i * 2 + 1];
      }
    }
  }

  function applyCP(s, n, a, b, phi) {
    const size = 1 << n;
    const am = 1 << (n - 1 - a), bm = 1 << (n - 1 - b);
    const p = [Math.cos(phi), Math.sin(phi)];
    for (let i = 0; i < size; i++) {
      if ((i & am) && (i & bm)) {
        const v = [s[i * 2], s[i * 2 + 1]];
        const w = C.mul(p, v);
        s[i * 2] = w[0]; s[i * 2 + 1] = w[1];
      }
    }
  }

  function applySWAP(s, n, a, b) {
    if (a === b) return;
    const size = 1 << n;
    const am = 1 << (n - 1 - a), bm = 1 << (n - 1 - b);
    const out = new Float64Array(s.length);
    for (let i = 0; i < size; i++) {
      const abit = !!(i & am), bbit = !!(i & bm);
      let j = i;
      if (abit !== bbit) j = i ^ am ^ bm;
      out[j * 2] = s[i * 2];
      out[j * 2 + 1] = s[i * 2 + 1];
    }
    s.set(out);
  }

  function applyU(s, n, qubit, name, param) {
    if (name === 'Rx') return applySingle(s, n, qubit, rx(param));
    if (name === 'Ry') return applySingle(s, n, qubit, ry(param));
    if (name === 'Rz') return applySingle(s, n, qubit, rz(param));
    if (name === 'P') return applySingle(s, n, qubit, phaseGate(param));
    return applySingle(s, n, qubit, gates[name] || gates.I);
  }

  function applyGate(s, n, gate) {
    if (!gate) return;
    const name = gate.gate || gate;
    const p = gate.param == null ? Math.PI / 2 : gate.param;
    if (name === 'CNOT') return applyCNOT(s, n, gate.qubit, gate.target);
    if (name === 'CZ') return applyCZ(s, n, gate.qubit, gate.target);
    if (name === 'SWAP') return applySWAP(s, n, gate.qubit, gate.target);
    if (name === 'CP') return applyCP(s, n, gate.qubit, gate.target, p);
    return applyU(s, n, gate.qubit, name, p);
  }

  function applyCircuit(s, n, circuit, uptoColumn) {
    const out = clone(s);
    const limit = uptoColumn == null ? Infinity : uptoColumn;
    for (const g of circuit) {
      if (g.col < limit) applyGate(out, n, g);
    }
    return out;
  }

  function amplitudes(s) {
    const n = s.length / 2;
    const out = [];
    for (let i = 0; i < n; i++) out.push({ re: s[i * 2], im: s[i * 2 + 1] });
    return out;
  }

  function probabilities(s) {
    const n = s.length / 2;
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = C.abs2([s[i * 2], s[i * 2 + 1]]);
    return out;
  }

  function norm(s) {
    let sum = 0;
    for (let i = 0; i < s.length; i += 2) sum += s[i] * s[i] + s[i + 1] * s[i + 1];
    return Math.sqrt(sum);
  }

  function normalize(s) {
    const z = norm(s);
    if (z > 0) for (let i = 0; i < s.length; i++) s[i] /= z;
    return s;
  }

  function measure(s, n, qubit) {
    const probs = probabilities(s);
    const mask = 1 << (n - 1 - qubit);
    let p1 = 0;
    for (let i = 0; i < probs.length; i++) if (i & mask) p1 += probs[i];
    const outcome = Math.random() < p1 ? 1 : 0;
    for (let i = 0; i < probs.length; i++) {
      const bit = (i & mask) ? 1 : 0;
      if (bit !== outcome) {
        s[i * 2] = 0; s[i * 2 + 1] = 0;
      }
    }
    normalize(s);
    return outcome;
  }

  function measureAll(s, n) {
    const probs = probabilities(s);
    let r = Math.random(), acc = 0, outcome = probs.length - 1;
    for (let i = 0; i < probs.length; i++) {
      acc += probs[i];
      if (r <= acc) { outcome = i; break; }
    }
    s.fill(0);
    s[outcome * 2] = 1;
    return outcome;
  }

  function sample(s, n, shots) {
    const probs = probabilities(s);
    const counts = new Array(probs.length).fill(0);
    for (let k = 0; k < shots; k++) {
      let r = Math.random(), acc = 0, idx = probs.length - 1;
      for (let i = 0; i < probs.length; i++) {
        acc += probs[i];
        if (r <= acc) { idx = i; break; }
      }
      counts[idx]++;
    }
    return counts;
  }

  function reduceToQubit(s, n, qubit) {
    const size = 1 << n;
    const mask = 1 << (n - 1 - qubit);
    const rho = {
      r00: 0, i00: 0,
      r01: 0, i01: 0,
      r10: 0, i10: 0,
      r11: 0, i11: 0
    };
    for (let i = 0; i < size; i++) {
      if (i & mask) continue;
      const j = i | mask;
      const a = [s[i * 2], s[i * 2 + 1]];
      const b = [s[j * 2], s[j * 2 + 1]];
      rho.r00 += C.abs2(a);
      rho.r11 += C.abs2(b);
      const off = C.mul(a, C.conj(b));
      rho.r01 += off[0]; rho.i01 += off[1];
    }
    rho.r10 = rho.r01; rho.i10 = -rho.i01;
    return rho;
  }

  function blochVector(s, n, qubit) {
    if (n === 1) {
      const a0 = [s[0], s[1]], a1 = [s[2], s[3]];
      const p0 = C.abs2(a0), p1 = C.abs2(a1);
      const off = C.mul(a0, C.conj(a1));
      // ρ = (I + xX + yY + zZ)/2 ⇒ y = −2·Im(ρ₀₁).
      return { x: 2 * off[0], y: -2 * off[1], z: p0 - p1, p0, p1 };
    }
    const rho = reduceToQubit(s, n, qubit);
    return {
      x: 2 * rho.r01,
      y: -2 * rho.i01,
      z: rho.r00 - rho.r11,
      p0: rho.r00,
      p1: rho.r11
    };
  }

  function basisLabel(index, n) {
    let out = '';
    for (let q = 0; q < n; q++) out += ((index >> (n - 1 - q)) & 1) ? '1' : '0';
    return out;
  }

  function ketLabel(index, n) { return '|' + basisLabel(index, n) + '⟩'; }

  function formatNumber(v, digits) {
    digits = digits == null ? 3 : digits;
    const a = Math.abs(v);
    if (a < 1e-9) return '0';
    if (a >= 1000 || (a > 0 && a < 0.001)) return v.toExponential(1);
    return v.toFixed(digits).replace(/\.?0+$/, '');
  }

  function formatComplex(re, im, digits) {
    digits = digits == null ? 3 : digits;
    if (Math.abs(im) < 1e-9) return formatNumber(re, digits);
    if (Math.abs(re) < 1e-9) {
      if (Math.abs(im - 1) < 1e-9) return 'i';
      if (Math.abs(im + 1) < 1e-9) return '−i';
      return formatNumber(im, digits) + 'i';
    }
    return formatNumber(re, digits) + (im >= 0 ? ' + ' : ' − ') + formatNumber(Math.abs(im), digits) + 'i';
  }

  function ketExpression(s, n, digits) {
    const terms = [];
    for (let i = 0; i < (1 << n); i++) {
      const re = s[i * 2], im = s[i * 2 + 1];
      const p = C.abs2([re, im]);
      if (p < 1e-9) continue;
      let coefficient = formatComplex(re, im, digits).replace(/-/g, '−');
      const negative = coefficient.startsWith('−');
      if (negative) coefficient = coefficient.slice(1).trim();
      if (coefficient === '1') coefficient = '';
      // Parenthesise a genuine complex coefficient so |ψ⟩ = (a + bi)|x⟩.
      if (Math.abs(re) > 1e-9 && Math.abs(im) > 1e-9) coefficient = '(' + coefficient + ')';
      terms.push({
        text: coefficient + ketLabel(i, n),
        sign: negative ? '−' : '+',
        p
      });
    }
    if (!terms.length) return '0';
    terms.sort((a, b) => b.p - a.p);
    return terms.slice(0, 6).map((term, i) => {
      if (i === 0) return (term.sign === '−' ? '−' : '') + term.text;
      return ' ' + (term.sign === '−' ? '−' : '+') + ' ' + term.text;
    }).join('');
  }

  function phaseDeg(re, im) {
    let d = Math.atan2(im, re) * 180 / Math.PI;
    if (d < 0) d += 360;
    return d;
  }

  function phaseColor(angle) {
    // Maps a relative phase in radians to a perceptually spread colour.
    let h = (angle * 180 / Math.PI + 360) % 360;
    if (h > 300) h -= 360;
    return `hsl(${h}, 82%, 64%)`;
  }

  function hamming(x) {
    let c = 0;
    while (x) { c += x & 1; x >>>= 1; }
    return c;
  }

  function qasm(circuit, n) {
    const lines = ['OPENQASM 2.0;', 'include "qelib1.inc";', '', `qreg q[${n}];`, 'creg c[' + n + '];', ''];
    const sorted = circuit.slice().sort((a, b) => a.col - b.col || a.qubit - b.qubit);
    for (const g of sorted) {
      if (g.gate === 'CNOT') lines.push(`cx q[${g.qubit}],q[${g.target}];`);
      else if (g.gate === 'CZ') lines.push(`cz q[${g.qubit}],q[${g.target}];`);
      else if (g.gate === 'SWAP') lines.push(`swap q[${g.qubit}],q[${g.target}];`);
      else if (g.gate === 'Rx' || g.gate === 'Ry' || g.gate === 'Rz') lines.push(`${g.gate.toLowerCase()}(${(g.param || Math.PI / 2).toFixed(6)}) q[${g.qubit}];`);
      else lines.push(`${g.gate.toLowerCase()} q[${g.qubit}];`);
    }
    lines.push('');
    for (let q = 0; q < n; q++) lines.push(`measure q[${q}] -> c[${q}];`);
    return lines.join('\n');
  }

  window.Q = {
    C, gates, rx, ry, rz, phaseGate,
    state, clone, applySingle, applyCNOT, applyCZ, applyCP, applySWAP, applyU, applyGate, applyCircuit,
    amplitudes, probabilities, norm, normalize, measure, measureAll, sample, reduceToQubit, blochVector,
    basisLabel, ketLabel, formatNumber, formatComplex, ketExpression, phaseDeg, phaseColor, hamming, qasm
  };
})();
