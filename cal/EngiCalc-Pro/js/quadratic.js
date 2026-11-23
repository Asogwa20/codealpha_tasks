(function () {
  function init() {
    if (!document.getElementById('quadSolveBtn')) return;
    document.getElementById('quadSolveBtn').addEventListener('click', solve);
    document.getElementById('quadClearBtn').addEventListener('click', clearAll);
    document.getElementById('quadCopyBtn').addEventListener('click', () => window.EngiCalc.copyText(document.getElementById('quadResult').innerText));
    const ex = document.getElementById('quadExample');
    if (ex) ex.addEventListener('change', applyExample);
  }

  function val(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const raw = String(el.value).trim();
    if (raw === '') return NaN;
    return Number(raw);
  }

  function setError(msg) {
    const el = document.getElementById('quadError');
    if (el) el.textContent = msg || '';
  }

  function setResult(html) {
    document.getElementById('quadResult').innerHTML = html || '';
  }

  function fmt(n) {
    return window.EngiCalc.formatNumber(n);
  }

  function fmtSigned(n) {
    const abs = Math.abs(n);
    const s = fmt(abs);
    return (n < 0 ? ' - ' : ' + ') + s;
  }

  function equationString(a, b, c) {
    const parts = [];
    function pushTerm(coeff, pow, first) {
      if (Math.abs(coeff) < 1e-15) return;
      const abs = Math.abs(coeff);
      let sign = coeff < 0 ? '-' : '+';
      if (first) sign = coeff < 0 ? '-' : '';
      else sign = coeff < 0 ? ' - ' : ' + ';
      let term = '';
      if (pow === 0) term = fmt(abs);
      else if (pow === 1) term = (Math.abs(abs - 1) < 1e-12 ? '' : fmt(abs)) + 'x';
      else term = (Math.abs(abs - 1) < 1e-12 ? '' : fmt(abs)) + 'x²';
      parts.push(sign + term);
    }
    pushTerm(a, 2, parts.length === 0);
    pushTerm(b, 1, parts.length === 0);
    pushTerm(c, 0, parts.length === 0);
    if (parts.length === 0) return '0 = 0';
    return parts.join('') + ' = 0';
  }

  function evalPoly(a, b, c, x) {
    // x may be number or math complex
    try {
      if (math.isComplex && math.isComplex(x)) {
        return math.add(math.add(math.multiply(a, math.multiply(x, x)), math.multiply(b, x)), c);
      }
      return a * x * x + b * x + c;
    } catch {
      return NaN;
    }
  }

  function formatComplexValue(z) {
    if (typeof z === 'number') return fmt(z);
    const re = Number(z.re);
    const im = Number(z.im);
    if (Math.abs(im) < 1e-12) return fmt(re);
    if (Math.abs(re) < 1e-12) {
      if (Math.abs(Math.abs(im) - 1) < 1e-12) return (im < 0 ? '-' : '') + 'i';
      return fmt(im) + 'i';
    }
    const sign = im >= 0 ? ' + ' : ' - ';
    const imAbs = Math.abs(im);
    const imStr = Math.abs(imAbs - 1) < 1e-12 ? 'i' : fmt(imAbs) + 'i';
    return fmt(re) + sign + imStr;
  }

  function buildSteps(a, b, c, d, rootsInfo) {
    const lines = [];
    lines.push('Equation: ' + equationString(a, b, c));
    lines.push('Standard form: ax² + bx + c = 0 with a = ' + fmt(a) + ', b = ' + fmt(b) + ', c = ' + fmt(c));
    lines.push('');
    lines.push('Quadratic formula: x = (-b ± √(b² - 4ac)) / (2a)');
    lines.push('');
    lines.push('Discriminant: Δ = b² - 4ac');
    lines.push('Δ = (' + fmt(b) + ')² - 4(' + fmt(a) + ')(' + fmt(c) + ')');
    lines.push('Δ = ' + fmt(b * b) + ' - ' + fmt(4 * a * c));
    lines.push('Δ = ' + fmt(d));
    lines.push('');
    lines.push('Root classification: ' + rootsInfo.type);
    if (rootsInfo.steps) lines.push.apply(lines, rootsInfo.steps);
    return lines.join('\n');
  }

  function solve() {
    setError('');
    try {
      const a = val('quadA');
      const b = val('quadB');
      const c = val('quadC');
      if (!isFinite(a) || !isFinite(b) || !isFinite(c)) {
        throw new Error('Please enter valid numeric values for coefficients a, b, and c.');
      }

      if (Math.abs(a) < 1e-15) {
        // Linear or degenerate
        let html = '';
        const eq = equationString(a, b, c);
        const lines = [];
        lines.push('Equation: ' + eq);
        lines.push('Because a = 0, this is not a quadratic equation. It reduces to a linear (or constant) equation: bx + c = 0.');
        lines.push('');
        if (Math.abs(b) < 1e-15) {
          if (Math.abs(c) < 1e-15) {
            lines.push('With b = 0 and c = 0, the equation becomes 0 = 0.');
            lines.push('Conclusion: infinitely many solutions (every real x satisfies the equation).');
            html = `<div class="result-line"><strong>Type</strong></div><pre>Not quadratic (degenerate equation)</pre>
                    <div class="result-line"><strong>Explanation</strong></div><pre>${lines.join('\n')}</pre>`;
            window.HistoryStore.addEntry({
              module: 'Quadratic Solver',
              moduleId: 'quadratic',
              expression: eq,
              result: 'Infinitely many solutions',
              payload: { a, b, c }
            });
          } else {
            lines.push('With b = 0 and c = ' + fmt(c) + ', the equation becomes ' + fmt(c) + ' = 0, which is false.');
            lines.push('Conclusion: no solution.');
            html = `<div class="result-line"><strong>Type</strong></div><pre>Not quadratic (inconsistent equation)</pre>
                    <div class="result-line"><strong>Explanation</strong></div><pre>${lines.join('\n')}</pre>`;
            window.HistoryStore.addEntry({
              module: 'Quadratic Solver',
              moduleId: 'quadratic',
              expression: eq,
              result: 'No solution',
              payload: { a, b, c }
            });
          }
        } else {
          const x = -c / b;
          lines.push('Linear equation: ' + fmt(b) + 'x + ' + fmt(c) + ' = 0');
          lines.push('Solve for x: x = -c / b');
          lines.push('x = -(' + fmt(c) + ') / (' + fmt(b) + ') = ' + fmt(x));
          const check = b * x + c;
          lines.push('');
          lines.push('Verification (substitute into bx + c):');
          lines.push(fmt(b) + '·(' + fmt(x) + ') + ' + fmt(c) + ' = ' + fmt(check));
          const ok = Math.abs(check) < 1e-9 * Math.max(1, Math.abs(c), Math.abs(b * x));
          lines.push(ok ? 'Check: approximately 0 (within numerical precision).' : 'Check: value is very close to 0 within numerical precision.');
          html = `<div class="result-line"><strong>Type</strong></div><pre>Not quadratic (linear equation, since a = 0)</pre>
                  <div class="result-line"><strong>Step-by-step calculation</strong></div><pre>${lines.join('\n')}</pre>
                  <div class="result-line"><strong>Result</strong></div><pre>x = ${fmt(x)}</pre>`;
          window.HistoryStore.addEntry({
            module: 'Quadratic Solver',
            moduleId: 'quadratic',
            expression: eq,
            result: 'x = ' + fmt(x),
            payload: { a, b, c }
          });
        }
        setResult(html);
        return;
      }

      const d = b * b - 4 * a * c;
      let rootsInfo = { type: '', steps: [], roots: [] };
      let x1, x2;
      if (d > 1e-12) {
        const sqrtD = Math.sqrt(d);
        x1 = (-b + sqrtD) / (2 * a);
        x2 = (-b - sqrtD) / (2 * a);
        rootsInfo.type = 'Two distinct real roots (Δ > 0)';
        rootsInfo.roots = [x1, x2];
        rootsInfo.steps.push('Since Δ > 0, there are two distinct real roots:');
        rootsInfo.steps.push('√Δ = √(' + fmt(d) + ') = ' + fmt(sqrtD));
        rootsInfo.steps.push('x₁ = (-b + √Δ) / (2a) = (-(' + fmt(b) + ') + ' + fmt(sqrtD) + ') / (2·' + fmt(a) + ') = ' + fmt(x1));
        rootsInfo.steps.push('x₂ = (-b - √Δ) / (2a) = (-(' + fmt(b) + ') - ' + fmt(sqrtD) + ') / (2·' + fmt(a) + ') = ' + fmt(x2));
      } else if (Math.abs(d) <= 1e-12) {
        x1 = -b / (2 * a);
        x2 = x1;
        rootsInfo.type = 'One repeated real root (Δ = 0)';
        rootsInfo.roots = [x1];
        rootsInfo.steps.push('Since Δ = 0, there is one repeated real root:');
        rootsInfo.steps.push('x = -b / (2a) = -(' + fmt(b) + ') / (2·' + fmt(a) + ') = ' + fmt(x1));
      } else {
        const sqrtAbs = Math.sqrt(-d);
        const real = -b / (2 * a);
        const imag = sqrtAbs / (2 * a);
        // keep canonical conjugate pair with ±imag magnitude
        x1 = math.complex(real, Math.abs(imag));
        x2 = math.complex(real, -Math.abs(imag));
        rootsInfo.type = 'Two complex conjugate roots (Δ < 0)';
        rootsInfo.roots = [x1, x2];
        rootsInfo.steps.push('Since Δ < 0, there are two complex conjugate roots:');
        rootsInfo.steps.push('√Δ = i√(|Δ|) = i√(' + fmt(-d) + ') = ' + fmt(sqrtAbs) + 'i');
        rootsInfo.steps.push('x = (-b ± i√(|Δ|)) / (2a)');
        rootsInfo.steps.push('Real part = -b / (2a) = -(' + fmt(b) + ') / (2·' + fmt(a) + ') = ' + fmt(real));
        rootsInfo.steps.push('Imaginary magnitude = √(|Δ|) / (2|a|) = ' + fmt(sqrtAbs) + ' / ' + fmt(Math.abs(2 * a)) + ' = ' + fmt(Math.abs(imag)));
        rootsInfo.steps.push('x₁ = ' + formatComplexValue(x1));
        rootsInfo.steps.push('x₂ = ' + formatComplexValue(x2));
      }

      const steps = buildSteps(a, b, c, d, rootsInfo);
      const verifyLines = [];
      verifyLines.push('Verification by substitution into ax² + bx + c:');
      const allRoots = (rootsInfo.roots.length === 1) ? [rootsInfo.roots[0]] : rootsInfo.roots;
      allRoots.forEach((r, idx) => {
        const label = allRoots.length === 1 ? 'x' : ('x' + (idx + 1));
        const valRes = evalPoly(a, b, c, r);
        if (math.isComplex && math.isComplex(r)) {
          verifyLines.push(label + ' = ' + formatComplexValue(r));
          verifyLines.push('a(' + label + ')² + b(' + label + ') + c = ' + formatComplexValue(valRes));
          const mag = math.abs(valRes);
          verifyLines.push('Magnitude of residual ≈ ' + fmt(mag) + (mag < 1e-9 ? ' (≈ 0 within numerical precision)' : ''));
        } else {
          verifyLines.push(label + ' = ' + fmt(r));
          verifyLines.push(fmt(a) + '·(' + fmt(r) + ')² + ' + fmt(b) + '·(' + fmt(r) + ') + ' + fmt(c) + ' = ' + fmt(valRes));
          verifyLines.push(Math.abs(valRes) < 1e-9 * Math.max(1, Math.abs(c), Math.abs(b * r), Math.abs(a * r * r)) ? 'Residual is approximately 0 (within numerical precision).' : 'Residual is very close to 0 within numerical precision.');
        }
        if (idx < allRoots.length - 1) verifyLines.push('');
      });

      let resultSummary = '';
      if (rootsInfo.roots.length === 1) resultSummary = 'x = ' + fmt(rootsInfo.roots[0]);
      else if (math.isComplex && math.isComplex(rootsInfo.roots[0])) resultSummary = 'x₁ = ' + formatComplexValue(rootsInfo.roots[0]) + ', x₂ = ' + formatComplexValue(rootsInfo.roots[1]);
      else resultSummary = 'x₁ = ' + fmt(rootsInfo.roots[0]) + ', x₂ = ' + fmt(rootsInfo.roots[1]);

      const html = `
        <div class="result-line"><strong>Equation</strong></div><pre>${equationString(a, b, c)}</pre>
        <div class="result-line"><strong>Discriminant &amp; root type</strong></div><pre>Δ = ${fmt(d)}\n${rootsInfo.type}</pre>
        <div class="result-line"><strong>Roots</strong></div><pre>${resultSummary}</pre>
        <div class="result-line"><strong>Step-by-step calculation</strong></div><pre>${steps}</pre>
        <div class="result-line"><strong>Verification</strong></div><pre>${verifyLines.join('\n')}</pre>
      `;
      setResult(html);

      window.HistoryStore.addEntry({
        module: 'Quadratic Solver',
        moduleId: 'quadratic',
        expression: equationString(a, b, c),
        result: resultSummary,
        payload: { a, b, c }
      });
    } catch (err) {
      setResult('');
      setError(window.EngiCalc.friendlyMathError(err));
    }
  }

  function clearAll() {
    document.getElementById('quadA').value = '';
    document.getElementById('quadB').value = '';
    document.getElementById('quadC').value = '';
    const ex = document.getElementById('quadExample');
    if (ex) ex.value = '';
    setError('');
    setResult('');
  }

  function applyExample() {
    const ex = document.getElementById('quadExample').value;
    const map = {
      twoReal: { a: 1, b: -5, c: 6 },
      repeated: { a: 1, b: 2, c: 1 },
      complex: { a: 1, b: 0, c: 1 },
      linear: { a: 0, b: 2, c: 4 }
    };
    if (!map[ex]) return;
    document.getElementById('quadA').value = map[ex].a;
    document.getElementById('quadB').value = map[ex].b;
    document.getElementById('quadC').value = map[ex].c;
    setError('');
  }

  function reuse(payload) {
    if (!payload) return;
    if (payload.a != null) document.getElementById('quadA').value = payload.a;
    if (payload.b != null) document.getElementById('quadB').value = payload.b;
    if (payload.c != null) document.getElementById('quadC').value = payload.c;
    setError('');
  }

  window.QuadraticModule = { init, reuse };
})();