(function () {
  function init() {
    if (!document.getElementById('calcOperation')) return;
    document.getElementById('calcOperation').addEventListener('change', renderFields);
    document.getElementById('calcRunBtn').addEventListener('click', compute);
    document.getElementById('calcCopyBtn').addEventListener('click', () => window.EngiCalc.copyText(document.getElementById('calcResult').innerText));
    renderFields();
  }

  function renderFields() {
    const op = document.getElementById('calcOperation').value;
    const container = document.getElementById('calcFields');
    const fields = {
      derivative: [
        { id: 'calcX', label: 'Point x', value: '1', step: 'any' },
        { id: 'calcH', label: 'Step size h', value: '1e-5', step: 'any' }
      ],
      integral: [
        { id: 'calcA', label: 'Lower limit a', value: '0', step: 'any' },
        { id: 'calcB', label: 'Upper limit b', value: '1', step: 'any' },
        { id: 'calcN', label: 'Intervals n (even)', value: '200', step: '2', min: '2' }
      ],
      limit: [
        { id: 'calcX0', label: 'Approach point x₀', value: '0', step: 'any' },
        { id: 'calcDir', label: 'Direction', type: 'select', options: [['both','Both sides'],['left','Left'],['right','Right']] },
        { id: 'calcStartH', label: 'Initial step h', value: '0.1', step: 'any' }
      ],
      solve: [
        { id: 'calcGuess', label: 'Initial guess x₀', value: '1', step: 'any' },
        { id: 'calcTol', label: 'Tolerance', value: '1e-7', step: 'any' },
        { id: 'calcMaxIter', label: 'Max iterations', value: '50', step: '1', min: '1' }
      ]
    }[op];
    container.innerHTML = fields.map(f => {
      if (f.type === 'select') {
        return `<label>${f.label}<select id="${f.id}">${f.options.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>`;
      }
      return `<label>${f.label}<input type="number" id="${f.id}" value="${f.value}" step="${f.step || 'any'}" ${f.min ? `min="${f.min}"` : ''}></label>`;
    }).join('');
  }

  function setError(msg) { document.getElementById('calcError').textContent = msg || ''; }
  function setResult(html) { document.getElementById('calcResult').innerHTML = html; }

  function compileFn(expr) {
    try {
      const node = math.parse(expr);
      const compiled = node.compile();
      return (x) => {
        const val = compiled.evaluate({ x, pi: math.pi, e: math.e });
        if (typeof val === 'number') return val;
        if (val && typeof val.toNumber === 'function') return val.toNumber();
        if (val && val.re !== undefined && Math.abs(val.im || 0) < 1e-12) return val.re;
        const num = Number(val);
        if (!Number.isFinite(num)) throw new Error('Function must evaluate to a real finite number for this x.');
        return num;
      };
    } catch (err) {
      throw new Error('Could not parse function f(x): ' + window.EngiCalc.friendlyMathError(err));
    }
  }

  function num(v, name) {
    const n = parseFloat(document.getElementById(v).value);
    if (Number.isNaN(n)) throw new Error(`Please enter a valid number for ${name}.`);
    return n;
  }

  function derivative(f, x, h) {
    if (!(h > 0)) throw new Error('Step size h must be greater than 0.');
    const d = (f(x + h) - f(x - h)) / (2 * h);
    if (!isFinite(d)) throw new Error('Derivative could not be computed (function may be undefined or discontinuous near this point).');
    return d;
  }

  function simpson(f, a, b, n) {
    if (n < 2) throw new Error('Number of intervals n must be at least 2.');
    if (n % 2 !== 0) n += 1;
    const h = (b - a) / n;
    let sum = f(a) + f(b);
    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      sum += (i % 2 === 0 ? 2 : 4) * f(x);
    }
    const result = sum * h / 3;
    if (!isFinite(result)) throw new Error('Integral could not be computed (function may be undefined or unbounded on the interval).');
    return { result, nUsed: n };
  }

  function limitEstimate(f, x0, dir, h0) {
    if (!(h0 > 0)) throw new Error('Initial step h must be greater than 0.');
    const seq = [];
    const evalSide = (sign) => {
      let h = h0;
      let prev = null;
      for (let i = 0; i < 12; i++) {
        const x = x0 + sign * h;
        const y = f(x);
        if (!isFinite(y)) return { value: NaN, seq };
        seq.push({ h, x, y });
        if (prev !== null && Math.abs(y - prev) < 1e-7 * Math.max(1, Math.abs(y))) return { value: y, seq };
        prev = y;
        h /= 10;
      }
      return { value: prev, seq };
    };
    if (dir === 'left') {
      const L = evalSide(-1);
      if (!isFinite(L.value)) throw new Error('Left-hand limit could not be estimated numerically.');
      return { value: L.value, note: 'Estimated from the left side by evaluating f(x₀ - h) with decreasing h.', seq };
    }
    if (dir === 'right') {
      const R = evalSide(1);
      if (!isFinite(R.value)) throw new Error('Right-hand limit could not be estimated numerically.');
      return { value: R.value, note: 'Estimated from the right side by evaluating f(x₀ + h) with decreasing h.', seq };
    }
    const left = evalSide(-1);
    const rightSeqStart = seq.length;
    let h = h0, prevR = null, rightVal = NaN;
    for (let i = 0; i < 12; i++) {
      const x = x0 + h;
      const y = f(x);
      if (!isFinite(y)) break;
      seq.push({ h, x, y, side: 'right' });
      if (prevR !== null && Math.abs(y - prevR) < 1e-7 * Math.max(1, Math.abs(y))) { rightVal = y; break; }
      prevR = y; rightVal = y; h /= 10;
    }
    if (!isFinite(left.value) || !isFinite(rightVal)) throw new Error('Two-sided limit could not be estimated numerically from both sides.');
    const diff = Math.abs(left.value - rightVal);
    const agree = diff < 1e-5 * Math.max(1, Math.abs(rightVal));
    return {
      value: (left.value + rightVal) / 2,
      left: left.value,
      right: rightVal,
      agree,
      note: agree
        ? 'Estimated from both sides; left and right approximations agree within tolerance.'
        : 'Left and right approximations differ significantly; the two-sided limit may not exist.',
      seq
    };
  }

  function solveEquation(f, x0, tol, maxIter) {
    if (!(tol > 0)) throw new Error('Tolerance must be greater than 0.');
    if (maxIter < 1) throw new Error('Max iterations must be at least 1.');
    let x = x0;
    let used = 'Newton-Raphson';
    for (let i = 1; i <= maxIter; i++) {
      const fx = f(x);
      if (!isFinite(fx)) throw new Error('Function evaluation failed during solving. Try a different initial guess.');
      if (Math.abs(fx) < tol) return { root: x, iterations: i - 1, method: used, residual: fx };
      const h = Math.max(1e-6, Math.abs(x) * 1e-6);
      const dfx = (f(x + h) - f(x - h)) / (2 * h);
      if (!isFinite(dfx) || Math.abs(dfx) < 1e-12) { used = 'Bisection-like secant fallback unavailable at this step'; break; }
      const x1 = x - fx / dfx;
      if (!isFinite(x1)) throw new Error('Newton step diverged. Try a different initial guess.');
      if (Math.abs(x1 - x) < tol) return { root: x1, iterations: i, method: used, residual: f(x1) };
      x = x1;
    }
    // Fallback: secant scan around guess
    used = 'Secant method (fallback)';
    let xPrev = x0 - 1;
    let xCurr = x0;
    let fPrev = f(xPrev), fCurr = f(xCurr);
    for (let i = 1; i <= maxIter; i++) {
      if (Math.abs(fCurr) < tol) return { root: xCurr, iterations: i, method: used, residual: fCurr };
      const denom = (fCurr - fPrev);
      if (Math.abs(denom) < 1e-14) throw new Error('Could not converge to a root. Try a different initial guess or check that the function crosses zero.');
      const xNext = xCurr - fCurr * (xCurr - xPrev) / denom;
      if (!isFinite(xNext)) throw new Error('Solver diverged. Try a different initial guess.');
      if (Math.abs(xNext - xCurr) < tol) return { root: xNext, iterations: i, method: used, residual: f(xNext) };
      xPrev = xCurr; fPrev = fCurr; xCurr = xNext; fCurr = f(xCurr);
    }
    throw new Error('No root found within the maximum iterations. Try a different initial guess, tolerance, or function.');
  }

  function compute() {
    setError('');
    try {
      const op = document.getElementById('calcOperation').value;
      const expr = document.getElementById('calcFunction').value.trim();
      if (!expr) throw new Error('Please enter a function f(x).');
      const f = compileFn(expr);
      let html = '';
      let historyExpr = '';
      let historyResult = '';
      if (op === 'derivative') {
        const x = num('calcX', 'point x');
        const h = num('calcH', 'step size h');
        const d = derivative(f, x, h);
        historyExpr = `d/dx (${expr}) at x=${x}, h=${h}`;
        historyResult = window.EngiCalc.formatNumber(d);
        html = `<div class="result-line"><strong>Approximate derivative</strong></div>
          <pre>f(x) = ${expr}\nf'(${window.EngiCalc.formatNumber(x)}) ≈ ${historyResult}</pre>
          <div class="result-line"><strong>Method</strong></div>
          <pre>Central difference: f'(x) ≈ (f(x+h) - f(x-h)) / (2h)\nSubstituted: (f(${window.EngiCalc.formatNumber(x+h)}) - f(${window.EngiCalc.formatNumber(x-h)})) / (2×${window.EngiCalc.formatNumber(h)})</pre>
          <div class="result-line"><strong>Note</strong></div>
          <pre>This is a numerical approximation. Accuracy depends on h and function smoothness near x.</pre>`;
      } else if (op === 'integral') {
        const a = num('calcA', 'lower limit a');
        const b = num('calcB', 'upper limit b');
        let n = parseInt(document.getElementById('calcN').value, 10);
        if (Number.isNaN(n)) throw new Error('Please enter a valid integer for intervals n.');
        if (n % 2 !== 0) n += 1;
        const { result, nUsed } = simpson(f, a, b, n);
        historyExpr = `∫[${a}, ${b}] (${expr}) dx, n=${nUsed}`;
        historyResult = window.EngiCalc.formatNumber(result);
        html = `<div class="result-line"><strong>Approximate definite integral</strong></div>
          <pre>∫ from ${window.EngiCalc.formatNumber(a)} to ${window.EngiCalc.formatNumber(b)} of (${expr}) dx ≈ ${historyResult}</pre>
          <div class="result-line"><strong>Method</strong></div>
          <pre>Simpson's rule with n = ${nUsed} even intervals\nh = (b-a)/n = ${window.EngiCalc.formatNumber((b-a)/nUsed)}</pre>
          <div class="result-line"><strong>Note</strong></div>
          <pre>This is a numerical approximation. Accuracy improves with larger n for smooth functions, but singularities or discontinuities can reduce accuracy.</pre>`;
      } else if (op === 'limit') {
        const x0 = num('calcX0', 'approach point x₀');
        const dir = document.getElementById('calcDir').value;
        const h0 = num('calcStartH', 'initial step h');
        const lim = limitEstimate(f, x0, dir, h0);
        historyExpr = `lim x→${x0}${dir==='left'?'-':dir==='right'?'+':''} (${expr})`;
        historyResult = window.EngiCalc.formatNumber(lim.value);
        let extra = '';
        if (dir === 'both') {
          extra = `Left estimate:  ${window.EngiCalc.formatNumber(lim.left)}\nRight estimate: ${window.EngiCalc.formatNumber(lim.right)}\nAgreement: ${lim.agree ? 'yes (within tolerance)' : 'no (values differ)'}`;
        }
        html = `<div class="result-line"><strong>Estimated limit</strong></div>
          <pre>${historyExpr} ≈ ${historyResult}\n${extra}</pre>
          <div class="result-line"><strong>Method</strong></div>
          <pre>${lim.note}\nInitial step h = ${window.EngiCalc.formatNumber(h0)}, reduced by factors of 10.</pre>
          <div class="result-line"><strong>Note</strong></div>
          <pre>This is a numerical estimate, not a symbolic proof. Oscillatory, discontinuous, or undefined behavior may make the estimate unreliable.</pre>`;
      } else if (op === 'solve') {
        const guess = num('calcGuess', 'initial guess x₀');
        const tol = num('calcTol', 'tolerance');
        const maxIter = parseInt(document.getElementById('calcMaxIter').value, 10);
        const sol = solveEquation(f, guess, tol, maxIter);
        historyExpr = `Solve ${expr} = 0, x₀=${guess}`;
        historyResult = `x ≈ ${window.EngiCalc.formatNumber(sol.root)}`;
        html = `<div class="result-line"><strong>Numerical root estimate</strong></div>
          <pre>${expr} = 0\nx ≈ ${window.EngiCalc.formatNumber(sol.root)}\nf(x) ≈ ${window.EngiCalc.formatNumber(sol.residual)}</pre>
          <div class="result-line"><strong>Method</strong></div>
          <pre>${sol.method}\nInitial guess: ${window.EngiCalc.formatNumber(guess)}\nIterations: ${sol.iterations}\nTolerance: ${window.EngiCalc.formatNumber(tol)}</pre>
          <div class="result-line"><strong>Note</strong></div>
          <pre>This is a numerical approximation. Different initial guesses may find different roots or fail to converge.</pre>`;
      }
      setResult(html);
      window.HistoryStore.addEntry({
        module: 'Calculus',
        moduleId: 'calculus',
        expression: historyExpr,
        result: historyResult,
        payload: gatherPayload()
      });
    } catch (err) {
      setResult('');
      setError(window.EngiCalc.friendlyMathError(err));
    }
  }

  function gatherPayload() {
    const op = document.getElementById('calcOperation').value;
    const payload = { op, expr: document.getElementById('calcFunction').value };
    const ids = ['calcX','calcH','calcA','calcB','calcN','calcX0','calcDir','calcStartH','calcGuess','calcTol','calcMaxIter'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) payload[id] = el.value; });
    return payload;
  }

  function reuse(payload) {
    if (!payload) return;
    if (payload.op) document.getElementById('calcOperation').value = payload.op;
    renderFields();
    if (payload.expr != null) document.getElementById('calcFunction').value = payload.expr;
    Object.keys(payload).forEach(k => {
      const el = document.getElementById(k);
      if (el && k !== 'op' && k !== 'expr') el.value = payload[k];
    });
  }

  window.CalculusModule = { init, reuse };
})();