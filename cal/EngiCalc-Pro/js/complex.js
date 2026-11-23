(function () {
  function init() {
    const btn = document.getElementById('cxCalcBtn');
    const copy = document.getElementById('cxCopyBtn');
    if (!btn) return;
    btn.addEventListener('click', calculate);
    copy.addEventListener('click', () => window.EngiCalc.copyText(document.getElementById('cxResult').innerText));
    calculate();
  }

  function getInput() {
    const aRe = parseFloat(document.getElementById('cxARe').value);
    const aIm = parseFloat(document.getElementById('cxAIm').value);
    const bRe = parseFloat(document.getElementById('cxBRe').value);
    const bIm = parseFloat(document.getElementById('cxBIm').value);
    if ([aRe, aIm, bRe, bIm].some(v => Number.isNaN(v))) {
      throw new Error('Please enter valid numeric values for the real and imaginary parts.');
    }
    return { A: math.complex(aRe, aIm), B: math.complex(bRe, bIm), angleUnit: document.getElementById('cxAngleUnit').value };
  }

  function fmt(c, angleUnit) {
    return window.EngiCalc.formatComplex(c, angleUnit);
  }

  function setError(msg) { document.getElementById('cxError').textContent = msg || ''; }
  function setResult(html) { document.getElementById('cxResult').innerHTML = html; }

  function block(title, lines) {
    return `<div class="result-line"><strong>${title}</strong></div><pre>${lines.join('\n')}</pre>`;
  }

  function calculate() {
    setError('');
    try {
      const { A, B, angleUnit } = getInput();
      const op = document.getElementById('cxOperation').value;
      let html = '';
      let expr = '';
      let resultText = '';
      const fA = fmt(A, angleUnit);
      const fB = fmt(B, angleUnit);

      const showNum = (label, c) => {
        const f = fmt(c, angleUnit);
        return block(label, [
          `Rectangular: ${f.rectangular}`,
          `Polar:       ${f.polar}`,
          `Modulus:     ${f.modulus}`,
          `Argument:    ${f.argument}`
        ]);
      };

      if (op === 'add') {
        const R = math.add(A, B); const f = fmt(R, angleUnit);
        expr = `(${fA.rectangular}) + (${fB.rectangular})`;
        resultText = f.rectangular;
        html = block('A', [`Rectangular: ${fA.rectangular}`, `Polar: ${fA.polar}`]) + block('B', [`Rectangular: ${fB.rectangular}`, `Polar: ${fB.polar}`]) + block('A + B', [`Rectangular: ${f.rectangular}`, `Polar: ${f.polar}`]);
      } else if (op === 'sub') {
        const R = math.subtract(A, B); const f = fmt(R, angleUnit);
        expr = `(${fA.rectangular}) - (${fB.rectangular})`;
        resultText = f.rectangular;
        html = block('A - B', [`Rectangular: ${f.rectangular}`, `Polar: ${f.polar}`]);
      } else if (op === 'mul') {
        const R = math.multiply(A, B); const f = fmt(R, angleUnit);
        expr = `(${fA.rectangular}) × (${fB.rectangular})`;
        resultText = f.rectangular;
        html = block('A × B', [`Rectangular: ${f.rectangular}`, `Polar: ${f.polar}`]);
      } else if (op === 'div') {
        if (Math.abs(B.re) < 1e-15 && Math.abs(B.im) < 1e-15) throw new Error('Division by zero: complex number B must not be 0 + 0i.');
        const R = math.divide(A, B); const f = fmt(R, angleUnit);
        expr = `(${fA.rectangular}) ÷ (${fB.rectangular})`;
        resultText = f.rectangular;
        html = block('A ÷ B', [`Rectangular: ${f.rectangular}`, `Polar: ${f.polar}`]);
      } else if (op === 'conjA') {
        const R = math.conj(A); expr = `conj(A)`; resultText = fmt(R, angleUnit).rectangular; html = showNum('A', A) + showNum('Conjugate of A', R);
      } else if (op === 'conjB') {
        const R = math.conj(B); expr = `conj(B)`; resultText = fmt(R, angleUnit).rectangular; html = showNum('B', B) + showNum('Conjugate of B', R);
      } else if (op === 'modA') {
        const m = math.abs(A); expr = '|A|'; resultText = window.EngiCalc.formatNumber(m); html = block('Modulus of A', [`|A| = ${resultText}`, `A = ${fA.rectangular}`]);
      } else if (op === 'modB') {
        const m = math.abs(B); expr = '|B|'; resultText = window.EngiCalc.formatNumber(m); html = block('Modulus of B', [`|B| = ${resultText}`, `B = ${fB.rectangular}`]);
      } else if (op === 'argA') {
        expr = 'arg(A)'; resultText = fA.argument; html = block('Argument of A', [`arg(A) = ${fA.argument}`, `A = ${fA.rectangular}`, `Polar: ${fA.polar}`]);
      } else if (op === 'argB') {
        expr = 'arg(B)'; resultText = fB.argument; html = block('Argument of B', [`arg(B) = ${fB.argument}`, `B = ${fB.rectangular}`, `Polar: ${fB.polar}`]);
      } else if (op === 'formsA') {
        expr = 'Forms of A'; resultText = fA.rectangular; html = showNum('Number A', A);
      } else if (op === 'formsB') {
        expr = 'Forms of B'; resultText = fB.rectangular; html = showNum('Number B', B);
      }
      setResult(html);
      window.HistoryStore.addEntry({
        module: 'Complex Numbers',
        moduleId: 'complex',
        expression: expr,
        result: resultText,
        payload: {
          aRe: A.re, aIm: A.im, bRe: B.re, bIm: B.im, op, angleUnit
        }
      });
    } catch (err) {
      setResult('');
      setError(window.EngiCalc.friendlyMathError(err));
    }
  }

  function reuse(payload) {
    if (!payload) return;
    if (payload.aRe != null) document.getElementById('cxARe').value = payload.aRe;
    if (payload.aIm != null) document.getElementById('cxAIm').value = payload.aIm;
    if (payload.bRe != null) document.getElementById('cxBRe').value = payload.bRe;
    if (payload.bIm != null) document.getElementById('cxBIm').value = payload.bIm;
    if (payload.op) document.getElementById('cxOperation').value = payload.op;
    if (payload.angleUnit) document.getElementById('cxAngleUnit').value = payload.angleUnit;
    calculate();
  }

  window.ComplexModule = { init, reuse };
})();