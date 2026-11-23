(function () {
  const categories = {
    'Length': {
      base: 'm',
      units: { m: 1, km: 1000, cm: 0.01, mm: 0.001, um: 1e-6, nm: 1e-9, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 }
    },
    'Mass': {
      base: 'kg',
      units: { kg: 1, g: 0.001, mg: 1e-6, ug: 1e-9, lb: 0.45359237, oz: 0.028349523125, tonne: 1000 }
    },
    'Time': {
      base: 's',
      units: { s: 1, ms: 0.001, us: 1e-6, ns: 1e-9, min: 60, h: 3600, day: 86400 }
    },
    'Temperature': {
      special: true
    },
    'Energy': {
      base: 'J',
      units: { J: 1, kJ: 1000, MJ: 1e6, Wh: 3600, kWh: 3.6e6, cal: 4.184, kcal: 4184, eV: 1.602176634e-19, BTU: 1055.05585262 }
    },
    'Power': {
      base: 'W',
      units: { W: 1, mW: 0.001, kW: 1000, MW: 1e6, hp: 745.699871582 }
    },
    'Voltage': {
      base: 'V',
      units: { V: 1, mV: 0.001, uV: 1e-6, kV: 1000, MV: 1e6 }
    },
    'Current': {
      base: 'A',
      units: { A: 1, mA: 0.001, uA: 1e-6, nA: 1e-9, kA: 1000 }
    },
    'Resistance': {
      base: 'ohm',
      units: { ohm: 1, mohm: 0.001, kohm: 1000, Mohm: 1e6 }
    },
    'Frequency': {
      base: 'Hz',
      units: { Hz: 1, kHz: 1000, MHz: 1e6, GHz: 1e9, rpm: 1 / 60 }
    }
  };

  const unitLabels = {
    um: 'µm', ug: 'µg', us: 'µs', uV: 'µV', uA: 'µA', ohm: 'Ω', mohm: 'mΩ', kohm: 'kΩ', Mohm: 'MΩ'
  };

  const constants = [
    { name: 'Pi', symbol: 'π', value: '3.141592653589793', unit: '—' },
    { name: "Euler's number", symbol: 'e', value: '2.718281828459045', unit: '—' },
    { name: 'Speed of light in vacuum', symbol: 'c', value: '299792458', unit: 'm/s' },
    { name: 'Standard gravitational acceleration', symbol: 'g', value: '9.80665', unit: 'm/s²' },
    { name: 'Elementary charge', symbol: 'e⁻ charge', value: '1.602176634e-19', unit: 'C' },
    { name: "Planck's constant", symbol: 'h', value: '6.62607015e-34', unit: 'J·s' },
    { name: 'Permittivity of free space', symbol: 'ε₀', value: '8.8541878128e-12', unit: 'F/m' },
    { name: 'Permeability of free space', symbol: 'μ₀', value: '1.25663706212e-6', unit: 'N/A²' }
  ];

  function init() {
    if (!document.getElementById('convCategory')) return;
    const cat = document.getElementById('convCategory');
    cat.innerHTML = Object.keys(categories).map(c => `<option value="${c}">${c}</option>`).join('');
    cat.addEventListener('change', populateUnits);
    document.getElementById('convBtn').addEventListener('click', convert);
    document.getElementById('convCopyBtn').addEventListener('click', () => window.EngiCalc.copyText(document.getElementById('convResult').innerText));
    populateUnits();
    renderConstants();
    convert();
  }

  function label(u) { return unitLabels[u] || u; }

  function populateUnits() {
    const category = document.getElementById('convCategory').value;
    const from = document.getElementById('convFrom');
    const to = document.getElementById('convTo');
    let units;
    if (category === 'Temperature') units = ['C', 'F', 'K'];
    else units = Object.keys(categories[category].units);
    const options = units.map(u => `<option value="${u}">${label(u)}</option>`).join('');
    from.innerHTML = options; to.innerHTML = options;
    if (units.length > 1) to.selectedIndex = 1;
  }

  function setError(msg) { document.getElementById('convError').textContent = msg || ''; }
  function setResult(text) { document.getElementById('convResult').innerHTML = text; }

  function convertTemperature(value, from, to) {
    let c;
    if (from === 'C') c = value;
    else if (from === 'F') c = (value - 32) * 5 / 9;
    else if (from === 'K') c = value - 273.15;
    else throw new Error('Unknown temperature unit.');
    if (from === 'K' && value < 0) throw new Error('Temperature in kelvin cannot be below 0 K.');
    if (from === 'C' && value < -273.15) throw new Error('Temperature cannot be below absolute zero (-273.15 °C).');
    if (from === 'F' && value < -459.67) throw new Error('Temperature cannot be below absolute zero (-459.67 °F).');
    let out;
    if (to === 'C') out = c;
    else if (to === 'F') out = c * 9 / 5 + 32;
    else if (to === 'K') out = c + 273.15;
    if (to === 'K' && out < -1e-12) throw new Error('Result would be below 0 K, which is not physically valid.');
    return out;
  }

  function convert() {
    setError('');
    try {
      const category = document.getElementById('convCategory').value;
      const value = parseFloat(document.getElementById('convValue').value);
      const from = document.getElementById('convFrom').value;
      const to = document.getElementById('convTo').value;
      if (Number.isNaN(value)) throw new Error('Please enter a valid numeric value to convert.');
      let out;
      if (category === 'Temperature') {
        out = convertTemperature(value, from, to);
      } else {
        const def = categories[category];
        const baseValue = value * def.units[from];
        out = baseValue / def.units[to];
      }
      const formatted = `${window.EngiCalc.formatNumber(value)} ${label(from)} = ${window.EngiCalc.formatNumber(out)} ${label(to)}`;
      setResult(`<pre>${formatted}</pre>`);
      window.HistoryStore.addEntry({
        module: 'Conversions & Constants',
        moduleId: 'conversions',
        expression: `${category}: ${window.EngiCalc.formatNumber(value)} ${label(from)} → ${label(to)}`,
        result: `${window.EngiCalc.formatNumber(out)} ${label(to)}`,
        payload: { category, value, from, to }
      });
    } catch (err) {
      setResult('');
      setError(window.EngiCalc.friendlyMathError(err));
    }
  }

  function renderConstants() {
    const body = document.getElementById('constantsBody');
    body.innerHTML = constants.map(c => `<tr><td>${c.name}</td><td class="mono">${c.symbol}</td><td class="mono">${c.value}</td><td>${c.unit}</td></tr>`).join('');
  }

  function reuse(payload) {
    if (!payload) return;
    if (payload.category) document.getElementById('convCategory').value = payload.category;
    populateUnits();
    if (payload.value != null) document.getElementById('convValue').value = payload.value;
    if (payload.from) document.getElementById('convFrom').value = payload.from;
    if (payload.to) document.getElementById('convTo').value = payload.to;
  }

  window.ConversionsModule = { init, reuse };
})();