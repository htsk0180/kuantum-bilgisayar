/* ============================================================
   Q/LAB — interactive laboratories
   Real state-vector experiments, Grover, QFT, Deutsch–Jozsa,
   repetition / surface codes, decoherence and threshold models.
   Zero dependencies.
   ============================================================ */
(function () {
  'use strict';

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const reducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  function toast(message) {
    document.dispatchEvent(new CustomEvent('qlab:toast', { detail: message }));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function pct(probability, digits) {
    return (probability * 100).toFixed(digits == null ? 1 : digits) + '%';
  }

  function superscript(n) {
    const map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
    return String(n).split('').map(c => map[c] || c).join('');
  }

  function scientific(value) {
    if (!isFinite(value) || value <= 0) return '0';
    if (value >= 0.001) return value.toFixed(value >= 0.1 ? 3 : 4).replace(/0+$/, '').replace(/\.$/, '');
    const parts = value.toExponential(1).split('e');
    return parts[0] + ' × 10' + superscript(parseInt(parts[1], 10));
  }

  function piFraction(numerator, denominator) {
    if (numerator === 0) return '0';
    let a = numerator, b = denominator;
    const gcd = (x, y) => y ? gcd(y, x % y) : x;
    const g = gcd(Math.abs(a), Math.abs(b));
    a /= g; b /= g;
    const prefix = a === 1 ? 'π' : a + 'π';
    return b === 1 ? prefix : prefix + '/' + b;
  }

  function setClass(el, name, on) {
    if (el) el.classList.toggle(name, !!on);
  }

  function makeScene(SceneClass, canvasSelector, options) {
    if (!window.GL || !window.Scenes || !SceneClass) {
      return { scene: null, reason: 'WebGL motoru yüklenemedi.' };
    }
    const canvas = $(canvasSelector);
    if (!canvas) return { scene: null, reason: 'Canvas bulunamadı.' };
    try {
      return { scene: new SceneClass(canvas, options), reason: null };
    } catch (error) {
      console.error('Q/LAB scene error:', error);
      if (window.GL.showFallback) {
        window.GL.showFallback(canvas, 'Bu görselleştirme için WebGL2/WebGL desteği gerekir.');
      }
      return { scene: null, reason: error.message };
    }
  }

  /* ============================================================
     01 — BLOCH LAB
     ============================================================ */
  class BlochLab {
    constructor() {
      this.canvas = $('#bloch-canvas');
      this.state = Q.state(1);
      this.logCount = 0;
      this.logs = [];
      const labels = {};
      $$('[data-bloch-label]').forEach((el) => { labels[el.dataset.blochLabel] = el; });
      const made = makeScene(window.Scenes && window.Scenes.BlochScene, '#bloch-canvas', { labels });
      this.scene = made.scene;
      this.failed = !this.scene && !!this.canvas;
      this.bind();
      this.update();
    }

    bind() {
      $$('[data-bloch-gate]').forEach((button) => {
        button.addEventListener('click', () => {
          const gate = button.dataset.blochGate;
          const param = (gate === 'Rx' || gate === 'Ry' || gate === 'Rz') ? Math.PI / 2 : undefined;
          Q.applyGate(this.state, 1, { gate, qubit: 0, param });
          this.update();
        });
      });
      const measure = $('#bloch-measure');
      if (measure) measure.addEventListener('click', () => this.measure());
      const reset = $('#bloch-reset');
      if (reset) reset.addEventListener('click', () => this.reset());
    }

    update() {
      const s = this.state;
      const vector = Q.blochVector(s, 1, 0);
      const mag = Math.hypot(vector.x, vector.y, vector.z);
      const ket = $('#bloch-ket');
      const prob0 = vector.p0, prob1 = vector.p1;
      setText(ket, Q.ketExpression(s, 1, 3));
      setText($('#bloch-prob0'), pct(prob0));
      setText($('#bloch-prob1'), pct(prob1));
      if ($('#bloch-bar0')) $('#bloch-bar0').style.width = (prob0 * 100).toFixed(2) + '%';
      if ($('#bloch-bar1')) $('#bloch-bar1').style.width = (prob1 * 100).toFixed(2) + '%';
      setText($('#bloch-x'), vector.x.toFixed(3));
      setText($('#bloch-y'), vector.y.toFixed(3));
      setText($('#bloch-z'), vector.z.toFixed(3));
      setText($('#bloch-vector-mag'), '|r| = ' + mag.toFixed(3));

      const a0 = [s[0], s[1]], a1 = [s[2], s[3]];
      const off = Q.C.mul(a0, Q.C.conj(a1));
      const purity = (1 + mag * mag) / 2;
      setText($('#bloch-purity'), (purity > 0.9995 ? 'SAF / ' : 'KARIŞIK / ') + purity.toFixed(3));
      const matrix = $('#bloch-matrix');
      if (matrix) {
        const values = [[prob0, 0], off, Q.C.conj(off), [prob1, 0]];
        $$('span', matrix).forEach((cell, i) => {
          const v = values[i];
          cell.textContent = Q.formatComplex(v[0], v[1], 3);
          cell.title = i === 0 ? 'ρ₀₀ = |α|²' : i === 3 ? 'ρ₁₁ = |β|²' : 'ρ₀₁ / ρ₁₀ eşevrelilik';
        });
      }

      if (this.scene) this.scene.setVector([vector.x, vector.z, vector.y]);
      setText($('#global-qstate'), '1 kübit · güncel');
      this.renderLog();
    }

    renderLog() {
      const log = $('#bloch-log');
      if (!log) return;
      if (!this.logs.length) {
        log.textContent = 'Ölçüm geçmişi boş. Z ölçümü, mevcut olasılıklardan bir sonucu örnekler.';
        return;
      }
      log.innerHTML = this.logs.slice(0, 3).map((entry) => '<span style="display:block">' + entry + '</span>').join('');
    }

    measure() {
      const p1 = Q.probabilities(this.state)[1];
      const outcome = Q.measure(this.state, 1, 0);
      this.logCount++;
      const expected = outcome ? p1 : 1 - p1;
      this.logs.unshift('#' + String(this.logCount).padStart(2, '0') + ' · Z → |' + outcome + '⟩ · beklenen ' + pct(expected));
      this.update();
    }

    reset() {
      this.state = Q.state(1);
      this.logCount = 0;
      this.logs = [];
      this.update();
    }
  }

  /* ============================================================
     02 — DECOHERENCE ENVELOPE
     ============================================================ */
  class DecoherenceLab {
    constructor() {
      this.ratio = $('#t2-ratio');
      this.output = $('#t2-ratio-value');
      this.readout = $('#t2-readout');
      this.t2 = $('#deco-t2');
      this.t1 = $('#deco-t1');
      this.area = $('#deco-area');
      if (this.ratio) this.ratio.addEventListener('input', () => this.draw());
      this.draw();
    }

    draw() {
      const ratio = this.ratio ? parseFloat(this.ratio.value) : 1.6;
      const t1 = 120;
      const x0 = 42, x1 = 400, y0 = 24, y1 = 198;
      const N = 160;
      const t2Points = [], t1Points = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N * 3;
        const x = x0 + (t / 3) * (x1 - x0);
        const coherence = Math.exp(-t);
        const energy = Math.exp(-t * ratio);
        t2Points.push([x, y0 + (1 - coherence) * (y1 - y0)]);
        t1Points.push([x, y0 + (1 - energy) * (y1 - y0)]);
      }
      const toPath = (points) => points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
      if (this.t2) this.t2.setAttribute('d', toPath(t2Points));
      if (this.t1) this.t1.setAttribute('d', toPath(t1Points));
      if (this.area) {
        const area = toPath(t2Points) + ' L' + x1 + ' ' + y1 + ' L' + x0 + ' ' + y1 + ' Z';
        this.area.setAttribute('d', area);
      }
      if (this.output) this.output.value = ratio.toFixed(1);
      if (this.readout) this.readout.textContent = 'T₂ = ' + Math.round(ratio * t1) + ' μs';
    }
  }

  /* ============================================================
     03 — CIRCUIT LAB
     ============================================================ */
  const COL_W = 62;
  const COL_X0 = 52 + 31;
  const ROW_GAP = 62;
  const WIRE_TOP = 66;
  const TWO_QUBIT = new Set(['CNOT', 'CZ', 'SWAP']);
  const ROTATIONS = new Set(['Rx', 'Ry', 'Rz']);

  class CircuitLab {
    constructor() {
      this.n = 3;
      this.gates = [];
      this.time = 0;
      this.selectedGate = null;
      this.pending = null;
      this.currentPreset = 'ghz';
      this.activeTab = 'prob';
      this.playing = false;
      this.playTimer = null;
      this.lastState = Q.state(3);
      this.lastShots = null;
      this.rotateDegrees = 90;
      this.board = $('#circuit-board');
      this.sceneWrap = makeScene(window.Scenes && window.Scenes.StateBarsScene, '#state-canvas');
      this.scene = this.sceneWrap.scene;
      this.initSelects();
      this.bind();
      this.applyPreset('ghz', false);
    }

    initSelects() {
      const preset = $('#circuit-preset');
      if (preset) {
        if (!$('option[value="custom"]', preset)) {
          const option = document.createElement('option');
          option.value = 'custom';
          option.textContent = 'Özel devre';
          preset.appendChild(option);
        }
        preset.value = 'ghz';
      }
      const count = $('#qubit-count');
      if (count) count.value = String(this.n);
    }

    bind() {
      $$('[data-gate]').forEach((button) => {
        button.addEventListener('click', () => this.selectGate(button.dataset.gate));
      });

      const preset = $('#circuit-preset');
      if (preset) preset.addEventListener('change', () => {
        if (preset.value === 'custom') {
          this.currentPreset = 'custom';
          this.stopPlayback();
          this.rebuild();
          return;
        }
        this.applyPreset(preset.value, false);
      });

      const count = $('#qubit-count');
      if (count) count.addEventListener('change', () => {
        this.n = clamp(parseInt(count.value, 10) || 3, 2, 4);
        this.pending = null;
        this.stopPlayback();
        if (this.currentPreset === 'custom') {
          this.gates = this.gates.filter(g => g.qubit < this.n && (g.target == null || g.target < this.n));
          this.rebuild();
        } else {
          this.applyPreset(this.currentPreset, false);
        }
      });

      const angle = $('#rotation-angle');
      const angleValue = $('#rotation-angle-value');
      if (angle) angle.addEventListener('input', () => {
        this.rotateDegrees = parseInt(angle.value, 10) || 0;
        if (angleValue) angleValue.value = piFraction(this.rotateDegrees / 5, 36);
      });

      const range = $('#timeline-range');
      if (range) range.addEventListener('input', () => {
        this.stopPlayback();
        this.time = clamp(parseInt(range.value, 10) || 0, 0, this.cols());
        this.updateTimeline();
        this.updateState();
      });

      const play = $('#timeline-play');
      if (play) play.addEventListener('click', () => this.togglePlayback());

      const reset = $('#circuit-reset');
      if (reset) reset.addEventListener('click', () => {
        this.stopPlayback();
        this.selectedGate = null;
        this.pending = null;
        this.clearSelection();
        this.applyPreset('blank', false);
      });

      const copy = $('#qasm-copy');
      if (copy) copy.addEventListener('click', () => this.copyQasm());

      const shots = $('#shot-button');
      if (shots) shots.addEventListener('click', () => {
        this.setTab('shots');
        this.lastShots = Q.sample(this.lastState, this.n, 1024);
        this.renderInspector(true);
      });

      $$('[data-state-tab]').forEach((button) => {
        button.addEventListener('click', () => this.setTab(button.dataset.stateTab));
      });

      if (this.board) {
        this.board.addEventListener('click', (event) => {
          const cell = event.target.closest('.board-cell');
          if (cell) {
            this.cellClicked(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
            return;
          }
          const placed = event.target.closest('.placed-gate');
          if (placed) {
            const gate = this.gates.find(g => g._id === Number(placed.dataset.gateId));
            if (gate) this.removeGate(gate);
          }
        });
      }
    }

    cols() {
      if (!this.gates.length) return 0;
      return Math.max(...this.gates.map(g => g.col)) + 1;
    }

    selectedLabel() {
      return this.selectedGate || '—';
    }

    angleDisplay(degrees) {
      const reduced = degrees % 360;
      return piFraction(reduced / 5, 36);
    }

    selectGate(gate) {
      if (this.pending) this.pending = null;
      this.selectedGate = gate;
      this.stopPlayback();
      $$('.palette-gate').forEach((button) => {
        const selected = button.dataset.gate === gate;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      const palette = $('.gate-palette');
      setClass(palette, 'is-twoq', TWO_QUBIT.has(gate));
      const angleControl = $('#angle-control');
      setClass(angleControl, 'is-enabled', ROTATIONS.has(gate));
      const label = $('#selected-gate-label');
      let display = gate;
      if (ROTATIONS.has(gate)) display = gate + ' · ' + this.angleDisplay(this.rotateDegrees);
      if (TWO_QUBIT.has(gate)) display = gate + ' (iki kübit)';
      setText(label, display);
      const hint = $('#palette-hint-text');
      if (hint) {
        hint.textContent = TWO_QUBIT.has(gate)
          ? 'Kontrol kübitine, ardından aynı sütundaki hedef kübitine tıklayın.'
          : ROTATIONS.has(gate)
            ? 'Açıyı ayarlayın, ardından istediğiniz kübit hücresine tıklayın.'
            : 'Kapıyı yerleştirmek için bir kübit hücresine tıklayın.';
      }
      this.renderBoard();
    }

    clearSelection() {
      this.selectedGate = null;
      $$('.palette-gate').forEach((button) => {
        button.classList.remove('is-selected');
        button.setAttribute('aria-pressed', 'false');
      });
      setClass($('.gate-palette'), 'is-twoq', false);
      setClass($('#angle-control'), 'is-enabled', false);
      setText($('#selected-gate-label'), '—');
      const hint = $('#palette-hint-text');
      if (hint) hint.textContent = 'Bir kapı seçin. Tek kübit kapıları tek tıkla yerleşir.';
    }

    cellOccupant(row, col) {
      return this.gates.find(g => g.col === col && (g.qubit === row || g.target === row));
    }

    cellClicked(row, col) {
      const existing = this.cellOccupant(row, col);
      if (existing) {
        this.removeGate(existing);
        return;
      }
      if (!this.selectedGate) {
        toast('Önce paletten bir kapı seçin.');
        return;
      }
      if (TWO_QUBIT.has(this.selectedGate)) {
        if (this.pending && this.pending.col === col) {
          if (this.pending.row === row) {
            toast('Kontrol ve hedef farklı kübitler olmalı.');
            return;
          }
          const other = this.cellOccupant(row, col);
          if (other) {
            toast('Bu hedef hücresi dolu; önce mevcut kapıyı kaldırın.');
            return;
          }
          this.placeGate(this.selectedGate, this.pending.row, row, col);
          this.pending = null;
        } else {
          this.pending = { row, col };
          const hint = $('#palette-hint-text');
          if (hint) hint.textContent = 'Kontrol seçildi: q' + row + ' · aynı sütunda hedef kübitine tıklayın.';
          this.renderBoard();
        }
        return;
      }
      this.placeGate(this.selectedGate, row, null, col);
    }

    placeGate(gate, qubit, target, col) {
      this.stopPlayback();
      this.gates.push({
        _id: Date.now() + Math.random(),
        gate, qubit, target, col,
        param: ROTATIONS.has(gate) ? this.rotateDegrees * Math.PI / 180 : undefined
      });
      this.markCustom();
      this.currentPreset = 'custom';
      const preset = $('#circuit-preset');
      if (preset) preset.value = 'custom';
      this.rebuild();
    }

    removeGate(gate) {
      this.stopPlayback();
      this.gates = this.gates.filter(g => g !== gate);
      this.pending = null;
      this.markCustom();
      this.currentPreset = 'custom';
      const preset = $('#circuit-preset');
      if (preset) preset.value = 'custom';
      this.rebuild();
    }

    markCustom() {
      const name = $('#circuit-name');
      setText(name, 'Özel devre');
    }

    presetGates(name) {
      const n = this.n;
      const gates = [];
      let id = 1;
      const add = (gate, qubit, col, target, param) => {
        gates.push({ _id: id++, gate, qubit, target, col, param });
      };
      if (name === 'bell') {
        add('H', 0, 0);
        if (n >= 2) add('CNOT', 0, 1, 1);
      } else if (name === 'ghz') {
        add('H', 0, 0);
        for (let q = 1; q < n; q++) add('CNOT', 0, q, q);
      } else if (name === 'uniform') {
        for (let q = 0; q < n; q++) add('H', q, 0);
      } else if (name === 'grover2') {
        add('H', 0, 0);
        add('H', 1, 0);
        add('CZ', 0, 1, 1);
        add('H', 0, 2);
        add('H', 1, 2);
        add('X', 0, 3);
        add('X', 1, 3);
        add('CZ', 0, 4, 1);
        add('X', 0, 5);
        add('X', 1, 5);
        add('H', 0, 6);
        add('H', 1, 6);
      }
      return gates;
    }

    presetName(name) {
      const zeros = '0'.repeat(this.n);
      const ones = '1'.repeat(this.n);
      if (name === 'bell') return this.n === 2 ? 'Bell |Φ⁺⟩' : 'Bell |Φ⁺⟩ · q₀–q₁';
      if (name === 'ghz') return 'GHZ |' + zeros + '⟩ + |' + ones + '⟩';
      if (name === 'uniform') return 'Düzgün süperpozisyon · H^⊗' + this.n;
      if (name === 'grover2') return 'Grover / q₀–q₁ · hedef |11⟩';
      return 'Boş devre';
    }

    applyPreset(name, announce) {
      this.stopPlayback();
      this.currentPreset = name;
      this.gates = this.presetGates(name);
      this.pending = null;
      this.time = this.cols();
      const preset = $('#circuit-preset');
      if (preset) preset.value = name;
      const label = this.presetName(name);
      setText($('#circuit-name'), label);
      this.rebuild();
      if (announce) toast(label + ' yüklendi.');
    }

    rebuild() {
      const preset = $('#circuit-preset');
      if (preset) preset.value = this.currentPreset;
      this.time = this.cols();
      this.renderBoard();
      this.updateTimeline();
      this.updateState();
      setText($('#circuit-name'), this.currentPreset === 'custom' ? 'Özel devre' : this.presetName(this.currentPreset));
    }

    renderBoard() {
      const board = this.board;
      if (!board) return;
      board.innerHTML = '';
      const cols = this.cols();
      // Kullanıcı devrenin sonuna yeni kapı ekleyebilsin diye her zaman
      // bir boş "sonraki sütun" gösterilir.
      const displayCols = Math.max(cols + 1, 1);
      const width = Math.max(590, 52 + displayCols * COL_W + 26);
      board.style.minWidth = width + 'px';

      const head = document.createElement('div');
      head.className = 'board-col-labels';
      for (let c = 0; c < displayCols; c++) {
        const label = document.createElement('span');
        label.className = 'board-col-label';
        label.textContent = 't' + c;
        head.appendChild(label);
      }
      board.appendChild(head);

      for (let row = 0; row < this.n; row++) {
        const y = WIRE_TOP + row * ROW_GAP;
        const qLabel = document.createElement('div');
        qLabel.className = 'qubit-label';
        qLabel.style.top = y + 'px';
        qLabel.innerHTML = '<b>q' + row + '</b><small>|0⟩</small>';
        board.appendChild(qLabel);

        const wire = document.createElement('div');
        wire.className = 'wire';
        wire.style.top = y + 'px';
        board.appendChild(wire);

        for (let col = 0; col < displayCols; col++) {
          const occupant = this.cellOccupant(row, col);
          if (occupant) continue;
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'board-cell';
          if (this.pending && this.pending.row === row && this.pending.col === col) {
            cell.classList.add('is-pending-source');
          }
          cell.style.left = (COL_X0 + col * COL_W - 17.5) + 'px';
          cell.style.top = (y - 17.5) + 'px';
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.dataset.preview = this.selectedGate ? (TWO_QUBIT.has(this.selectedGate) ? '●' : this.selectedGate.replace('R', 'R')) : '+';
          cell.setAttribute('aria-label', 'q' + row + ', t' + col + ' boş hücre');
          board.appendChild(cell);
        }
      }

      this.gates.forEach((gate) => {
        const topRow = gate.target == null ? gate.qubit : Math.min(gate.qubit, gate.target);
        const bottomRow = gate.target == null ? gate.qubit : Math.max(gate.qubit, gate.target);
        const yTop = WIRE_TOP + topRow * ROW_GAP;
        const yBottom = WIRE_TOP + bottomRow * ROW_GAP;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'placed-gate';
        el.dataset.gateId = String(gate._id);
        el.dataset.col = String(gate.col);
        el.setAttribute('aria-label', gate.gate + ' kapısı, q' + gate.qubit + ', t' + gate.col + '; kaldırmak için tıkla');
        el.style.left = (COL_X0 + gate.col * COL_W - 17.5) + 'px';
        if (gate.target == null) {
          el.classList.add('gate-single');
          el.style.top = (yTop - 17.5) + 'px';
          if (/^[XYZ]$/.test(gate.gate)) el.classList.add('gate-' + gate.gate.toLowerCase());
          if (gate.gate === 'S' || gate.gate === 'T') el.classList.add('gate-' + gate.gate.toLowerCase());
          let symbol = gate.gate;
          if (ROTATIONS.has(gate.gate)) {
            symbol = 'R<sub>' + gate.gate.slice(1).toLowerCase() + '</sub>';
          }
          el.innerHTML = '<span class="gate-symbol">' + symbol + '</span>' +
            (ROTATIONS.has(gate.gate) ? '<span class="gate-angle">' + piFraction(Math.round(gate.param * 180 / Math.PI / 5), 36) + '</span>' : '');
        } else {
          el.classList.add('gate-twoq');
          if (gate.gate === 'CZ') el.classList.add('gate-cz');
          if (gate.gate === 'SWAP') el.classList.add('gate-swap');
          const up = gate.qubit > gate.target;
          if (up) el.classList.add('is-up');
          el.style.top = (yTop - 17.5) + 'px';
          el.style.height = (yBottom - yTop + 35) + 'px';
          const control = document.createElement('span');
          control.className = 'control-dot';
          const target = document.createElement('span');
          target.className = 'target-ring';
          target.innerHTML = '<span>' + (gate.gate === 'CNOT' ? '⊕' : gate.gate === 'CZ' ? 'Z' : '×') + '</span>';
          const link = document.createElement('span');
          link.className = 'gate-link';
          el.appendChild(control);
          el.appendChild(link);
          el.appendChild(target);
        }
        board.appendChild(el);
      });

      if (!this.gates.length) {
        const empty = document.createElement('div');
        empty.className = 'board-empty';
        empty.innerHTML = 'BOŞ DEVRE<br><b>Paletten bir kapı seçip hücreye tıklayın.</b>';
        board.appendChild(empty);
      }

      const cursor = document.createElement('div');
      cursor.className = 'time-cursor';
      cursor.style.left = (52 + this.time * COL_W) + 'px';
      board.appendChild(cursor);
      this.markTimelineGates();
    }

    markTimelineGates() {
      if (!this.board) return;
      $$('.placed-gate', this.board).forEach((el) => {
        const col = parseInt(el.dataset.col, 10);
        el.classList.toggle('is-future', col >= this.time);
        el.classList.toggle('is-current', col === this.time - 1);
      });
      const cursor = $('.time-cursor', this.board);
      if (cursor) cursor.style.left = (52 + this.time * COL_W) + 'px';
    }

    updateTimeline() {
      const cols = this.cols();
      this.time = clamp(this.time, 0, cols);
      const range = $('#timeline-range');
      if (range) {
        range.max = String(Math.max(cols, 0));
        range.value = String(this.time);
        range.disabled = cols === 0;
        range.setAttribute('aria-valuetext', this.time + ' / ' + cols + ' sütun uygulandı');
      }
      setText($('#timeline-label'), 't = ' + this.time + ' / ' + cols);
      const entangled = this.isEntangled();
      setText($('#timeline-phase'), this.time === 0 ? 'BAŞLANGIÇ' : entangled ? 'DOLANIK' : 'AYRIŞABİLİR');
      this.markTimelineGates();
    }

    isEntangled() {
      if (this.n < 2 || this.time === 0) return false;
      const state = Q.applyCircuit(Q.state(this.n), this.n, this.gates, this.time);
      for (let q = 0; q < this.n; q++) {
        const v = Q.blochVector(state, this.n, q);
        if (Math.hypot(v.x, v.y, v.z) < 0.9995) return true;
      }
      return false;
    }

    updateState() {
      const s = Q.applyCircuit(Q.state(this.n), this.n, this.gates, this.time);
      this.lastState = s;
      const size = 1 << this.n;
      setText($('#state-size'), '2' + superscript(this.n) + ' = ' + size + ' genlik');
      const ket = Q.ketExpression(s, this.n, 3);
      setText($('#state-ket'), ket);
      setText($('#state-norm'), Q.norm(s).toFixed(4));
      setText($('#circuit-status'), this.n + ' kübit · ' + this.gates.length + ' kapı · ' + this.cols() + ' sütun');
      setText($('#global-qstate-local'), this.n + ' kübit · canlı');
      setText($('#global-qstate'), this.n + ' kübit · ' + this.gates.length + ' kapı');
      if (this.scene) this.scene.setState(s, this.n);
      if (this.activeTab === 'shots') this.lastShots = Q.sample(s, this.n, 1024);
      this.renderInspector(false);
    }

    setTab(tab) {
      this.activeTab = tab === 'shots' ? 'shots' : 'prob';
      $$('[data-state-tab]').forEach((button) => {
        const on = button.dataset.stateTab === this.activeTab;
        button.classList.toggle('is-active', on);
        button.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (this.activeTab === 'shots') this.lastShots = Q.sample(this.lastState, this.n, 1024);
      this.renderInspector(true);
    }

    renderInspector(fromTab) {
      const container = $('#state-probs');
      if (!container) return;
      const s = this.lastState;
      const probs = Q.probabilities(s);
      const size = probs.length;
      container.innerHTML = '';
      if (this.activeTab === 'shots' && this.lastShots) {
        const total = this.lastShots.reduce((a, b) => a + b, 0);
        const indices = Array.from({ length: size }, (_, i) => i).sort((a, b) => this.lastShots[b] - this.lastShots[a]);
        indices.forEach((index) => {
          if (!this.lastShots[index]) return;
          const row = document.createElement('div');
          row.className = 'prob-row' + (this.lastShots[index] / total > 0.08 ? ' is-highlight' : '');
          row.innerHTML = '<span class="prob-state">' + Q.ketLabel(index, this.n) + '</span>' +
            '<span class="prob-track"><i style="width:' + (this.lastShots[index] / total * 100).toFixed(2) + '%"></i></span>' +
            '<span class="prob-value">' + this.lastShots[index] + '</span>' +
            '<span class="prob-phase" style="background:var(--violet);opacity:.6"></span>';
          container.appendChild(row);
        });
        if (!container.children.length) {
          container.innerHTML = '<div class="command-empty">Atış örneği yok.</div>';
        }
        return;
      }
      const order = Array.from({ length: size }, (_, i) => i).sort((a, b) => probs[b] - probs[a]);
      order.forEach((index) => {
        const amplitude = Q.amplitudes(s)[index];
        const phase = Math.atan2(amplitude.im, amplitude.re);
        const row = document.createElement('div');
        row.className = 'prob-row' + (probs[index] > 0.05 ? ' is-highlight' : '');
        const color = probs[index] > 1e-9 ? Q.phaseColor(phase) : 'rgba(155,140,255,.2)';
        row.innerHTML = '<span class="prob-state">' + Q.ketLabel(index, this.n) + '</span>' +
          '<span class="prob-track"><i style="width:' + (probs[index] * 100).toFixed(2) + '%"></i></span>' +
          '<span class="prob-value">' + pct(probs[index]) + '</span>' +
          '<span class="prob-phase" style="background:' + color + '"></span>';
        container.appendChild(row);
      });
      if (!fromTab && this.activeTab === 'shots' && !this.lastShots) {
        // Defensive: the shot tab always has a sample, but keep the panel readable.
      }
    }

    togglePlayback() {
      if (this.playing) {
        this.stopPlayback();
        return;
      }
      if (this.cols() === 0) {
        toast('Oynatmak için devreye kapı ekleyin.');
        return;
      }
      if (this.time >= this.cols()) {
        this.time = 0;
        this.updateTimeline();
        this.updateState();
      }
      this.playing = true;
      this.setPlayIcon(true);
      this.playTimer = setInterval(() => {
        if (this.time >= this.cols()) {
          this.stopPlayback();
          return;
        }
        this.time++;
        this.updateTimeline();
        this.updateState();
      }, 680);
    }

    stopPlayback() {
      if (this.playTimer) clearInterval(this.playTimer);
      this.playTimer = null;
      if (this.playing) {
        this.playing = false;
        this.setPlayIcon(false);
      }
    }

    setPlayIcon(playing) {
      const button = $('#timeline-play');
      if (!button) return;
      button.innerHTML = playing
        ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5l9 5.5-9 5.5z" fill="currentColor"/></svg>';
      button.setAttribute('aria-label', playing ? 'Zamanı duraklat' : 'Zamanı oynat');
    }

    async copyQasm() {
      const text = Q.qasm(this.gates, this.n);
      let copied = false;
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (error) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { copied = document.execCommand('copy'); } catch (err) { copied = false; }
        area.remove();
      }
      const button = $('#qasm-copy span');
      if (button) {
        const old = button.textContent;
        button.textContent = copied ? 'Kopyalandı' : 'Kopyalanamadı';
        setTimeout(() => { button.textContent = old; }, 1900);
      }
      toast(copied ? 'OpenQASM 2.0 panoya kopyalandı.' : 'Panoya erişilemedi; QASM konsolda görüntülenemiyor.');
      if (!copied) console.info('Q/LAB OpenQASM:\n' + text);
    }
  }

  /* ============================================================
     04 — GROVER
     ============================================================ */
  class GroverLab {
    constructor() {
      this.N = 8;
      this.target = 6;
      this.iterations = 0;
      this.optimal = Math.max(0, Math.round(Math.PI / (4 * Math.asin(1 / Math.sqrt(this.N))) - 0.5));
      this.barsBuilt = false;
      this.bind();
      this.update();
    }

    bind() {
      const target = $('#grover-target');
      if (target) target.addEventListener('change', () => {
        this.target = clamp(parseInt(target.value, 10) || 0, 0, this.N - 1);
        this.setIterations(0);
      });
      const range = $('#grover-iter');
      if (range) range.addEventListener('input', () => {
        this.setIterations(parseInt(range.value, 10) || 0);
      });
      const next = $('#grover-next');
      if (next) next.addEventListener('click', () => {
        this.stopPulse();
        this.setIterations(Math.min(6, this.iterations + 1));
      });
      const prev = $('#grover-prev');
      if (prev) prev.addEventListener('click', () => this.setIterations(Math.max(0, this.iterations - 1)));
      const reset = $('#grover-reset');
      if (reset) reset.addEventListener('click', () => this.setIterations(0));
    }

    stopPulse() {}

    stateFor(k) {
      const amps = new Float64Array(this.N).fill(1 / Math.sqrt(this.N));
      for (let step = 0; step < k; step++) {
        amps[this.target] = -amps[this.target];
        let sum = 0;
        for (let i = 0; i < this.N; i++) sum += amps[i];
        const mean = sum / this.N;
        for (let i = 0; i < this.N; i++) amps[i] = 2 * mean - amps[i];
      }
      return amps;
    }

    buildBars() {
      const container = $('#grover-bars');
      if (!container) return;
      container.innerHTML = '';
      for (let i = 0; i < this.N; i++) {
        const col = document.createElement('div');
        col.className = 'grover-bar-col';
        col.dataset.index = String(i);
        col.innerHTML = '<span class="grover-bar-value">0.00</span>' +
          '<span class="grover-bar-track"><i class="grover-bar positive"></i></span>' +
          '<span class="grover-bar-basis">' + Q.ketLabel(i, 3) + '</span>';
        container.appendChild(col);
      }
      this.barsBuilt = true;
      this.barEls = $$('.grover-bar-col', container);
    }

    setIterations(k) {
      this.iterations = clamp(k, 0, 6);
      const range = $('#grover-iter');
      if (range) range.value = String(this.iterations);
      setText($('#grover-iter-label'), String(this.iterations));
      this.update();
    }

    update() {
      if (!this.barsBuilt) this.buildBars();
      const amps = this.stateFor(this.iterations);
      const targetAmp = amps[this.target];
      const targetP = targetAmp * targetAmp;
      if (this.barEls) {
        this.barEls.forEach((col, i) => {
          const amp = amps[i];
          const bar = $('.grover-bar', col);
          const value = $('.grover-bar-value', col);
          const isTarget = i === this.target;
          col.classList.toggle('is-target', isTarget);
          if (bar) {
            bar.className = 'grover-bar ' + (amp >= 0 ? 'positive' : 'negative') + (isTarget ? ' is-target' : '');
            bar.style.height = (Math.abs(amp) * 50).toFixed(2) + '%';
          }
          if (value) {
            value.textContent = (amp >= 0 ? '+' : '−') + Math.abs(amp).toFixed(2);
            value.style.color = isTarget ? 'var(--mint)' : '';
          }
        });
      }
      setText($('#grover-prob'), pct(targetP));
      const phase = $('#grover-phase');
      if (phase) {
        phase.textContent = targetAmp < 0 ? '−' : '+';
        phase.style.color = targetAmp < 0 ? 'var(--orange)' : 'var(--mint)';
      }
      setText($('#grover-optimal'), String(this.optimal));
      const targetSelect = $('#grover-target');
      if (targetSelect) targetSelect.value = String(this.target);
    }
  }

  /* ============================================================
     05 — QFT PHASE WHEEL (2D locus, exact complex amplitudes)
     ============================================================ */
  class QFTLab {
    constructor() {
      this.canvas = $('#qft-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.input = 0;
      this.n = 3;
      this.N = 8;
      this.animStart = performance.now();
      this.running = false;
      this.raf = null;
      this.t0 = performance.now();
      this.bind();
      this.setInput(0, true);
    }

    bind() {
      $$('[data-qft-input]').forEach((button) => {
        button.addEventListener('click', () => this.setInput(parseInt(button.dataset.qftInput, 10)));
      });
    }

    setInput(k, silent) {
      this.input = clamp(k, 0, this.N - 1);
      $$('[data-qft-input]').forEach((button) => {
        const on = parseInt(button.dataset.qftInput, 10) === this.input;
        button.classList.toggle('is-active', on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      setText($('#qft-input-label'), Q.ketLabel(this.input, this.n));
      const increment = (2 * Math.PI * this.input / this.N) % (2 * Math.PI);
      const fraction = piFraction(this.input * 2, this.N);
      setText($('#qft-step'), this.input === 0 ? '0' : fraction);
      this.animStart = performance.now();
      if (!silent) this.draw(performance.now());
    }

    start() {
      if (this.running || !this.ctx) return;
      this.running = true;
      this.raf = requestAnimationFrame((now) => this.loop(now));
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    loop(now) {
      if (!this.running) return;
      this.draw(now);
      this.raf = requestAnimationFrame((next) => this.loop(next));
    }

    resize() {
      const canvas = this.canvas;
      if (!canvas) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w < 2 || h < 2) return false;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cssW = w;
      this.cssH = h;
      return true;
    }

    draw(now) {
      if (!this.ctx) return;
      if (!this.resize()) return;
      const ctx = this.ctx;
      const w = this.cssW, h = this.cssH;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2 + 12;
      const R = Math.min(w, h) * 0.285;
      const elapsed = reducedMotion ? 1 : clamp((now - this.animStart) / 900, 0, 1);
      const ease = 1 - Math.pow(1 - elapsed, 3);
      const time = (now - this.t0) / 1000;

      ctx.save();
      ctx.lineWidth = 1;

      // faint compass rings
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * (0.4 + ring * 0.2), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(114, 242, 197, ' + (0.055 - ring * 0.008) + ')';
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - R * 1.12, cy); ctx.lineTo(cx + R * 1.12, cy);
      ctx.moveTo(cx, cy - R * 1.12); ctx.lineTo(cx, cy + R * 1.12);
      ctx.strokeStyle = 'rgba(210, 234, 255, 0.07)';
      ctx.stroke();

      // rotating scan arc, a quiet indicator that the basis is live
      if (!reducedMotion && this.running) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.05, time * 0.32, time * 0.32 + 1.1);
        ctx.strokeStyle = 'rgba(114,242,197,.2)';
        ctx.stroke();
      }

      const base = -Math.PI / 2;
      const points = [];
      for (let j = 0; j < this.N; j++) {
        const phase = 2 * Math.PI * (j * this.input) / this.N;
        const angle = base + phase;
        const rad = R * (0.82 + 0.18 * ease);
        const x = cx + Math.cos(angle) * rad;
        const y = cy + Math.sin(angle) * rad;
        points.push({ j, phase, angle, x, y, re: Math.cos(phase) * (0.82 + 0.18 * ease), im: Math.sin(phase) * (0.82 + 0.18 * ease) });
      }

      // path in computational basis order
      ctx.beginPath();
      points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(155,140,255,.14)';
      ctx.stroke();

      // projections onto the real (mint) and imaginary (violet) axes
      points.forEach((p) => {
        const px = cx + Math.cos(p.angle) * R * 0.72;
        const py = cy + Math.sin(p.angle) * R * 0.72;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(cx + Math.cos(p.angle) * R * 0.72, p.y);
        ctx.strokeStyle = 'rgba(114,242,197,.11)';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(cx, cy + Math.sin(p.angle) * R * 0.72);
        ctx.strokeStyle = 'rgba(155,140,255,.11)';
        ctx.stroke();
      });

      // spokes + markers + basis labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      points.forEach((p) => {
        const color = Q.phaseColor(p.phase);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(p.angle) * R * 0.18, cy + Math.sin(p.angle) * R * 0.18);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(114,242,197,.28)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 9;
        ctx.fill();
        ctx.shadowBlur = 0;

        const labelR = R * 1.19 + 9;
        const lx = cx + Math.cos(p.angle) * labelR;
        const ly = cy + Math.sin(p.angle) * labelR;
        ctx.fillStyle = 'rgba(141,154,169,.9)';
        ctx.font = '8px "IBM Plex Mono", monospace';
        ctx.fillText(Q.ketLabel(p.j, this.n), lx, ly);
      });

      // center typography
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5,7,11,.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(114,242,197,.18)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(198,209,218,.85)';
      ctx.font = 'italic 13px "Newsreader", Georgia, serif';
      ctx.fillText('F₈|' + Q.basisLabel(this.input, this.n) + '⟩', cx, cy - 3);
      ctx.fillStyle = 'rgba(141,154,169,.65)';
      ctx.font = '7px "IBM Plex Mono", monospace';
      ctx.fillText('1/√8 · e^{iφⱼ}', cx, cy + 11);

      ctx.restore();
    }
  }

  /* ============================================================
     06 — DEUTSCH–JOZSA
     ============================================================ */
  class DeutschJozsaLab {
    constructor() {
      this.n = 3;
      this.total = 4;
      this.oracle = 'balanced';
      this.bind();
      this.renderZero();
    }

    bind() {
      $$('[data-dj-oracle]').forEach((button) => {
        button.addEventListener('click', () => {
          this.oracle = button.dataset.djOracle;
          $$('[data-dj-oracle]').forEach((other) => {
            other.classList.toggle('is-active', other === button);
            other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
          });
          const verdict = $('#dj-verdict');
          if (verdict) verdict.innerHTML = '<span class="mono">ORACLE HAZIR</span><p>' +
            (this.oracle === 'balanced' ? 'Dengeli f(x)=x₀ seçildi. Devreyi çalıştırarak faz geri tepmesini görün.' : 'Sabit f(x)=0 seçildi. Devreyi çalıştırın.') + '</p>';
        });
      });
      const run = $('#dj-run');
      if (run) run.addEventListener('click', () => this.run());
    }

    inputProbabilities() {
      const s = Q.state(this.total);
      for (let q = 0; q < this.n; q++) Q.applyGate(s, this.total, { gate: 'H', qubit: q });
      Q.applyGate(s, this.total, { gate: 'X', qubit: 3 });
      Q.applyGate(s, this.total, { gate: 'H', qubit: 3 });
      if (this.oracle === 'balanced') {
        Q.applyGate(s, this.total, { gate: 'CNOT', qubit: 0, target: 3 });
      }
      for (let q = 0; q < this.n; q++) Q.applyGate(s, this.total, { gate: 'H', qubit: q });
      const probs = Q.probabilities(s);
      const inputs = new Array(1 << this.n).fill(0);
      for (let i = 0; i < probs.length; i++) {
        inputs[i >> 1] += probs[i];
      }
      return inputs;
    }

    renderZero() {
      const hist = $('#dj-histogram');
      if (!hist) return;
      hist.innerHTML = '';
      for (let i = 0; i < (1 << this.n); i++) {
        const row = document.createElement('div');
        row.className = 'dj-bar';
        row.innerHTML = '<span>' + Q.ketLabel(i, this.n) + '</span><div><i style="width:0%"></i></div><b>0%</b>';
        hist.appendChild(row);
      }
    }

    renderHistogram(probs) {
      const hist = $('#dj-histogram');
      if (!hist) return;
      hist.innerHTML = '';
      for (let i = 0; i < probs.length; i++) {
        const p = probs[i] < 5e-5 ? 0 : probs[i];
        const row = document.createElement('div');
        row.className = 'dj-bar';
        row.innerHTML = '<span>' + Q.ketLabel(i, this.n) + '</span>' +
          '<div><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>' +
          '<b>' + pct(p, p > 0.995 ? 0 : 1) + '</b>';
        hist.appendChild(row);
      }
    }

    run() {
      const probs = this.inputProbabilities();
      let best = 0;
      for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
      const balanced = this.oracle === 'balanced';
      this.renderHistogram(probs);
      const verdict = $('#dj-verdict');
      if (verdict) {
        verdict.innerHTML = '<span class="mono">ÖLÇÜM · ' + (balanced ? 'DENGELİ' : 'SABİT') + ' FONKSİYON</span>' +
          '<h4>' + (balanced ? 'DENGELİ' : 'SABİT') + '</h4>' +
          '<p>Dominant çıktı ' + Q.ketLabel(best, this.n) + ' · p ≈ ' + pct(probs[best]) +
          '. Tek oracle sorgusu, ' + (1 << this.n) + ' girdilik fonksiyon sınıfını ayırt etti; klasik en kötü durum ' +
          ((1 << (this.n - 1)) + 1) + ' sorgu ister.</p>';
      }
    }
  }

  /* ============================================================
     07 — REPETITION CODE
     ============================================================ */
  class RepetitionLab {
    constructor() {
      this.bits = [0, 0, 0];
      this.bind();
      this.update();
    }

    bind() {
      $$('[data-rep-flip]').forEach((button) => {
        button.addEventListener('click', () => {
          const i = parseInt(button.dataset.repFlip, 10);
          this.bits[i] ^= 1;
          this.update();
          setText($('#rep-message'), this.message());
          const msg = $('#rep-message');
          if (msg) {
            msg.classList.remove('is-error', 'is-clean');
            msg.classList.add(this.errorCount() ? 'is-error' : 'is-clean');
          }
        });
      });
      const correct = $('#rep-correct');
      if (correct) correct.addEventListener('click', () => this.correct());
      const reset = $('#rep-reset');
      if (reset) reset.addEventListener('click', () => {
        this.bits = [0, 0, 0];
        this.update();
        const msg = $('#rep-message');
        if (msg) {
          msg.textContent = 'Hata yok. Sendromlar temiz.';
          msg.className = 'rep-message';
        }
      });
    }

    syndromes() {
      return [this.bits[0] ^ this.bits[1], this.bits[1] ^ this.bits[2]];
    }

    errorCount() {
      return this.bits.reduce((sum, b) => sum + (b ? 1 : 0), 0);
    }

    suggestedQubit() {
      const [s1, s2] = this.syndromes();
      if (s1 && s2) return 1;
      if (s1) return 0;
      if (s2) return 2;
      return -1;
    }

    message() {
      const [s1, s2] = this.syndromes();
      const count = this.errorCount();
      if (!count) return 'Hata yok. Sendromlar temiz.';
      if (count === 1) {
        return 'Sendrom ' + s1 + s2 + ': q' + this.suggestedQubit() + ' üzerinde X hatası. Tek hata düzeltilebilir.';
      }
      if (count === 2) {
        return 'İki hata var. Tek-hata kodu bunu güvenilir biçimde ayıramaz; düzeltme mantıksal hataya yol açabilir.';
      }
      return 'Üç hata: sendromlar 00 görünür. Tekrar kodu mantıksal hatayı tespit edemez.';
    }

    update() {
      $$('[data-rep-flip]').forEach((button) => {
        const i = parseInt(button.dataset.repFlip, 10);
        const bit = this.bits[i];
        button.classList.toggle('has-error', !!bit);
        button.setAttribute('aria-pressed', bit ? 'true' : 'false');
        button.setAttribute('aria-label', 'q' + i + ' şu anda ' + bit + '; X hatasını değiştir');
        setText($('b', button), String(bit));
      });
      const [s1, s2] = this.syndromes();
      setText($('#rep-s1'), String(s1));
      setText($('#rep-s2'), String(s2));
      const box1 = $('#rep-s1');
      const box2 = $('#rep-s2');
      if (box1) box1.parentElement.classList.toggle('is-active', !!s1);
      if (box2) box2.parentElement.classList.toggle('is-active', !!s2);
    }

    correct() {
      const count = this.errorCount();
      const msg = $('#rep-message');
      if (count === 0) {
        if (msg) {
          msg.textContent = 'Sendrom temiz; düzeltme gerekmez.';
          msg.className = 'rep-message is-clean';
        }
        return;
      }
      if (count === 3) {
        if (msg) {
          msg.textContent = 'Sendrom 00 görünüyor; dekoder düzeltme uygulamaz. Ancak üç hata mantıksal bir X hatasıdır.';
          msg.className = 'rep-message is-error';
        }
        return;
      }
      const q = this.suggestedQubit();
      const [s1, s2] = this.syndromes();
      this.bits[q] ^= 1;
      this.update();
      if (msg) {
        if (count === 1) {
          msg.textContent = 'Sendrom ' + s1 + s2 + ' → q' + q + ' düzeltildi. Sendromlar temiz, mantıksal bilgi korunuyor.';
          msg.className = 'rep-message is-clean';
        } else {
          msg.textContent = 'İki hata vardı; tek-hata varsayımı q' + q + ' çevirdi. Yeni sendrom 00 görünse de mantıksal hata oluştu.';
          msg.className = 'rep-message is-error';
        }
      }
    }
  }

  /* ============================================================
     08 — SURFACE CODE
     ============================================================ */
  class SurfaceLab {
    constructor() {
      this.log = [];
      this.seq = 0;
      const made = makeScene(window.Scenes && window.Scenes.SurfaceScene, '#surface-canvas', {
        onChange: (info) => this.changed(info)
      });
      this.scene = made.scene;
      this.bind();
      if (!this.scene) {
        setText($('#surface-syndrome-log'), 'WebGL başlatılamadı; yüzey kodu görselleştirmesi devre dışı.');
      }
    }

    bind() {
      $$('[data-qec-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          const mode = button.dataset.qecMode === 'Z' ? 'Z' : 'X';
          $$('[data-qec-mode]').forEach((other) => {
            other.classList.toggle('is-active', other === button);
            other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
          });
          if (this.scene) this.scene.setMode(mode);
          const hint = $('#surface-hint');
          if (hint) hint.textContent = 'kübite tıklayın → ' + mode + ' hatası ekle';
        });
      });
      const random = $('#surface-random');
      if (random) random.addEventListener('click', () => {
        if (this.scene) this.scene.addRandomError();
        else toast('Önce WebGL görselleştirmesini etkinleştirin.');
      });
      const decode = $('#surface-decode');
      if (decode) decode.addEventListener('click', () => {
        if (this.scene) this.scene.decode();
      });
      const clear = $('#surface-clear');
      if (clear) clear.addEventListener('click', () => {
        if (this.scene) this.scene.clearErrors();
      });
    }

    changed(info) {
      const total = info.totalErrors;
      const anyons = info.anyonCount;
      const residual = info.mode === 'X' ? info.residualX : info.residualZ;
      const maxModeErrors = Math.max(info.residualX, info.residualZ);
      setText($('#surface-error-count'), String(total));
      setText($('#surface-syndrome-count'), String(anyons));
      const logical = $('#surface-logical');
      let status = 'KORUNUYOR';
      let broken = false;
      let partial = false;
      if (info.decoded && total === 0) {
        status = 'DÜZELTİLDİ';
      } else if (info.decoded && residual > 0) {
        status = 'ARTIK HATA';
        broken = true;
      } else if (info.decoded && total > 0) {
        status = 'KISMİ';
        partial = true;
      } else if (maxModeErrors >= 3) {
        status = 'RİSKLİ';
        broken = true;
      }
      if (logical) {
        logical.textContent = status;
        logical.classList.toggle('is-broken', broken);
        logical.classList.toggle('is-partial', partial);
      }
      if (info.message) {
        const msg = $('#surface-msg');
        if (msg) msg.textContent = info.message;
        this.seq++;
        this.pushLog(this.seq + ' · ' + info.message, info.decoded && total === 0 ? 'log-mint' : (broken || anyons ? 'log-error' : ''));
      } else if (!this.log.length) {
        const msg = $('#surface-msg');
        if (msg && info.mode === 'Z') msg.textContent = 'Z hataları X-stabilizer plaquette’lerinde anyon üretir; X ile Z sendromları farklı yüzeylerde yaşar.';
      }
      if (!anyons && !total) {
        setText($('#surface-msg'), info.mode === 'X'
          ? 'Yüzeyin içindeki tek bir X hatası iki komşu Z anyonu üretir; sınır anyonu sınıra bağlanır. Dekoder anyonları en kısa yolla eşler.'
          : 'Z hataları X-stabilizer plaquette’lerinde anyon üretir. Hatasız yama temiz sendrom verir.');
      }
    }

    pushLog(line, cls) {
      this.log.unshift({ line, cls });
      this.log = this.log.slice(0, 4);
      const box = $('#surface-syndrome-log');
      if (!box) return;
      box.innerHTML = this.log.map(item =>
        '<span class="log-line ' + (item.cls || '') + '">' + item.line + '</span>'
      ).join('');
    }
  }

  /* ============================================================
     09 — THRESHOLD SCALING
     ============================================================ */
  class ThresholdLab {
    constructor() {
      this.pth = 0.008;
      this.A = 0.1;
      this.distances = [3, 5, 7];
      this.slider = $('#threshold-p');
      this.curves = {
        3: $('#curve-d3'),
        5: $('#curve-d5'),
        7: $('#curve-d7')
      };
      if (this.slider) this.slider.addEventListener('input', () => this.update());
      this.relabelTicks();
      this.update();
    }

    xOf(p) {
      return 44 + clamp(p / 0.02, 0, 1) * (408 - 44);
    }

    yOf(pL) {
      const v = clamp(pL, 1e-5, 1);
      return 24 + (-Math.log10(v) / 4) * (204 - 24);
    }

    pathFor(d) {
      const points = [];
      for (let i = 0; i <= 90; i++) {
        const p = 0.0002 + i / 90 * 0.0198;
        const pL = this.A * Math.pow(p / this.pth, (d + 1) / 2);
        points.push([this.xOf(p), this.yOf(pL)]);
      }
      return points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
    }

    relabelTicks() {
      const svg = $('#threshold-chart');
      if (!svg) return;
      $$('.chart-labels text', svg).forEach((text) => {
        if (text.textContent.trim() === '0.5%') text.setAttribute('x', this.xOf(0.005).toFixed(1));
        if (text.textContent.trim() === '1%') text.setAttribute('x', this.xOf(0.01).toFixed(1));
        if (text.textContent.trim() === '1.5%') text.setAttribute('x', this.xOf(0.015).toFixed(1));
      });
    }

    update() {
      const raw = this.slider ? parseFloat(this.slider.value) : 0.8;
      const p = raw / 100;
      const output = $('#threshold-p-value');
      if (output) output.value = raw.toFixed(2) + '%';
      this.distances.forEach((d) => {
        const curve = this.curves[d];
        if (curve) curve.setAttribute('d', this.pathFor(d));
      });
      const marker = $('#threshold-line');
      if (marker) {
        const x = this.xOf(p);
        marker.setAttribute('x1', x.toFixed(1));
        marker.setAttribute('x2', x.toFixed(1));
      }
      const pL5 = this.A * Math.pow(p / this.pth, 3);
      const readout = $('#threshold-logical');
      if (readout) readout.innerHTML = scientific(pL5) + ' <span style="font-size:7px;color:var(--muted-2)">(d=5)</span>';
      const state = $('.threshold-readout > span:last-child');
      if (state) {
        const atThreshold = Math.abs(p - this.pth) < 1e-9;
        const below = p < this.pth;
        state.textContent = atThreshold ? 'eşikte' : below ? 'eşik altı' : 'eşik üstü';
        state.style.color = atThreshold ? 'var(--gold)' : below ? 'var(--mint)' : 'var(--orange)';
      }
      const panel = $('.threshold-panel');
      if (panel) panel.dataset.p = p.toFixed(4);
    }
  }

  /* ============================================================
     LIFECYCLE
     ============================================================ */
  const labs = {};
  let initialized = false;
  let currentRoute = null;
  let webglAvailable = null;

  const routeScenes = {
    overview: 'hero',
    foundations: 'bloch',
    circuit: 'stateBars',
    algorithms: 'qft',
    hardware: 'cryostat',
    qec: 'surface',
    research: null
  };

  function init() {
    if (initialized) return window.Labs;
    initialized = true;

    // BlochLab must create the labelled Bloch scene itself. Create the other
    // WebGL scenes once, and reuse them across route transitions.
    labs.bloch = new BlochLab();
    labs.decoherence = new DecoherenceLab();
    labs.circuit = new CircuitLab();
    labs.grover = new GroverLab();
    labs.qft = new QFTLab();
    labs.dj = new DeutschJozsaLab();
    labs.rep = new RepetitionLab();
    labs.surfaceLab = new SurfaceLab();
    labs.threshold = new ThresholdLab();

    // Hero, cryostat and state inspector scenes.
    labs.heroScene = makeScene(window.Scenes && window.Scenes.HeroScene, '#hero-canvas').scene;
    labs.hero = labs.heroScene;
    labs.cryostat = makeScene(window.Scenes && window.Scenes.CryostatScene, '#cryostat-canvas').scene;

    // Herhangi bir WebGL sahnesi kurulabildiyse motor kullanılabilir sayılır;
    // bazı rotalar yalnızca Bloch veya yüzey kod sahnesini kullanır.
    webglAvailable = Boolean(
      labs.bloch.scene || labs.heroScene || labs.circuit.scene ||
      labs.cryostat || labs.surfaceLab.scene
    );

    return window.Labs;
  }

  function setRoute(route) {
    if (!initialized) init();
    currentRoute = route;
    const activeScene = routeScenes[route] || null;
    if (labs.heroScene) labs.heroScene.stop();
    if (labs.bloch && labs.bloch.scene) labs.bloch.scene.stop();
    if (labs.circuit && labs.circuit.scene) labs.circuit.scene.stop();
    if (labs.cryostat) labs.cryostat.stop();
    if (labs.surfaceLab && labs.surfaceLab.scene) labs.surfaceLab.scene.stop();
    if (labs.qft) labs.qft.stop();
    if (labs.circuit) labs.circuit.stopPlayback();

    if (route === 'overview' && labs.heroScene) labs.heroScene.start();
    if (route === 'foundations' && labs.bloch && labs.bloch.scene) labs.bloch.scene.start();
    if (route === 'circuit' && labs.circuit && labs.circuit.scene) labs.circuit.scene.start();
    if (route === 'hardware' && labs.cryostat) labs.cryostat.start();
    if (route === 'qec' && labs.surfaceLab && labs.surfaceLab.scene) labs.surfaceLab.scene.start();
    if (route === 'algorithms' && labs.qft) labs.qft.start();
    return activeScene;
  }

  // The public object is available before init so boot code can call it safely.
  window.Labs = {
    init,
    setRoute,
    labs,
    get webglAvailable() { return webglAvailable; },
    get currents() { return { route: currentRoute }; }
  };
})();
