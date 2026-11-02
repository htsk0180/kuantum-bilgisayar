/* ============================================================
   Q/LAB — application shell
   Hash routing, module progress, command palette, mobile nav,
   reveal choreography and local progress export.
   Zero dependencies.
   ============================================================ */
(function () {
  'use strict';

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const setText = (element, text) => { if (element) element.textContent = text; };

  const STORAGE_KEY = 'qlab.progress.v1';
  const MODULES = [
    {
      id: 'overview', index: '00', label: 'Genel Bakış', crumb: 'GENEL BAKIŞ',
      description: 'Oryantasyon · izlence haritası · hızlı başlangıç',
      keywords: 'giris baslangic overview laboratuvar izlence roadmap'
    },
    {
      id: 'foundations', index: '01', label: 'Temeller', crumb: 'TEMELLER',
      description: 'Postülatlar · Bloch · ölçüm · dolanıklık',
      keywords: 'temel formalizm durum vektoru olcum dekohres dolaniklik bell chsh bloch'
    },
    {
      id: 'circuit', index: '02', label: 'Devre Laboratuvarı', crumb: 'DEVRE LABORATUVARI',
      description: 'Kapılar · simülasyon · QASM · atışlar',
      keywords: 'devre kapi circuit qasm cnot hadamard simulasyon atis'
    },
    {
      id: 'algorithms', index: '03', label: 'Algoritmalar', crumb: 'ALGORİTMALAR',
      description: 'Grover · Fourier · Deutsch–Jozsa · VQE',
      keywords: 'algoritma grover qft fourier dj deutsch jozsa hizlanma vqe qaoa shor'
    },
    {
      id: 'hardware', index: '04', label: 'Donanım', crumb: 'DONANIM',
      description: 'QPU · soğutucu · kontrol yığını',
      keywords: 'donanim hardware qpu transmon iyon foton kriyostat sogutucu kontrol fpga'
    },
    {
      id: 'qec', index: '05', label: 'Hata Düzeltme', crumb: 'HATA DÜZELTME',
      description: 'Sendrom · yüzey kodu · eşik',
      keywords: 'hata duzeltme qec sendrom yuzey kodu surface stabilizer anyon esik threshold'
    },
    {
      id: 'research', index: '06', label: 'Araştırma Ufku', crumb: 'ARAŞTIRMA UFKU',
      description: 'Açık problemler · okuma listesi · tez',
      keywords: 'arastirma research acik problem tez kaynak okuma qldpc bqp qma benchmark'
    }
  ];
  const MODULE_BY_ID = new Map(MODULES.map((module) => [module.id, module]));
  const TOTAL = MODULES.length;

  const COMMANDS = [
    ...MODULES.map((module) => ({
      title: module.label, subtitle: module.description, target: module.id,
      type: 'MODÜL', index: module.index, keywords: module.keywords
    })),
    {
      title: 'Postülatlar', subtitle: 'Durum · evrim · ölçüm · bileşim', target: 'foundations-postulates',
      type: 'KAVRAM', index: '01', keywords: 'postulat born hilbert unitar olcum povm c2'
    },
    {
      title: 'Bloch küresi', subtitle: 'Tek kübit geometrisi · interaktif laboratuvar', target: 'bloch-lab',
      type: 'LAB', index: '01', keywords: 'bloch kure qubit kapi olcum yogunluk matrisi'
    },
    {
      title: 'Dekoherans & T₂', subtitle: 'T₁/T₂ koherens zarfı · Kraus kanalları', target: 'foundations-measurement',
      type: 'KAVRAM', index: '01', keywords: 't1 t2 dekohres koherens kraus amplitude damping faz'
    },
    {
      title: 'Bell durumu & CHSH', subtitle: 'Dolanıklık · kısmi iz · Bell eşitsizliği', target: 'foundations-entanglement',
      type: 'KAVRAM', index: '01', keywords: 'bell chsh dolanik entanglement entropi kismi iz'
    },
    {
      title: 'Problem seti / 01', subtitle: 'Temeller · türetme ve sayısal alıştırmalar', target: 'foundations-problems',
      type: 'ÇALIŞMA', index: '01', keywords: 'soru problem alistirma odev temel'
    },
    {
      title: 'Devre editörü', subtitle: 'Kapı yerleştir · zamanı sar · QASM üret', target: 'circuit-lab',
      type: 'LAB', index: '02', keywords: 'devre editor kapi qasm atis timeline simulator'
    },
    {
      title: 'Grover stüdyosu', subtitle: 'Amplitude amplification · N = 8', target: 'grover-studio',
      type: 'LAB', index: '03', keywords: 'grover arama oracle difuzyon amplitude amplification'
    },
    {
      title: 'QFT faz çarkı', subtitle: 'Fourier dönüşümü · faz → konum', target: 'qft-studio',
      type: 'LAB', index: '03', keywords: 'qft fourier faz frekans donusum period'
    },
    {
      title: 'Deutsch–Jozsa', subtitle: 'Tek oracle sorgusu · faz geri tepmesi', target: 'dj-studio',
      type: 'LAB', index: '03', keywords: 'deutsch jozsa oracle dengeli sabit faz kickback'
    },
    {
      title: 'Hızlanma haritası', subtitle: 'Grover · Shor · QFT · VQE karşılaştırması', target: 'quantum-advantage',
      type: 'KAVRAM', index: '03', keywords: 'hizlanma avantaj bqp shor vqe qaoa hhl tablo'
    },
    {
      title: 'Seyreltme soğutucusu', subtitle: '20 mK · QPU ve kontrol katmanları', target: 'cryostat-lab',
      type: 'LAB', index: '04', keywords: 'kriyostat sogutucu dilution 20mk qpu kablo kontrol'
    },
    {
      title: 'Tekrar kodu', subtitle: 'Üç kübit · sendrom ve düzeltme', target: 'repetition-lab',
      type: 'LAB', index: '05', keywords: 'tekrar kodu repetition sendrom bit flip duzeltme'
    },
    {
      title: 'Yüzey kodu', subtitle: 'd = 5 şematik yama · anyon · dekoder', target: 'surface-lab',
      type: 'LAB', index: '05', keywords: 'yuzey kodu surface anyon dekoder stabilizer d5'
    },
    {
      title: 'Eşik ölçeklemesi', subtitle: 'p_L ~ (p/p_th)^((d+1)/2) · d = 3,5,7', target: 'threshold-lab',
      type: 'LAB', index: '05', keywords: 'esik threshold scaling mantiksal hata d3 d5 d7'
    },
    {
      title: 'Okuma kütüphanesi', subtitle: 'Nielsen & Chuang · Preskill · birincil makaleler', target: 'reading-list',
      type: 'KAYNAK', index: '06', keywords: 'kaynak okuma kitap makale nielsen chuang preskill qldpc'
    },
    {
      title: 'Stabilizer formalizmi', subtitle: 'Kod uzayı · Pauli grubu · sendrom', target: 'qec',
      type: 'KAVRAM', index: '05', keywords: 'stabilizer pauli kod uzayi sendrom'
    },
    {
      title: 'Anyon & mantıksal hata', subtitle: 'Topolojik koruma · d/2 + 1 zinciri', target: 'surface-lab',
      type: 'KAVRAM', index: '05', keywords: 'anyon mantiksal hata topolojik koruma zincir'
    },
    {
      title: 'Transmon & kübit platformları', subtitle: 'Süperiletken · iyon · atom · foton · spin', target: 'hardware',
      type: 'KAVRAM', index: '04', keywords: 'transmon iyon atom fotonik spin topolojik platform'
    },
    {
      title: 'BQP · QMA · QV', subtitle: 'Karmaşıklık ve benchmark okuma rehberi', target: 'research',
      type: 'KAVRAM', index: '06', keywords: 'bqp qma qv benchmark karmasiklik xeb gst rb'
    },
    {
      title: 'qLDPC & gerçek zamanlı dekoder', subtitle: 'Açık problemler · araştırma ufku', target: 'reading-list',
      type: 'KAVRAM', index: '06', keywords: 'qldpc dekoder real time mwpm arastirma'
    },
    {
      title: 'Nielsen & Chuang', subtitle: 'QCQI · postülatlar, devreler, QEC', target: 'reading-list',
      type: 'KAYNAK', index: 'K', keywords: 'nielsen chuang qcqi kitap temel'
    }
  ];

  const views = new Map($$('.view[data-view]').map((view) => [view.dataset.view, view]));
  const navItems = $$('#module-nav .nav-item');
  const reducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const scrollLocks = new Set();
  let currentRoute = null;
  let currentAnchor = null;
  let visited = loadProgress();
  let labsReady = false;
  let toastTimer = null;
  let sidebarOpen = false;
  let commandIsOpen = false;
  let commandSelected = 0;
  let commandResults = [];
  let commandLastFocus = null;
  let commandCloseTimer = null;
  let scrollSpyFrame = null;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* ============================================================
     Boot
     ============================================================ */
  function boot() {
    document.documentElement.classList.add('js');
    bindInterface();
    initReveals();
    initLabs();
    const initial = parseLocation();
    const route = initial && initial.route ? initial.route : 'overview';
    const anchor = initial && initial.anchor ? initial.anchor : null;
    const canonical = '#' + (anchor || route);
    if (location.hash !== canonical) {
      try { history.replaceState(null, '', canonical); } catch (error) { /* file:// is fine */ }
    }
    applyRoute(route, anchor, { initial: true, force: true });
    window.addEventListener('hashchange', handleLocation);
    window.addEventListener('resize', syncSidebarForViewport, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    if (initial && initial.missing) {
      showToast('Bölüm bulunamadı; genel bakışa dönüldü.');
    }
  }

  function initLabs() {
    if (!window.Labs) {
      showToast('Laboratuvar çekirdeği yüklenemedi.');
      return;
    }
    try {
      window.Labs.init();
      labsReady = true;
      if (window.Labs.webglAvailable === false) {
        document.documentElement.classList.add('no-webgl');
        showToast('WebGL başlatılamadı; laboratuvarlar sınırlı görünümde çalışıyor.');
      }
    } catch (error) {
      console.error('Q/LAB init error:', error);
      showToast('Laboratuvar başlatılırken bir hata oluştu.');
    }
  }

  function handleVisibility() {
    if (!labsReady || !currentRoute) return;
    if (document.hidden) {
      window.Labs.setRoute('__paused__');
    } else {
      window.Labs.setRoute(currentRoute);
    }
  }

  /* ============================================================
     Routing
     ============================================================ */
  function parseLocation() {
    let raw = location.hash ? location.hash.slice(1) : '';
    try { raw = decodeURIComponent(raw); } catch (error) { /* keep raw */ }
    if (!raw) return { route: 'overview', anchor: null, canonical: '#overview' };
    if (raw === 'main') return { special: 'main' };
    if (MODULE_BY_ID.has(raw)) return { route: raw, anchor: null, canonical: '#' + raw };
    const element = document.getElementById(raw);
    if (!element) return { route: 'overview', anchor: null, missing: raw };
    const view = element.closest('.view');
    if (!view) return { route: 'overview', anchor: null, missing: raw };
    const route = view.dataset.view;
    if (!MODULE_BY_ID.has(route)) return { route: 'overview', anchor: null };
    return { route, anchor: raw === route ? null : raw, canonical: '#' + raw };
  }

  function handleLocation() {
    const next = parseLocation();
    if (!next || next.special === 'main') return;
    if (next.missing) {
      try { history.replaceState(null, '', '#overview'); } catch (error) { /* ignore */ }
    }
    applyRoute(next.route, next.anchor, { fromHash: true });
  }

  function applyRoute(route, anchor, options) {
    options = options || {};
    if (!MODULE_BY_ID.has(route)) route = 'overview';
    const sameRoute = route === currentRoute && !options.force;
    const view = views.get(route);
    if (!view) return;

    currentRoute = route;
    currentAnchor = anchor || null;

    if (!sameRoute) {
      $$('.view.is-active').forEach((active) => active.classList.remove('is-active'));
      view.classList.add('is-active');
      closeSidebar(false);
    }

    if (!sameRoute) {
      markVisited(route);
    }
    updateChrome(route);
    updateProgress();

    if (!sameRoute && labsReady) {
      try {
        window.Labs.setRoute(route);
      } catch (error) {
        console.error('Q/LAB route scene error:', error);
      }
    }

    if (anchor) {
      scrollToTarget(anchor, !sameRoute || options.initial);
    } else if (!sameRoute || options.initial) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      requestAnimationFrame(updateSectionSpy);
    } else {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
      requestAnimationFrame(updateSectionSpy);
    }

    requestAnimationFrame(() => {
      updateSectionSpy();
      if (commandIsOpen) closeCommand(false);
    });
  }

  function navigateToId(id) {
    if (!id) return;
    const next = parseId(id);
    if (!next) return;
    closeSidebar(false);
    if (next.special === 'main') {
      const main = $('#main');
      if (main) {
        main.focus({ preventScroll: true });
        main.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
      return;
    }
    const hash = '#' + (next.anchor || next.route);
    if (location.hash === hash) {
      applyRoute(next.route, next.anchor, {});
    } else {
      location.hash = hash.slice(1);
    }
  }

  function parseId(id) {
    if (!id) return null;
    const clean = String(id).replace(/^#/, '');
    if (!clean) return null;
    if (clean === 'main') return { special: 'main' };
    if (MODULE_BY_ID.has(clean)) return { route: clean, anchor: null };
    const element = document.getElementById(clean);
    if (!element) return null;
    const view = element.closest('.view');
    if (!view) return null;
    const route = view.dataset.view;
    if (!MODULE_BY_ID.has(route)) return null;
    return { route, anchor: clean };
  }

  function scrollToTarget(id, immediate) {
    const target = document.getElementById(id);
    if (!target) return;
    const topbar = $('.topbar');
    const offset = (topbar ? topbar.getBoundingClientRect().height : 0) + 18;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({
      top,
      behavior: immediate || reducedMotion ? 'instant' : 'smooth'
    });
    requestAnimationFrame(updateSectionSpy);
  }

  function updateChrome(route) {
    const module = MODULE_BY_ID.get(route) || MODULE_BY_ID.get('overview');
    setText($('#current-crumb'), module.crumb);
    document.title = 'Q/LAB — ' + module.label;
    navItems.forEach((item) => {
      const active = item.dataset.route === route;
      item.classList.toggle('is-active', active);
      item.classList.toggle('is-visited', visited.has(item.dataset.route));
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function updateSectionSpy() {
    if (!currentRoute) return;
    const view = views.get(currentRoute);
    if (!view) return;
    const links = $$('.segmented-nav a, .algo-map-item', view);
    if (!links.length) return;
    const items = links.map((link) => {
      const href = link.getAttribute('href') || '';
      const id = href.charAt(0) === '#' ? href.slice(1) : '';
      const element = id ? document.getElementById(id) : null;
      return element && element.closest('.view') === view ? { link, element } : null;
    }).filter(Boolean);
    if (!items.length) return;
    const line = window.scrollY + 145;
    let active = items[0];
    items.forEach((item) => {
      if (item.element.getBoundingClientRect().top + window.scrollY <= line) active = item;
    });
    items.forEach((item) => {
      const on = item === active;
      const cssClass = item.link.classList.contains('algo-map-item') ? 'is-active' : 'is-current';
      item.link.classList.toggle(cssClass, on);
    });
  }

  /* ============================================================
     Progress
     ============================================================ */
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.visited) ? parsed.visited : []);
      return new Set(list.filter((id) => MODULE_BY_ID.has(id)));
    } catch (error) {
      return new Set();
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        visited: Array.from(visited),
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      // Private browsing / storage disabled: the session still works.
    }
  }

  function markVisited(route) {
    if (!MODULE_BY_ID.has(route) || visited.has(route)) return;
    visited.add(route);
    saveProgress();
  }

  function updateProgress() {
    const count = visited.size;
    const percent = TOTAL ? (count / TOTAL) * 100 : 0;
    const rounded = Math.round(percent);
    $$('[data-progress-ring]').forEach((ring) => ring.style.setProperty('--p', percent.toFixed(2)));
    $$('[data-progress-pct]').forEach((element) => setText(element, rounded + '%'));
    $$('[data-progress-count]').forEach((element) => setText(element, String(count)));
    $$('[data-progress-fill]').forEach((element) => { element.style.width = percent.toFixed(2) + '%'; });
    navItems.forEach((item) => item.classList.toggle('is-visited', visited.has(item.dataset.route)));
  }

  function resetProgress() {
    const confirmed = window.confirm('Bu tarayıcıdaki modül ilerlemesi sıfırlanacak. Devam edilsin mi?');
    if (!confirmed) return;
    visited = new Set();
    saveProgress();
    if (currentRoute) {
      visited.add(currentRoute);
      saveProgress();
    }
    updateProgress();
    updateChrome(currentRoute);
    showToast('İlerleme sıfırlandı. Mevcut modül başlangıç noktanız.');
  }

  function exportProgress() {
    const rows = MODULES.map((module) => ({
      id: module.id,
      index: module.index,
      title: module.label,
      visited: visited.has(module.id)
    }));
    const payload = {
      app: 'Q/LAB',
      kernel: '0.9.4',
      exportedAt: new Date().toISOString(),
      progress: {
        visited: visited.size,
        total: TOTAL,
        percent: Math.round((visited.size / TOTAL) * 100)
      },
      modules: rows
    };
    const text = JSON.stringify(payload, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = 'qlab-ilerleme-' + stamp + '.json';
    let url = '';
    let objectUrl = false;
    try {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      url = URL.createObjectURL(blob);
      objectUrl = true;
    } catch (error) {
      url = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(url), 1200);
    showToast('İlerleme dışa aktarıldı: ' + fileName);
  }

  /* ============================================================
     Reveal choreography
     ============================================================ */
  function initReveals() {
    const elements = $$('.reveal');
    if (!('IntersectionObserver' in window) || reducedMotion) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -6% 0px' });
    elements.forEach((element) => observer.observe(element));
  }

  /* ============================================================
     UI bindings
     ============================================================ */
  function bindInterface() {
    const menuButton = $('#menu-open');
    const sidebar = $('#sidebar');
    if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
    if (sidebar) {
      const close = $('#sidebar-close');
      const scrim = $('#sidebar-scrim');
      if (menuButton) menuButton.addEventListener('click', () => setSidebar(!sidebarOpen, true));
      if (close) close.addEventListener('click', () => setSidebar(false, true));
      if (scrim) scrim.addEventListener('click', () => setSidebar(false, true));
      sidebar.addEventListener('click', (event) => {
        const navLink = event.target.closest('.nav-item');
        if (!navLink) return;
        if (navLink.dataset.route === currentRoute && location.hash === '#' + currentRoute) {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        }
        setSidebar(false, false);
      });
    }

    const help = $('.progress-help');
    if (help) help.addEventListener('click', () => showToast(help.dataset.tooltip || 'İlerleme bu tarayıcıda saklanır.'));

    const searchButtons = [$('#search-open'), $('#search-open-top')];
    searchButtons.forEach((button) => {
      if (button) button.addEventListener('click', () => openCommand());
    });

    const reset = $('#reset-progress');
    if (reset) reset.addEventListener('click', resetProgress);
    const exporter = $('#export-notes');
    if (exporter) exporter.addEventListener('click', exportProgress);

    $$('[data-scroll-to]').forEach((button) => {
      button.addEventListener('click', () => navigateToId(button.dataset.scrollTo));
    });

    document.addEventListener('click', (event) => {
      const special = event.target.closest('a[data-anchor]');
      if (!special) return;
      event.preventDefault();
      navigateToId(special.dataset.anchor);
    });

    document.addEventListener('qlab:toast', (event) => {
      if (event.detail) showToast(String(event.detail));
    });

    bindCommandPalette();
    bindGlobalKeys();
    window.addEventListener('scroll', () => {
      if (scrollSpyFrame) return;
      scrollSpyFrame = requestAnimationFrame(() => {
        scrollSpyFrame = null;
        updateSectionSpy();
      });
    }, { passive: true });

    syncSidebarForViewport();
  }

  function bindGlobalKeys() {
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        if (commandIsOpen) closeCommand(true);
        else openCommand();
        return;
      }
      if (event.key === 'Escape') {
        if (commandIsOpen) {
          event.preventDefault();
          closeCommand(true);
          return;
        }
        if (sidebarOpen) {
          event.preventDefault();
          setSidebar(false, true);
          return;
        }
      }
      if (commandIsOpen) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          selectCommand(commandSelected + 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          selectCommand(commandSelected - 1);
        } else if (event.key === 'Enter') {
          // Palet açıkken odak arama alanındadır; Enter yine de seçili
          // sonucu çalıştırmalıdır.
          event.preventDefault();
          activateCommand(commandSelected);
        } else if (event.key === 'Tab') {
          trapCommandFocus(event);
        }
      }
    });
  }

  function setScrollLock(key, locked) {
    if (locked) scrollLocks.add(key);
    else scrollLocks.delete(key);
    document.body.classList.toggle('is-locked', scrollLocks.size > 0);
  }

  function setSidebar(open, restoreFocus) {
    const sidebar = $('#sidebar');
    const scrim = $('#sidebar-scrim');
    const menuButton = $('#menu-open');
    if (!sidebar) return;
    const wasOpen = sidebarOpen;
    sidebarOpen = !!open;
    sidebar.classList.toggle('is-open', sidebarOpen);
    if (scrim) scrim.classList.toggle('is-open', sidebarOpen);
    if (menuButton) menuButton.setAttribute('aria-expanded', sidebarOpen ? 'true' : 'false');
    sidebar.inert = !sidebarOpen && window.matchMedia('(max-width: 940px)').matches;
    setScrollLock('sidebar', sidebarOpen && window.matchMedia('(max-width: 940px)').matches);
    if (sidebarOpen) {
      // Odak, animasyon karesini beklemeden taşınmalı: rAF bazı tarayıcı
      // durumlarında gecikebilir ve klavye kullanıcısı menüde kalakalır.
      const close = $('#sidebar-close');
      if (close) close.focus({ preventScroll: true });
    } else if (wasOpen && restoreFocus !== false && menuButton) {
      menuButton.focus({ preventScroll: true });
    }
  }

  function closeSidebar(restoreFocus) {
    if (!sidebarOpen) {
      syncSidebarForViewport();
      return;
    }
    setSidebar(false, restoreFocus);
  }

  function syncSidebarForViewport() {
    const sidebar = $('#sidebar');
    if (!sidebar) return;
    const mobile = window.matchMedia('(max-width: 940px)').matches;
    if (!mobile && sidebarOpen) setSidebar(false, false);
    sidebar.inert = mobile && !sidebarOpen;
    setScrollLock('sidebar', mobile && sidebarOpen);
  }

  /* ============================================================
     Command palette
     ============================================================ */
  function bindCommandPalette() {
    const overlay = $('#command-overlay');
    const input = $('#command-input');
    const results = $('#command-results');
    if (!overlay || !input || !results) return;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'command-results');
    results.setAttribute('role', 'listbox');
    input.addEventListener('input', () => renderCommands(input.value));
    results.addEventListener('click', (event) => {
      const button = event.target.closest('.command-result');
      if (!button) return;
      activateCommand(Number(button.dataset.index));
    });
    results.addEventListener('mousemove', (event) => {
      const button = event.target.closest('.command-result');
      if (!button) return;
      const index = Number(button.dataset.index);
      if (index !== commandSelected) selectCommand(index, false);
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeCommand(true);
    });
  }

  function openCommand() {
    const overlay = $('#command-overlay');
    const input = $('#command-input');
    if (!overlay || !input || commandIsOpen) return;
    if (sidebarOpen) closeSidebar(false);
    if (commandCloseTimer) {
      clearTimeout(commandCloseTimer);
      commandCloseTimer = null;
    }
    commandLastFocus = document.activeElement;
    commandIsOpen = true;
    overlay.hidden = false;
    renderCommands('');
    setScrollLock('command', true);
    $$('#search-open, #search-open-top').forEach((button) => button.setAttribute('aria-expanded', 'true'));
    // Görünürlük sınıfı hemen eklenir; odak rAF gecikmesine bırakılmaz.
    void overlay.offsetWidth;
    overlay.classList.add('is-open');
    input.value = '';
    input.focus({ preventScroll: true });
  }

  function closeCommand(restoreFocus) {
    const overlay = $('#command-overlay');
    const input = $('#command-input');
    if (!overlay || !commandIsOpen) return;
    commandIsOpen = false;
    if (commandCloseTimer) {
      clearTimeout(commandCloseTimer);
      commandCloseTimer = null;
    }
    overlay.classList.remove('is-open');
    setScrollLock('command', false);
    $$('#search-open, #search-open-top').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    if (input) input.setAttribute('aria-activedescendant', '');
    if (restoreFocus && commandLastFocus && commandLastFocus.focus) {
      try { commandLastFocus.focus({ preventScroll: true }); } catch (error) { commandLastFocus.focus(); }
    }
    commandCloseTimer = setTimeout(() => {
      overlay.hidden = true;
      commandCloseTimer = null;
    }, reducedMotion ? 0 : 230);
  }

  function fold(value) {
    return String(value || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function renderCommands(query) {
    const results = $('#command-results');
    if (!results) return;
    const tokens = fold(query).trim().split(/\s+/).filter(Boolean);
    const filtered = COMMANDS.filter((item) => {
      if (!tokens.length) return true;
      const haystack = fold([item.title, item.subtitle, item.type, item.keywords].join(' '));
      return tokens.every((token) => haystack.indexOf(token) !== -1);
    });
    commandResults = filtered.slice(0, 12);
    commandSelected = commandResults.length ? 0 : -1;
    results.innerHTML = '';
    if (!commandResults.length) {
      const empty = document.createElement('div');
      empty.className = 'command-empty';
      empty.textContent = 'Eşleşen modül, laboratuvar veya kavram bulunamadı.';
      results.appendChild(empty);
      const input = $('#command-input');
      if (input) input.setAttribute('aria-activedescendant', '');
      return;
    }
    commandResults.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'command-result' + (index === 0 ? ' is-selected' : '');
      button.id = 'command-result-' + index;
      button.dataset.index = String(index);
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');

      const number = document.createElement('span');
      number.className = 'command-result-index';
      number.textContent = item.index;
      const copy = document.createElement('span');
      copy.className = 'command-result-copy';
      const title = document.createElement('b');
      title.textContent = item.title;
      const subtitle = document.createElement('small');
      subtitle.textContent = item.subtitle;
      copy.appendChild(title);
      copy.appendChild(subtitle);
      const type = document.createElement('span');
      type.className = 'command-result-type';
      type.textContent = item.type;

      button.appendChild(number);
      button.appendChild(copy);
      button.appendChild(type);
      results.appendChild(button);
    });
    selectCommand(0, false);
  }

  function selectCommand(index, scroll) {
    if (!commandResults.length) return;
    commandSelected = (index + commandResults.length) % commandResults.length;
    $$('.command-result').forEach((button, i) => {
      const selected = i === commandSelected;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected && scroll !== false) button.scrollIntoView({ block: 'nearest' });
    });
    const input = $('#command-input');
    if (input) input.setAttribute('aria-activedescendant', 'command-result-' + commandSelected);
  }

  function activateCommand(index) {
    const item = commandResults[index];
    if (!item) return;
    closeCommand(false);
    navigateToId(item.target);
    // Palet klavye odağını gizli panelde bırakmasın; yeni içerik odağı devralsın.
    const main = $('#main');
    if (main) main.focus({ preventScroll: true });
  }

  function trapCommandFocus(event) {
    const dialog = $('.command-dialog');
    if (!dialog) return;
    const focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', dialog)
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ============================================================
     Toast
     ============================================================ */
  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = String(message);
    toast.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      toastTimer = null;
    }, 3600);
  }
})();
