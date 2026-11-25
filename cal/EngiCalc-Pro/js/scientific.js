(function () {
  let angleMode = 'deg';
  let lastAnswer = '0';

  function init() {
    const expr = document.getElementById('sciExpression');
    const evalBtn = document.getElementById('sciEvalBtn');
    const clearBtn = document.getElementById('sciClearBtn');
    const deleteBtn = document.getElementById('sciDeleteBtn');
    const copyBtn = document.getElementById('sciCopyBtn');
    const keypad = document.getElementById('sciKeypad');
    const degBtn = document.getElementById('degModeBtn');
    const radBtn = document.getElementById('radModeBtn');
    if (!expr) return;

    evalBtn.addEventListener('click', evaluate);
    clearBtn.addEventListener('click', clearAll);
    deleteBtn.addEventListener('click', deleteChar);
    copyBtn.addEventListener('click', () => window.EngiCalc.copyText(document.getElementById('sciResult').textContent));

    degBtn.addEventListener('click', () => setAngleMode('deg'));
    radBtn.addEventListener('click', () => setAngleMode('rad'));

    keypad.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const insert = btn.getAttribute('data-insert');
      const action = btn.getAttribute('data-action');
      if (insert != null) {
        insertText(insert);
      } else if (action === 'equals') {
        evaluate();
      } else if (action === 'ans') {
        insertText(lastAnswer);
      } else if (action === 'fraction') {
        convertToFraction();
      } else if (action === 'clear') {
        clearAll();
      } else if (action === 'backspace') {
        deleteChar();
      }
    });

    expr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        evaluate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        clearAll();
      }
    });

    setAngleMode('deg');
    clearError();
  }

  function setAngleMode(mode) {
    angleMode = mode;
    document.getElementById('degModeBtn').classList.toggle('active', mode === 'deg');
    document.getElementById('radModeBtn').classList.toggle('active', mode === 'rad');
    document.getElementById('degModeBtn').setAttribute('aria-pressed', mode === 'deg');
    document.getElementById('radModeBtn').setAttribute('aria-pressed', mode === 'rad');
  }

  function insertText(text) {
    const expr = document.getElementById('sciExpression');
    const start = expr.selectionStart ?? expr.value.length;
    const end = expr.selectionEnd ?? expr.value.length;
    expr.value = expr.value.slice(0, start) + text + expr.value.slice(end);
    const pos = start + text.length;
    expr.focus();
    expr.setSelectionRange(pos, pos);
  }

  function deleteChar() {
    const expr = document.getElementById('sciExpression');
    const start = expr.selectionStart ?? expr.value.length;
    const end = expr.selectionEnd ?? expr.value.length;
    if (start !== end) {
      expr.value = expr.value.slice(0, start) + expr.value.slice(end);
      expr.setSelectionRange(start, start);
    } else if (start > 0) {
      expr.value = expr.value.slice(0, start - 1) + expr.value.slice(end);
      expr.setSelectionRange(start - 1, start - 1);
    }
    expr.focus();
  }

  function clearAll() {
    document.getElementById('sciExpression').value = '';
    document.getElementById('sciResult').textContent = '0';
    clearError();
  }

  function showError(msg) {
    const el = document.getElementById('sciError');
    if (el) el.textContent = msg;
  }
  function clearError() { showError(''); }

  function preprocessExpression(raw) {
    // Convert postfix percentages like 50% or (5+5)% to division by 100.
    // Applied repeatedly to handle simple chained cases.
    let expr = raw;
    let prev;
    do {
      prev = expr;
      expr = expr.replace(/(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\))%/g, '($1/100)');
    } while (expr !== prev);
    return expr;
  }

  function buildScope() {
    const toRad = (x) => math.multiply(x, math.pi / 180);
    const toDeg = (x) => math.multiply(x, 180 / math.pi);
    const scope = {
      pi: math.pi,
      e: math.e,
      ln: (x) => math.log(x),
      log: (x, base) => (base === undefined ? math.log10(x) : math.log(x, base))
    };
    if (angleMode === 'deg') {
      scope.sin = (x) => math.sin(toRad(x));
      scope.cos = (x) => math.cos(toRad(x));
      scope.tan = (x) => math.tan(toRad(x));
      scope.asin = (x) => toDeg(math.asin(x));
      scope.acos = (x) => toDeg(math.acos(x));
      scope.atan = (x) => toDeg(math.atan(x));
    } else {
      scope.sin = math.sin;
      scope.cos = math.cos;
      scope.tan = math.tan;
      scope.asin = math.asin;
      scope.acos = math.acos;
      scope.atan = math.atan;
    }
    return scope;
  }

  function evaluate() {
    clearError();
    const exprEl = document.getElementById('sciExpression');
    const raw = exprEl.value.trim();
    if (!raw) {
      showError('Please enter an expression to evaluate.');
      return;
    }
    try {
      const prepared = preprocessExpression(raw);
      const value = math.evaluate(prepared, buildScope());
      if (value === undefined || value === null) throw new Error('No result produced.');
      if (typeof value === 'function') throw new Error('Expression did not produce a numeric result.');
      const formatted = window.EngiCalc.formatNumber(value);
      document.getElementById('sciResult').textContent = formatted;
      lastAnswer = String(formatted);
      window.HistoryStore.addEntry({
        module: 'Scientific Calculator',
        moduleId: 'scientific',
        expression: raw + (angleMode === 'deg' ? ' [deg]' : ' [rad]'),
        result: formatted,
        payload: { expression: raw, angleMode }
      });
    } catch (err) {
      document.getElementById('sciResult').textContent = '—';
      showError(window.EngiCalc.friendlyMathError(err));
    }
  }

  function convertToFraction() {
    clearError();
    const current = document.getElementById('sciResult').textContent;
    try {
      const val = math.evaluate(current, {});
      if (typeof val !== 'number' || !isFinite(val)) {
        showError('Fraction display is available for finite real numeric results only.');
        return;
      }
      const frac = math.fraction(val);
      document.getElementById('sciResult').textContent = math.format(frac, { fraction: 'ratio' });
    } catch (err) {
      showError('Could not convert result to a fraction: ' + window.EngiCalc.friendlyMathError(err));
    }
  }

  function reuse(payload) {
    if (!payload) return;
    document.getElementById('sciExpression').value = payload.expression || '';
    setAngleMode(payload.angleMode || 'deg');
    clearError();
  }

  window.ScientificModule = { init, reuse };
})();