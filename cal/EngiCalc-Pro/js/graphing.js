(function () {
  let chart = null;

  function init() {
    if (!document.getElementById('graphPlotBtn')) return;
    document.getElementById('graphPlotBtn').addEventListener('click', plot);
    document.getElementById('graphClearBtn').addEventListener('click', clearGraph);
  }

  function setError(msg) { document.getElementById('graphError').textContent = msg || ''; }

  function compileFn(expr) {
    try {
      const compiled = math.parse(expr).compile();
      return (x) => {
        const val = compiled.evaluate({ x, pi: math.pi, e: math.e });
        if (typeof val === 'number') return val;
        if (val && typeof val.toNumber === 'function') return val.toNumber();
        if (val && val.re !== undefined && Math.abs(val.im || 0) < 1e-12) return val.re;
        const num = Number(val);
        return num;
      };
    } catch (err) {
      throw new Error('Could not parse function f(x): ' + window.EngiCalc.friendlyMathError(err));
    }
  }

  function plot() {
    setError('');
    const expr = document.getElementById('graphFunction').value.trim();
    const minX = parseFloat(document.getElementById('graphMinX').value);
    const maxX = parseFloat(document.getElementById('graphMaxX').value);
    let samples = parseInt(document.getElementById('graphSamples').value, 10);
    if (!expr) { setError('Please enter a function f(x).'); return; }
    if ([minX, maxX].some(v => Number.isNaN(v))) { setError('Please enter valid numeric min and max x-values.'); return; }
    if (minX >= maxX) { setError('Minimum x must be less than maximum x.'); return; }
    if (Number.isNaN(samples) || samples < 20) samples = 20;
    if (samples > 1000) samples = 1000;
    document.getElementById('graphSamples').value = samples;

    try {
      const f = compileFn(expr);
      const labels = [];
      const data = [];
      const plotted = [];
      let invalidCount = 0;
      const step = (maxX - minX) / (samples - 1);
      for (let i = 0; i < samples; i++) {
        const x = minX + i * step;
        let y;
        try { y = f(x); } catch { y = NaN; }
        const valid = typeof y === 'number' && isFinite(y);
        labels.push(x);
        data.push(valid ? y : null);
        if (valid) plotted.push({ x, y });
        else invalidCount++;
      }
      if (plotted.length === 0) {
        throw new Error('The function could not be evaluated for any point in the selected range. Try a different function or x-range.');
      }
      renderChart(expr, labels, data);
      renderValues(plotted);
      if (invalidCount > 0) {
        setError(`Plotted with ${invalidCount} point(s) skipped because the function was undefined or not a finite real value at those x-values.`);
      }
      window.HistoryStore.addEntry({
        module: 'Graphing',
        moduleId: 'graphing',
        expression: `f(x) = ${expr}, x ∈ [${minX}, ${maxX}]`,
        result: `${plotted.length} plotted points`,
        payload: { expr, minX, maxX, samples }
      });
    } catch (err) {
      setError(window.EngiCalc.friendlyMathError(err));
    }
  }

  function renderChart(expr, labels, data) {
    const ctx = document.getElementById('graphCanvas').getContext('2d');
    const dark = document.body.classList.contains('dark');
    const grid = dark ? 'rgba(232,238,252,0.12)' : 'rgba(23,33,51,0.12)';
    const text = dark ? '#e8eefc' : '#172133';
    const color = dark ? '#5b8cff' : '#1f5eff';
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `f(x) = ${expr}`,
          data,
          borderColor: color,
          backgroundColor: color,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0,
          spanGaps: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'x', color: text },
            ticks: { color: text, maxTicksLimit: 10, callback: (v) => window.EngiCalc.formatNumber(v) },
            grid: { color: grid }
          },
          y: {
            title: { display: true, text: 'f(x)', color: text },
            ticks: { color: text, callback: (v) => window.EngiCalc.formatNumber(v) },
            grid: { color: grid }
          }
        },
        plugins: {
          legend: { labels: { color: text } },
          tooltip: {
            callbacks: {
              title: (items) => 'x = ' + window.EngiCalc.formatNumber(items[0].parsed.x),
              label: (item) => 'f(x) = ' + window.EngiCalc.formatNumber(item.parsed.y)
            }
          }
        }
      }
    });
  }

  function renderValues(points) {
    const body = document.getElementById('graphValuesBody');
    const maxRows = 200;
    const step = Math.max(1, Math.ceil(points.length / maxRows));
    let html = '';
    for (let i = 0; i < points.length; i += step) {
      const p = points[i];
      html += `<tr><td class="mono">${window.EngiCalc.formatNumber(p.x)}</td><td class="mono">${window.EngiCalc.formatNumber(p.y)}</td></tr>`;
    }
    body.innerHTML = html || '<tr><td colspan="2">No plotted values.</td></tr>';
  }

  function clearGraph() {
    if (chart) { chart.destroy(); chart = null; }
    const ctx = document.getElementById('graphCanvas').getContext('2d');
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    document.getElementById('graphValuesBody').innerHTML = '';
    setError('');
  }

  function onThemeChange() {
    // Re-render with same chart config by triggering plot if chart exists and inputs are present
    if (chart) {
      const expr = document.getElementById('graphFunction').value.trim();
      if (expr) plot();
    }
  }

  function reuse(payload) {
    if (!payload) return;
    if (payload.expr != null) document.getElementById('graphFunction').value = payload.expr;
    if (payload.minX != null) document.getElementById('graphMinX').value = payload.minX;
    if (payload.maxX != null) document.getElementById('graphMaxX').value = payload.maxX;
    if (payload.samples != null) document.getElementById('graphSamples').value = payload.samples;
  }

  window.GraphingModule = { init, reuse, onThemeChange };
})();