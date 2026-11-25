(function () {
  const THEME_KEY = 'engiCalcTheme';
  const WELCOME_KEY = 'engiCalcWelcomeSeen';

  function init() {
    initTheme();
    initNavigation();
    initWelcomeAndHelp();
    initModules();
    initHistoryControls();
    initModuleSearch();
    initBrandHome();
    window.HistoryStore.renderHistory();
  }

  function $(id) { return document.getElementById(id); }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  async function copyText(text) {
    const value = String(text ?? '').trim();
    if (!value || value === '—') {
      showToast('Nothing to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      showToast('Copied to clipboard.');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied to clipboard.');
      } catch {
        showToast('Copy failed. You can select and copy manually.');
      }
    }
  }

  function formatNumber(value, precision = 12) {
    if (value == null) return '';
    try {
      if (math.isMatrix && math.isMatrix(value)) {
        return matrixToString(value.valueOf());
      }
      if (Array.isArray(value)) return matrixToString(value);
      if (math.isComplex && math.isComplex(value)) return formatComplex(value);
      if (math.isFraction && math.isFraction(value)) return math.format(value, { fraction: 'ratio' });
      if (math.isBigNumber && math.isBigNumber(value)) {
        return math.format(value, { precision, lowerExp: -9, upperExp: 9 });
      }
      if (typeof value === 'number') {
        if (!isFinite(value)) return String(value);
        if (Object.is(value, -0)) value = 0;
        const abs = Math.abs(value);
        if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
          return Number(value).toExponential(9).replace(/(?:\.0+|(\.\d*?[1-9]))0+e/, '$1e');
        }
        const rounded = Number.parseFloat(Number(value).toPrecision(12));
        return String(rounded);
      }
      if (math.isUnit && math.isUnit(value)) {
        return math.format(value, { precision });
      }
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      return math.format(value, { precision });
    } catch {
      return String(value);
    }
  }

  function formatComplex(c, angleUnit = 'deg') {
    const re = Number(c.re);
    const im = Number(c.im);
    const reStr = formatNumber(re);
    const imAbs = formatNumber(Math.abs(im));
    let rect;
    if (Math.abs(im) < 1e-12) rect = reStr;
    else if (Math.abs(re) < 1e-12) rect = (im < 0 ? '-' : '') + imAbs + 'i';
    else rect = reStr + (im >= 0 ? ' + ' : ' - ') + imAbs + 'i';
    const mod = math.sqrt(re * re + im * im);
    const argRad = math.atan2(im, re);
    const arg = angleUnit === 'deg' ? argRad * 180 / Math.PI : argRad;
    return {
      rectangular: rect,
      polar: `${formatNumber(mod)} ∠ ${formatNumber(arg)} ${angleUnit === 'deg' ? '°' : 'rad'}`,
      modulus: formatNumber(mod),
      argument: `${formatNumber(arg)} ${angleUnit === 'deg' ? '°' : 'rad'}`,
      re: reStr,
      im: formatNumber(im)
    };
  }

  function matrixToString(matrix) {
    if (!Array.isArray(matrix)) return formatNumber(matrix);
    if (matrix.length === 0) return '[]';
    if (!Array.isArray(matrix[0])) {
      return '[ ' + matrix.map(v => formatNumber(v)).join(', ') + ' ]';
    }
    const rows = matrix.map(row => '[ ' + row.map(v => formatNumber(v)).join(',\t') + ' ]');
    return rows.join('\n');
  }

  function friendlyMathError(err) {
    const msg = (err && err.message) ? err.message : String(err);
    if (/Undefined symbol/i.test(msg)) return msg + '. Check function names and use x as the variable where required.';
    if (/Unexpected end of expression/i.test(msg)) return 'The expression is incomplete. Check for missing values, operators, or closing parentheses.';
    if (/Parenthesis/i.test(msg)) return 'Parentheses are not balanced. Please check your expression.';
    if (/Value expected/i.test(msg)) return 'A value or operand is missing. Please check your expression.';
    return msg;
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    $('themeToggle').addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark');
      applyTheme(isDark ? 'light' : 'dark');
    });
  }

  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.body.classList.toggle('dark', dark);
    const btn = $('themeToggle');
    btn.textContent = dark ? 'Light mode' : 'Dark mode';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    if (window.GraphingModule && typeof window.GraphingModule.onThemeChange === 'function') {
      window.GraphingModule.onThemeChange();
    }
  }

  function initNavigation() {
    const buttons = Array.from(document.querySelectorAll('.nav-btn[data-module]'));
    const sidebar = $('sidebar');
    const overlay = $('sidebarOverlay');
    const menuToggle = $('menuToggle');

    function openSidebar(open) {
      sidebar.classList.toggle('open', open);
      overlay.hidden = !open;
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    }

    menuToggle.addEventListener('click', () => openSidebar(!sidebar.classList.contains('open')));
    overlay.addEventListener('click', () => openSidebar(false));

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const moduleId = btn.getAttribute('data-module');
        showModule(moduleId);
        openSidebar(false);
      });
    });
  }

  function showModule(moduleId) {
    document.querySelectorAll('.nav-btn[data-module]').forEach(b => b.classList.toggle('active', b.getAttribute('data-module') === moduleId));
    document.querySelectorAll('.module-panel').forEach(p => p.classList.toggle('active', p.id === 'module-' + moduleId));
    const main = $('mainContent');
    if (main) main.focus({ preventScroll: true });
  }

  function initWelcomeAndHelp() {
    const welcomeModal = $('welcomeModal');
    const helpModal = $('helpModal');
    const startBtn = $('welcomeStartBtn');
    const helpBtn = $('helpBtn');
    const helpClose = $('helpCloseBtn');
    const helpDone = $('helpDoneBtn');
    let lastFocus = null;

    function openModal(modal) {
      lastFocus = document.activeElement;
      modal.hidden = false;
      const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
      document.body.style.overflow = 'hidden';
    }
    function closeModal(modal) {
      modal.hidden = true;
      document.body.style.overflow = '';
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    if (!localStorage.getItem(WELCOME_KEY)) {
      openModal(welcomeModal);
    }

    startBtn.addEventListener('click', () => {
      localStorage.setItem(WELCOME_KEY, 'true');
      closeModal(welcomeModal);
    });

    helpBtn.addEventListener('click', () => openModal(helpModal));
    helpClose.addEventListener('click', () => closeModal(helpModal));
    helpDone.addEventListener('click', () => closeModal(helpModal));

    [welcomeModal, helpModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal && modal === helpModal) closeModal(helpModal);
      });
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden && modal === helpModal) {
          e.preventDefault();
          closeModal(helpModal);
        }
        if (e.key === 'Escape' && !modal.hidden && modal === welcomeModal) {
          // allow dismiss via keyboard too
          e.preventDefault();
          localStorage.setItem(WELCOME_KEY, 'true');
          closeModal(welcomeModal);
        }
      });
    });
  }

  function initModules() {
    if (window.ScientificModule) window.ScientificModule.init();
    if (window.ComplexModule) window.ComplexModule.init();
    if (window.MatricesModule) window.MatricesModule.init();
    if (window.CalculusModule) window.CalculusModule.init();
    if (window.QuadraticModule) window.QuadraticModule.init();
    if (window.GraphingModule) window.GraphingModule.init();
    if (window.ElectricalModule) window.ElectricalModule.init();
    if (window.ConversionsModule) window.ConversionsModule.init();
    if (window.BinaryModule) window.BinaryModule.init();
  }

  function initHistoryControls() {
    const clearBtn = $('historyClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all saved calculation history?')) {
          window.HistoryStore.clearHistory();
          showToast('History cleared.');
        }
      });
    }
  }

  function initModuleSearch() {
    const search = $('moduleSearch');
    if (!search) return;
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      document.querySelectorAll('.nav-btn[data-module]').forEach((btn) => {
        const text = btn.textContent.toLowerCase();
        const match = !q || text.includes(q);
        btn.closest('li').style.display = match ? '' : 'none';
      });
    });
  }

  function initBrandHome() {
    const btn = $('brandHomeBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      showModule('scientific');
      const search = $('moduleSearch');
      if (search) { search.value = ''; search.dispatchEvent(new Event('input')); }
    });
  }

  function reuseHistoryEntry(entry) {
    if (!entry || !entry.moduleId) return;
    showModule(entry.moduleId);
    const map = {
      scientific: window.ScientificModule,
      complex: window.ComplexModule,
      matrices: window.MatricesModule,
      calculus: window.CalculusModule,
      quadratic: window.QuadraticModule,
      graphing: window.GraphingModule,
      electrical: window.ElectricalModule,
      conversions: window.ConversionsModule,
      binary: window.BinaryModule
    };
    const mod = map[entry.moduleId];
    if (mod && typeof mod.reuse === 'function') {
      mod.reuse(entry.payload || {});
      showToast('Calculation loaded from history.');
    } else {
      showToast('This history item cannot be reused automatically.');
    }
  }

  window.EngiCalc = {
    formatNumber,
    formatComplex,
    matrixToString,
    friendlyMathError,
    copyText,
    showToast,
    reuseHistoryEntry,
    showModule
  };

  document.addEventListener('DOMContentLoaded', init);
})();