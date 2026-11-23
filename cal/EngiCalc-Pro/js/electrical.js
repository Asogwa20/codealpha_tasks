(function () {
  function init() {
    if (!document.getElementById('elecTool')) return;
    document.getElementById('elecTool').addEventListener('change', renderFields);
    document.getElementById('elecCalcBtn').addEventListener('click', calculate);
    document.getElementById('elecCopyBtn').addEventListener('click', () => window.EngiCalc.copyText(document.getElementById('elecResult').innerText));
    renderFields();
  }

  function renderFields() {
    const tool = document.getElementById('elecTool').value;
    const c = document.getElementById('elecFields');
    let html = '';
    if (tool === 'ohms') {
      html = `
        <label>Solve for
          <select id="ohmsSolve">
            <option value="V">Voltage (V)</option>
            <option value="I">Current (I)</option>
            <option value="R">Resistance (R)</option>
          </select>
        </label>
        <label>Voltage V (volts) <input type="number" id="ohmsV" step="any" placeholder="Leave blank if solving for V"></label>
        <label>Current I (amperes) <input type="number" id="ohmsI" step="any" placeholder="Leave blank if solving for I"></label>
        <label>Resistance R (ohms) <input type="number" id="ohmsR" step="any" placeholder="Leave blank if solving for R"></label>
      `;
    } else if (tool === 'power') {
      html = `
        <label>Solve for
          <select id="pwrSolve">
            <option value="P">Power (P)</option>
            <option value="V">Voltage (V)</option>
            <option value="I">Current (I)</option>
            <option value="R">Resistance (R)</option>
          </select>
        </label>
        <label>Power P (watts) <input type="number" id="pwrP" step="any"></label>
        <label>Voltage V (volts) <input type="number" id="pwrV" step="any"></label>
        <label>Current I (amperes) <input type="number" id="pwrI" step="any"></label>
        <label>Resistance R (ohms) <input type="number" id="pwrR" step="any"></label>
        <p class="hint" style="grid-column:1/-1;margin:0;">Provide any two known values (leave others blank). The calculator selects a compatible formula.</p>
      `;
    } else if (tool === 'series') {
      html = `
        <label style="grid-column:1/-1;">Resistor values in ohms (comma or space separated)
          <textarea id="seriesValues" rows="3" placeholder="e.g. 100, 220, 330"></textarea>
        </label>
      `;
    } else if (tool === 'parallel') {
      html = `
        <label style="grid-column:1/-1;">Resistor values in ohms (comma or space separated)
          <textarea id="parallelValues" rows="3" placeholder="e.g. 100, 220, 330"></textarea>
        </label>
      `;
    } else if (tool === 'ac') {
      html = `
        <label>AC calculation
          <select id="acCalc">
            <option value="freqPeriod">Frequency ↔ Period</option>
            <option value="angular">Angular frequency (ω)</option>
            <option value="xc">Capacitive reactance (Xc)</option>
            <option value="xl">Inductive reactance (Xl)</option>
            <option value="impSeriesRL">Impedance: series RL</option>
            <option value="impSeriesRC">Impedance: series RC</option>
            <option value="impSeriesRLC">Impedance: series RLC</option>
          </select>
        </label>
        <div id="acSubFields" class="form-grid two-col" style="grid-column:1/-1;"></div>
      `;
      c.innerHTML = html;
      document.getElementById('acCalc').addEventListener('change', renderAcFields);
      renderAcFields();
      return;
    }
    c.innerHTML = html;
  }

  function renderAcFields() {
    const calc = document.getElementById('acCalc').value;
    const sub = document.getElementById('acSubFields');
    const map = {
      freqPeriod: `
        <label>Solve for <select id="acFPsolve"><option value="f">Frequency f (Hz)</option><option value="T">Period T (s)</option></select></label>
        <label>Frequency f (Hz) <input type="number" id="acF" step="any"></label>
        <label>Period T (s) <input type="number" id="acT" step="any"></label>
      `,
      angular: `
        <label>Frequency f (Hz) <input type="number" id="acF" step="any" value="60"></label>
      `,
      xc: `
        <label>Frequency f (Hz) <input type="number" id="acF" step="any" value="60"></label>
        <label>Capacitance C (farads) <input type="number" id="acC" step="any" value="0.0001"></label>
      `,
      xl: `
        <label>Frequency f (Hz) <input type="number" id="acF" step="any" value="60"></label>
        <label>Inductance L (henries) <input type="number" id="acL" step="any" value="0.1"></label>
      `,
      impSeriesRL: `
        <label>Resistance R (ohms) <input type="number" id="acR" step="any" value="10"></label>
        <label>Inductance L (henries) <input type="number" id="acL" step="any" value="0.1"></label>
        <label>Frequency f (Hz) <input type="number" id="acF" step="any" value="60"></label>
      `,
      impSeriesRC: `
        <label>Resistance R (ohms) <input type="number" id="acR" step="any" value="10"></label>
        <label>Capacitance C (farads) <input type="number" id="acC" step="any" value="0.0001"></label>
        <label>Frequency f (Hz) <input type="number" id="acF" step="any" value="60"></label>
      `,
      impSeriesRLC: `
        <label>Resistance R (ohms) <input type="number" id="acR" step="any" value="10"></label>
        <label>Inductance L (henries) <input type="number" id="acL" step="any" value="0.1"></label>
        <label>Capacitance C (farads) <input type="number" id="acC" step="any" value="0.0001"></label>
        <label>Frequency f (Hz) <input type="number" id="acF" step="any" value="60"></label>
      `
    };
    sub.innerHTML = map[calc] || '';
  }

  function setError(msg) { document.getElementById('elecError').textContent = msg || ''; }
  function setResult(html) { document.getElementById('elecResult').innerHTML = html; }
  function fmt(n) { return window.EngiCalc.formatNumber(n); }
  function val(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const raw = el.value.trim();
    if (raw === '') return NaN;
    const n = parseFloat(raw);
    return n;
  }
  function needFinite(name, n, opts = {}) {
    if (Number.isNaN(n) || !isFinite(n)) throw new Error(`Please enter a valid number for ${name}.`);
    if (opts.positive && !(n > 0)) throw new Error(`${name} must be greater than 0.`);
    if (opts.nonNegative && !(n >= 0)) throw new Error(`${name} must be 0 or greater.`);
    return n;
  }

  function resultBlock(lines, formula, substituted, finalLine) {
    return `
      <div class="result-line"><strong>Formula</strong></div><pre>${formula}</pre>
      <div class="result-line"><strong>Substituted values</strong></div><pre>${substituted}</pre>
      <div class="result-line"><strong>Result</strong></div><pre>${finalLine}</pre>
      ${lines ? `<div class="result-line"><strong>Details</strong></div><pre>${lines}</pre>` : ''}
    `;
  }

  function calculate() {
    setError('');
    try {
      const tool = document.getElementById('elecTool').value;
      let html = '', expr = '', res = '';
      if (tool === 'ohms') {
        const solveFor = document.getElementById('ohmsSolve').value;
        const V = val('ohmsV'), I = val('ohmsI'), R = val('ohmsR');
        if (solveFor === 'V') {
          needFinite('Current I', I); needFinite('Resistance R', R, { nonNegative: true });
          const out = I * R;
          html = resultBlock('', 'V = I × R', `V = ${fmt(I)} A × ${fmt(R)} Ω`, `V = ${fmt(out)} V`);
          expr = 'Ohm\'s Law: solve for V'; res = `${fmt(out)} V`;
        } else if (solveFor === 'I') {
          needFinite('Voltage V', V); needFinite('Resistance R', R, { positive: true });
          const out = V / R;
          html = resultBlock('', 'I = V / R', `I = ${fmt(V)} V / ${fmt(R)} Ω`, `I = ${fmt(out)} A`);
          expr = 'Ohm\'s Law: solve for I'; res = `${fmt(out)} A`;
        } else {
          needFinite('Voltage V', V); needFinite('Current I', I);
          if (I === 0) throw new Error('Current I must not be zero when solving for resistance (division by zero).');
          const out = V / I;
          html = resultBlock('', 'R = V / I', `R = ${fmt(V)} V / ${fmt(I)} A`, `R = ${fmt(out)} Ω`);
          expr = 'Ohm\'s Law: solve for R'; res = `${fmt(out)} Ω`;
        }
      } else if (tool === 'power') {
        const solveFor = document.getElementById('pwrSolve').value;
        const P = val('pwrP'), V = val('pwrV'), I = val('pwrI'), R = val('pwrR');
        const known = { P: !Number.isNaN(P), V: !Number.isNaN(V), I: !Number.isNaN(I), R: !Number.isNaN(R) };
        const count = Object.values(known).filter(Boolean).length;
        if (count < 2) throw new Error('Please provide at least two known values to calculate electrical power quantities.');
        if (solveFor === 'P') {
          if (known.V && known.I) {
            needFinite('V', V); needFinite('I', I);
            const out = V * I; res = `${fmt(out)} W`;
            html = resultBlock('', 'P = V × I', `P = ${fmt(V)} V × ${fmt(I)} A`, `P = ${fmt(out)} W`);
          } else if (known.I && known.R) {
            needFinite('I', I); needFinite('R', R, { nonNegative: true });
            const out = I * I * R; res = `${fmt(out)} W`;
            html = resultBlock('', 'P = I² × R', `P = (${fmt(I)} A)² × ${fmt(R)} Ω`, `P = ${fmt(out)} W`);
          } else if (known.V && known.R) {
            needFinite('V', V); needFinite('R', R, { positive: true });
            const out = (V * V) / R; res = `${fmt(out)} W`;
            html = resultBlock('', 'P = V² / R', `P = (${fmt(V)} V)² / ${fmt(R)} Ω`, `P = ${fmt(out)} W`);
          } else throw new Error('To solve for P, provide (V and I), (I and R), or (V and R).');
          expr = 'Electrical power: solve for P';
        } else if (solveFor === 'V') {
          if (known.P && known.I) {
            needFinite('P', P, { nonNegative: true }); needFinite('I', I);
            if (I === 0) throw new Error('Current I must not be zero when solving for V from P and I.');
            const out = P / I; res = `${fmt(out)} V`;
            html = resultBlock('', 'V = P / I', `V = ${fmt(P)} W / ${fmt(I)} A`, `V = ${fmt(out)} V`);
          } else if (known.P && known.R) {
            needFinite('P', P, { nonNegative: true }); needFinite('R', R, { nonNegative: true });
            const out = Math.sqrt(P * R); res = `${fmt(out)} V`;
            html = resultBlock('Principal (positive) root shown.', 'V = √(P × R)', `V = √(${fmt(P)} W × ${fmt(R)} Ω)`, `V = ${fmt(out)} V`);
          } else if (known.I && known.R) {
            needFinite('I', I); needFinite('R', R, { nonNegative: true });
            const out = I * R; res = `${fmt(out)} V`;
            html = resultBlock('', 'V = I × R', `V = ${fmt(I)} A × ${fmt(R)} Ω`, `V = ${fmt(out)} V`);
          } else throw new Error('To solve for V, provide (P and I), (P and R), or (I and R).');
          expr = 'Electrical power: solve for V';
        } else if (solveFor === 'I') {
          if (known.P && known.V) {
            needFinite('P', P, { nonNegative: true }); needFinite('V', V);
            if (V === 0) throw new Error('Voltage V must not be zero when solving for I from P and V.');
            const out = P / V; res = `${fmt(out)} A`;
            html = resultBlock('', 'I = P / V', `I = ${fmt(P)} W / ${fmt(V)} V`, `I = ${fmt(out)} A`);
          } else if (known.P && known.R) {
            needFinite('P', P, { nonNegative: true }); needFinite('R', R, { positive: true });
            const out = Math.sqrt(P / R); res = `${fmt(out)} A`;
            html = resultBlock('Principal (positive) root shown.', 'I = √(P / R)', `I = √(${fmt(P)} W / ${fmt(R)} Ω)`, `I = ${fmt(out)} A`);
          } else if (known.V && known.R) {
            needFinite('V', V); needFinite('R', R, { positive: true });
            const out = V / R; res = `${fmt(out)} A`;
            html = resultBlock('', 'I = V / R', `I = ${fmt(V)} V / ${fmt(R)} Ω`, `I = ${fmt(out)} A`);
          } else throw new Error('To solve for I, provide (P and V), (P and R), or (V and R).');
          expr = 'Electrical power: solve for I';
        } else { // R
          if (known.V && known.I) {
            needFinite('V', V); needFinite('I', I);
            if (I === 0) throw new Error('Current I must not be zero when solving for R from V and I.');
            const out = V / I; res = `${fmt(out)} Ω`;
            html = resultBlock('', 'R = V / I', `R = ${fmt(V)} V / ${fmt(I)} A`, `R = ${fmt(out)} Ω`);
          } else if (known.V && known.P) {
            needFinite('V', V); needFinite('P', P, { positive: true });
            const out = (V * V) / P; res = `${fmt(out)} Ω`;
            html = resultBlock('', 'R = V² / P', `R = (${fmt(V)} V)² / ${fmt(P)} W`, `R = ${fmt(out)} Ω`);
          } else if (known.P && known.I) {
            needFinite('P', P, { nonNegative: true }); needFinite('I', I);
            if (I === 0) throw new Error('Current I must not be zero when solving for R from P and I.');
            const out = P / (I * I); res = `${fmt(out)} Ω`;
            html = resultBlock('', 'R = P / I²', `R = ${fmt(P)} W / (${fmt(I)} A)²`, `R = ${fmt(out)} Ω`);
          } else throw new Error('To solve for R, provide (V and I), (V and P), or (P and I).');
          expr = 'Electrical power: solve for R';
        }
      } else if (tool === 'series') {
        const values = parseResistors('seriesValues');
        if (values.some(v => v < 0)) throw new Error('Resistor values must not be negative.');
        const total = values.reduce((a, b) => a + b, 0);
        res = `${fmt(total)} Ω`;
        expr = `Series resistors: ${values.length} values`;
        html = resultBlock(`Count: ${values.length}`, 'R_total = R1 + R2 + ... + Rn', `R_total = ${values.map(fmt).join(' + ')} Ω`, `R_total = ${fmt(total)} Ω`);
      } else if (tool === 'parallel') {
        const values = parseResistors('parallelValues');
        if (values.length === 0) throw new Error('Enter at least one resistor value.');
        if (values.some(v => !(v > 0))) throw new Error('Parallel resistor values must all be greater than 0 (no short circuits / zero-ohm branches).');
        const invSum = values.reduce((a, b) => a + 1 / b, 0);
        const total = 1 / invSum;
        res = `${fmt(total)} Ω`;
        expr = `Parallel resistors: ${values.length} values`;
        html = resultBlock(`Count: ${values.length}\nEquivalent conductance: ${fmt(invSum)} S`, '1/R_total = 1/R1 + 1/R2 + ... + 1/Rn', `1/R_total = ${values.map(v => '1/' + fmt(v)).join(' + ')} = ${fmt(invSum)} 1/Ω`, `R_total = ${fmt(total)} Ω`);
      } else if (tool === 'ac') {
        const acCalc = document.getElementById('acCalc').value;
        if (acCalc === 'freqPeriod') {
          const solve = document.getElementById('acFPsolve').value;
          if (solve === 'f') {
            const T = needFinite('Period T', val('acT'), { positive: true });
            const f = 1 / T; res = `${fmt(f)} Hz`; expr = 'AC: frequency from period';
            html = resultBlock('', 'f = 1 / T', `f = 1 / ${fmt(T)} s`, `f = ${fmt(f)} Hz\nT = ${fmt(T)} s`);
          } else {
            const f = needFinite('Frequency f', val('acF'), { positive: true });
            const T = 1 / f; res = `${fmt(T)} s`; expr = 'AC: period from frequency';
            html = resultBlock('', 'T = 1 / f', `T = 1 / ${fmt(f)} Hz`, `T = ${fmt(T)} s\nf = ${fmt(f)} Hz`);
          }
        } else if (acCalc === 'angular') {
          const f = needFinite('Frequency f', val('acF'), { nonNegative: true });
          const w = 2 * Math.PI * f; res = `${fmt(w)} rad/s`; expr = 'AC: angular frequency';
          html = resultBlock('', 'ω = 2πf', `ω = 2 × π × ${fmt(f)} Hz`, `ω = ${fmt(w)} rad/s\nf = ${fmt(f)} Hz`);
        } else if (acCalc === 'xc') {
          const f = needFinite('Frequency f', val('acF'), { positive: true });
          const C = needFinite('Capacitance C', val('acC'), { positive: true });
          const Xc = 1 / (2 * Math.PI * f * C); res = `${fmt(Xc)} Ω`; expr = 'AC: capacitive reactance';
          html = resultBlock('', 'Xc = 1 / (2πfC)', `Xc = 1 / (2 × π × ${fmt(f)} Hz × ${fmt(C)} F)`, `Xc = ${fmt(Xc)} Ω`);
        } else if (acCalc === 'xl') {
          const f = needFinite('Frequency f', val('acF'), { nonNegative: true });
          const L = needFinite('Inductance L', val('acL'), { nonNegative: true });
          const Xl = 2 * Math.PI * f * L; res = `${fmt(Xl)} Ω`; expr = 'AC: inductive reactance';
          html = resultBlock('', 'Xl = 2πfL', `Xl = 2 × π × ${fmt(f)} Hz × ${fmt(L)} H`, `Xl = ${fmt(Xl)} Ω`);
        } else if (acCalc === 'impSeriesRL') {
          const R = needFinite('Resistance R', val('acR'), { nonNegative: true });
          const L = needFinite('Inductance L', val('acL'), { nonNegative: true });
          const f = needFinite('Frequency f', val('acF'), { nonNegative: true });
          const Xl = 2 * Math.PI * f * L;
          const Z = Math.sqrt(R * R + Xl * Xl);
          res = `${fmt(Z)} Ω`; expr = 'AC: impedance series RL';
          html = resultBlock(`Xl = ${fmt(Xl)} Ω`, 'Xl = 2πfL\n|Z| = √(R² + Xl²)', `R = ${fmt(R)} Ω, L = ${fmt(L)} H, f = ${fmt(f)} Hz\nXl = 2 × π × ${fmt(f)} × ${fmt(L)} = ${fmt(Xl)} Ω\n|Z| = √(${fmt(R)}² + ${fmt(Xl)}²)`, `|Z| = ${fmt(Z)} Ω`);
        } else if (acCalc === 'impSeriesRC') {
          const R = needFinite('Resistance R', val('acR'), { nonNegative: true });
          const C = needFinite('Capacitance C', val('acC'), { positive: true });
          const f = needFinite('Frequency f', val('acF'), { positive: true });
          const Xc = 1 / (2 * Math.PI * f * C);
          const Z = Math.sqrt(R * R + Xc * Xc);
          res = `${fmt(Z)} Ω`; expr = 'AC: impedance series RC';
          html = resultBlock(`Xc = ${fmt(Xc)} Ω`, 'Xc = 1 / (2πfC)\n|Z| = √(R² + Xc²)', `R = ${fmt(R)} Ω, C = ${fmt(C)} F, f = ${fmt(f)} Hz\nXc = 1 / (2 × π × ${fmt(f)} × ${fmt(C)}) = ${fmt(Xc)} Ω\n|Z| = √(${fmt(R)}² + ${fmt(Xc)}²)`, `|Z| = ${fmt(Z)} Ω`);
        } else if (acCalc === 'impSeriesRLC') {
          const R = needFinite('Resistance R', val('acR'), { nonNegative: true });
          const L = needFinite('Inductance L', val('acL'), { nonNegative: true });
          const C = needFinite('Capacitance C', val('acC'), { positive: true });
          const f = needFinite('Frequency f', val('acF'), { positive: true });
          const Xl = 2 * Math.PI * f * L;
          const Xc = 1 / (2 * Math.PI * f * C);
          const X = Xl - Xc;
          const Z = Math.sqrt(R * R + X * X);
          res = `${fmt(Z)} Ω`; expr = 'AC: impedance series RLC';
          html = resultBlock(`Xl = ${fmt(Xl)} Ω\nXc = ${fmt(Xc)} Ω\nX = Xl - Xc = ${fmt(X)} Ω`, 'Xl = 2πfL\nXc = 1 / (2πfC)\n|Z| = √(R² + (Xl - Xc)²)', `R = ${fmt(R)} Ω, L = ${fmt(L)} H, C = ${fmt(C)} F, f = ${fmt(f)} Hz\nXl = ${fmt(Xl)} Ω, Xc = ${fmt(Xc)} Ω\n|Z| = √(${fmt(R)}² + (${fmt(X)})²)`, `|Z| = ${fmt(Z)} Ω`);
        }
      }
      setResult(html);
      window.HistoryStore.addEntry({
        module: 'Electrical Engineering',
        moduleId: 'electrical',
        expression: expr,
        result: res,
        payload: gatherPayload()
      });
    } catch (err) {
      setResult('');
      setError(window.EngiCalc.friendlyMathError(err));
    }
  }

  function parseResistors(id) {
    const raw = document.getElementById(id).value.trim();
    if (!raw) throw new Error('Please enter at least one resistor value.');
    const parts = raw.split(/[\s,;]+/).filter(Boolean);
    const nums = parts.map(p => {
      const n = parseFloat(p);
      if (Number.isNaN(n)) throw new Error(`Invalid resistor value: "${p}".`);
      return n;
    });
    if (nums.length === 0) throw new Error('Please enter at least one resistor value.');
    return nums;
  }

  function gatherPayload() {
    const tool = document.getElementById('elecTool').value;
    const payload = { tool };
    const ids = ['ohmsSolve','ohmsV','ohmsI','ohmsR','pwrSolve','pwrP','pwrV','pwrI','pwrR','seriesValues','parallelValues','acCalc','acFPsolve','acF','acT','acC','acL','acR'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) payload[id] = el.value; });
    return payload;
  }

  function reuse(payload) {
    if (!payload) return;
    if (payload.tool) document.getElementById('elecTool').value = payload.tool;
    renderFields();
    // allow subfields to render
    if (payload.acCalc) {
      const ac = document.getElementById('acCalc');
      if (ac) { ac.value = payload.acCalc; renderAcFields(); }
    }
    Object.keys(payload).forEach(k => {
      const el = document.getElementById(k);
      if (el && k !== 'tool') el.value = payload[k];
    });
  }

  window.ElectricalModule = { init, reuse };
})();