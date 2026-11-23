(function () {
  function init() {
    if (!document.getElementById('matBuildBtn')) return;
    document.getElementById('matBuildBtn').addEventListener('click', buildMatrices);
    document.getElementById('matIdentityBtn').addEventListener('click', generateIdentity);
    document.getElementById('matCalcBtn').addEventListener('click', calculate);
    document.getElementById('matCopyBtn').addEventListener('click', () => window.EngiCalc.copyText(document.getElementById('matResult').innerText));
    buildMatrices();
  }

  function setError(msg) { document.getElementById('matError').textContent = msg || ''; }
  function setResult(html) { document.getElementById('matResult').innerHTML = html; }

  function clampDim(v) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return 2;
    return Math.min(6, Math.max(1, n));
  }

  function buildMatrices() {
    const ar = clampDim(document.getElementById('matARows').value);
    const ac = clampDim(document.getElementById('matACols').value);
    const br = clampDim(document.getElementById('matBRows').value);
    const bc = clampDim(document.getElementById('matBCols').value);
    document.getElementById('matARows').value = ar; document.getElementById('matACols').value = ac;
    document.getElementById('matBRows').value = br; document.getElementById('matBCols').value = bc;
    document.getElementById('matAContainer').innerHTML = buildGrid('A', ar, ac);
    document.getElementById('matBContainer').innerHTML = buildGrid('B', br, bc);
    setError('');
  }

  function buildGrid(name, rows, cols, values) {
    let html = '<table class="matrix-grid-input" aria-label="Matrix ' + name + '"><tbody>';
    for (let i = 0; i < rows; i++) {
      html += '<tr>';
      for (let j = 0; j < cols; j++) {
        const val = values && values[i] && values[i][j] != null ? values[i][j] : (i === j ? 1 : 0);
        html += `<td><input type="number" step="any" data-matrix="${name}" data-r="${i}" data-c="${j}" value="${val}" aria-label="${name} row ${i + 1} column ${j + 1}"></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
  }

  function readMatrix(name) {
    const inputs = Array.from(document.querySelectorAll(`input[data-matrix="${name}"]`));
    if (inputs.length === 0) throw new Error(`Matrix ${name} is not built yet.`);
    let maxR = 0, maxC = 0;
    inputs.forEach(inp => { maxR = Math.max(maxR, +inp.dataset.r); maxC = Math.max(maxC, +inp.dataset.c); });
    const rows = maxR + 1, cols = maxC + 1;
    const m = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const inp of inputs) {
      const v = parseFloat(inp.value);
      if (Number.isNaN(v)) throw new Error(`Matrix ${name} has an invalid value at row ${+inp.dataset.r + 1}, column ${+inp.dataset.c + 1}.`);
      m[+inp.dataset.r][+inp.dataset.c] = v;
    }
    return m;
  }

  function renderMatrix(matrix) {
    if (!Array.isArray(matrix)) return `<pre>${window.EngiCalc.formatNumber(matrix)}</pre>`;
    if (!Array.isArray(matrix[0])) {
      return '<div class="matrix-output"><table><tbody><tr>' + matrix.map(v => `<td>${window.EngiCalc.formatNumber(v)}</td>`).join('') + '</tr></tbody></table></div>';
    }
    let html = '<div class="matrix-output"><table><tbody>';
    matrix.forEach(row => {
      html += '<tr>' + row.map(v => `<td>${window.EngiCalc.formatNumber(v)}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function dims(m) {
    if (!Array.isArray(m)) return [0, 0];
    if (!Array.isArray(m[0])) return [1, m.length];
    return [m.length, m[0].length];
  }

  function generateIdentity() {
    setError('');
    const n = clampDim(document.getElementById('matIdentitySize').value);
    document.getElementById('matIdentitySize').value = n;
    const I = math.identity(n).valueOf();
    setResult(`<div class="result-line"><strong>Identity matrix I${n}</strong></div>${renderMatrix(I)}`);
    window.HistoryStore.addEntry({
      module: 'Matrices',
      moduleId: 'matrices',
      expression: `Identity matrix (${n}×${n})`,
      result: `I${n}`,
      payload: { type: 'identity', size: n }
    });
  }

  function calculate() {
    setError('');
    try {
      const op = document.getElementById('matOperation').value;
      let A, B;
      const needA = ['add','sub','mul','transposeA','detA','invA'].includes(op);
      const needB = ['add','sub','mul','transposeB','detB','invB'].includes(op);
      if (needA) A = readMatrix('A');
      if (needB) B = readMatrix('B');
      let result, title = '', expr = '';
      if (op === 'add') {
        if (dims(A)[0] !== dims(B)[0] || dims(A)[1] !== dims(B)[1]) throw new Error(`Matrix addition requires the same dimensions. A is ${dims(A)[0]}×${dims(A)[1]} but B is ${dims(B)[0]}×${dims(B)[1]}.`);
        result = math.add(A, B); title = 'A + B'; expr = `A(${dims(A)[0]}×${dims(A)[1]}) + B(${dims(B)[0]}×${dims(B)[1]})`;
      } else if (op === 'sub') {
        if (dims(A)[0] !== dims(B)[0] || dims(A)[1] !== dims(B)[1]) throw new Error(`Matrix subtraction requires the same dimensions. A is ${dims(A)[0]}×${dims(A)[1]} but B is ${dims(B)[0]}×${dims(B)[1]}.`);
        result = math.subtract(A, B); title = 'A - B'; expr = `A(${dims(A)[0]}×${dims(A)[1]}) - B(${dims(B)[0]}×${dims(B)[1]})`;
      } else if (op === 'mul') {
        if (dims(A)[1] !== dims(B)[0]) throw new Error(`Matrix multiplication requires columns of A to equal rows of B. A is ${dims(A)[0]}×${dims(A)[1]} but B is ${dims(B)[0]}×${dims(B)[1]}.`);
        result = math.multiply(A, B); title = 'A × B'; expr = `A(${dims(A)[0]}×${dims(A)[1]}) × B(${dims(B)[0]}×${dims(B)[1]})`;
      } else if (op === 'transposeA') {
        result = math.transpose(A); title = 'Transpose of A'; expr = `transpose(A ${dims(A)[0]}×${dims(A)[1]})`;
      } else if (op === 'transposeB') {
        result = math.transpose(B); title = 'Transpose of B'; expr = `transpose(B ${dims(B)[0]}×${dims(B)[1]})`;
      } else if (op === 'detA') {
        if (dims(A)[0] !== dims(A)[1]) throw new Error(`Determinant requires a square matrix. Matrix A is ${dims(A)[0]}×${dims(A)[1]}.`);
        result = math.det(A); title = 'Determinant of A'; expr = `det(A ${dims(A)[0]}×${dims(A)[1]})`;
      } else if (op === 'detB') {
        if (dims(B)[0] !== dims(B)[1]) throw new Error(`Determinant requires a square matrix. Matrix B is ${dims(B)[0]}×${dims(B)[1]}.`);
        result = math.det(B); title = 'Determinant of B'; expr = `det(B ${dims(B)[0]}×${dims(B)[1]})`;
      } else if (op === 'invA') {
        if (dims(A)[0] !== dims(A)[1]) throw new Error(`Inverse requires a square matrix. Matrix A is ${dims(A)[0]}×${dims(A)[1]}.`);
        const det = math.det(A);
        if (Math.abs(det) < 1e-12) throw new Error('Matrix A is singular or nearly singular (determinant is 0), so it cannot be inverted.');
        result = math.inv(A); title = 'Inverse of A'; expr = `inv(A ${dims(A)[0]}×${dims(A)[1]})`;
      } else if (op === 'invB') {
        if (dims(B)[0] !== dims(B)[1]) throw new Error(`Inverse requires a square matrix. Matrix B is ${dims(B)[0]}×${dims(B)[1]}.`);
        const det = math.det(B);
        if (Math.abs(det) < 1e-12) throw new Error('Matrix B is singular or nearly singular (determinant is 0), so it cannot be inverted.');
        result = math.inv(B); title = 'Inverse of B'; expr = `inv(B ${dims(B)[0]}×${dims(B)[1]})`;
      }
      setResult(`<div class="result-line"><strong>${title}</strong></div>${renderMatrix(result)}`);
      window.HistoryStore.addEntry({
        module: 'Matrices',
        moduleId: 'matrices',
        expression: expr,
        result: Array.isArray(result) ? `Matrix ${Array.isArray(result[0]) ? result.length + '×' + result[0].length : '1×' + result.length}` : window.EngiCalc.formatNumber(result),
        payload: { type: 'op', op, A: needA ? A : null, B: needB ? B : null, ar: dims(A||[])[0], ac: dims(A||[])[1], br: dims(B||[])[0], bc: dims(B||[])[1] }
      });
    } catch (err) {
      setResult('');
      setError(window.EngiCalc.friendlyMathError(err));
    }
  }

  function reuse(payload) {
    if (!payload) return;
    setError('');
    if (payload.type === 'identity') {
      document.getElementById('matIdentitySize').value = payload.size || 3;
      generateIdentity();
      return;
    }
    if (payload.type === 'op') {
      if (payload.A) {
        document.getElementById('matARows').value = payload.A.length;
        document.getElementById('matACols').value = payload.A[0] ? payload.A[0].length : 1;
      }
      if (payload.B) {
        document.getElementById('matBRows').value = payload.B.length;
        document.getElementById('matBCols').value = payload.B[0] ? payload.B[0].length : 1;
      }
      buildMatrices();
      if (payload.A) document.getElementById('matAContainer').innerHTML = buildGrid('A', payload.A.length, payload.A[0].length, payload.A);
      if (payload.B) document.getElementById('matBContainer').innerHTML = buildGrid('B', payload.B.length, payload.B[0].length, payload.B);
      if (payload.op) document.getElementById('matOperation').value = payload.op;
      calculate();
    }
  }

  window.MatricesModule = { init, reuse };
})();