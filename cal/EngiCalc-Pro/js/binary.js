(function () {
  function init() {
    if (!document.getElementById('binOperation')) return;
    document.getElementById('binOperation').addEventListener('change', renderFields);
    document.getElementById('binCalcBtn').addEventListener('click', calculate);
    document.getElementById('binClearBtn').addEventListener('click', clearAll);
    document.getElementById('binCopyBtn').addEventListener('click', () => window.EngiCalc.copyText(document.getElementById('binResult').innerText));
    document.getElementById('binExampleBtn').addEventListener('click', applyExample);
    renderFields();
  }

  function setError(msg) { const el = document.getElementById('binError'); if (el) el.textContent = msg || ''; }
  function setResult(html) { document.getElementById('binResult').innerHTML = html || ''; }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function getBitWidth() {
    const raw = document.getElementById('binBitWidth').value.trim();
    if (raw === '') return 8;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 4096) {
      throw new Error('Bit width must be an integer between 1 and 4096.');
    }
    return n;
  }

  function validateBinary(str, label) {
    const s = String(str).trim();
    if (s === '') throw new Error(label + ' is required.');
    if (!/^[01]+$/.test(s)) throw new Error(label + ' must contain only 0 and 1.');
    return s;
  }
  function validateHex(str, label) {
    const s = String(str).trim();
    if (s === '') throw new Error(label + ' is required.');
    if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error(label + ' must contain valid hexadecimal characters (0-9, A-F).');
    return s.toUpperCase();
  }
  function validateOctal(str, label) {
    const s = String(str).trim();
    if (s === '') throw new Error(label + ' is required.');
    if (!/^[0-7]+$/.test(s)) throw new Error(label + ' must contain only octal digits (0-7).');
    return s;
  }
  function parseDecimalInt(str, label) {
    const s = String(str).trim();
    if (s === '') throw new Error(label + ' is required.');
    if (!/^[+-]?\d+$/.test(s)) throw new Error(label + ' must be a valid integer (decimal).');
    return BigInt(s);
  }

  function maskForWidth(width) {
    return (1n << BigInt(width)) - 1n;
  }
  function toUnsignedInWidth(value, width) {
    return value & maskForWidth(width);
  }
  function toBinaryString(value, minWidth) {
    if (value < 0n) return '-' + (-value).toString(2);
    const s = value.toString(2);
    return s.padStart(minWidth || 1, '0');
  }
  function formatGrouped(binStr) {
    const neg = binStr.startsWith('-');
    let s = neg ? binStr.slice(1) : binStr;
    s = s.replace(/^0+(?=\d)/, '') || '0';
    // group from right in 4s for readability
    const groups = [];
    for (let i = s.length; i > 0; i -= 4) groups.unshift(s.slice(Math.max(0, i - 4), i));
    return (neg ? '-' : '') + groups.join(' ');
  }
  function unsignedFromBinaryStr(binStr) {
    return BigInt('0b' + binStr);
  }
  function signedFromBinaryStr(binStr, width) {
    const u = unsignedInWidthFromBits(binStr, width);
    const signBit = 1n << BigInt(width - 1);
    if ((u & signBit) !== 0n) {
      return u - (1n << BigInt(width));
    }
    return u;
  }
  function unsignedInWidthFromBits(binStr, width) {
    if (binStr.length > width) throw new Error('Binary value requires ' + binStr.length + ' bits but the selected bit width is ' + width + '. Increase the bit width.');
    return BigInt('0b' + binStr) & maskForWidth(width);
  }
  function twosComplement(value, width) {
    const mod = 1n << BigInt(width);
    const mask = maskForWidth(width);
    let u = ((value % mod) + mod) & mask;
    return u;
  }
  function signedRange(width) {
    const min = -(1n << BigInt(width - 1));
    const max = (1n << BigInt(width - 1)) - 1n;
    return { min, max };
  }
  function unsignedRange(width) {
    return { min: 0n, max: (1n << BigInt(width)) - 1n };
  }
  function fitsSigned(value, width) {
    const r = signedRange(width);
    return value >= r.min && value <= r.max;
  }
  function fitsUnsigned(value, width) {
    const r = unsignedRange(width);
    return value >= r.min && value <= r.max;
  }
  function binOfUnsigned(u, width) {
    return u.toString(2).padStart(width, '0');
  }

  function renderFields() {
    const op = document.getElementById('binOperation').value;
    const fields = document.getElementById('binFields');
    const bitWrap = document.getElementById('binBitWidthWrap');
    let showBit = true; // useful broadly; we can hide for pure conversions that don't need it
    let html = '';
    const binA = (label, id, ph) => `<label>${label} <input type="text" id="${id}" spellcheck="false" placeholder="${ph || 'e.g. 1011'}"></label>`;
    const txt = (label, id, ph) => `<label>${label} <input type="text" id="${id}" spellcheck="false" placeholder="${ph || ''}"></label>`;
    if (op === 'dec-bin') {
      showBit = true;
      html = `${txt('Decimal integer', 'binInputA', 'e.g. 25 or -25')}
              <p class="hint" style="grid-column:1/-1;margin:0;">Converts a decimal integer to binary. For negative values, the result is shown as two's complement using the selected bit width (with overflow noted if it does not fit).</p>`;
    } else if (op === 'bin-dec') {
      showBit = true;
      html = `${binA('Binary value', 'binInputA', 'e.g. 11001')}
              <label>Interpretation
                <select id="binSignedMode">
                  <option value="unsigned">Unsigned</option>
                  <option value="signed">Signed (two's complement)</option>
                </select>
              </label>
              <p class="hint" style="grid-column:1/-1;margin:0;">Unsigned reads the bit pattern as a non-negative integer. Signed interprets it in two's complement within the selected bit width.</p>`;
    } else if (op === 'bin-hex') {
      showBit = false;
      html = `${binA('Binary value', 'binInputA', 'e.g. 1111')}`;
    } else if (op === 'hex-bin') {
      showBit = false;
      html = `${txt('Hexadecimal value', 'binInputA', 'e.g. 1F')}`;
    } else if (op === 'bin-oct') {
      showBit = false;
      html = `${binA('Binary value', 'binInputA', 'e.g. 1111')}`;
    } else if (op === 'oct-bin') {
      showBit = false;
      html = `${txt('Octal value', 'binInputA', 'e.g. 17')}`;
    } else if (op === 'add' || op === 'sub' || op === 'mul' || op === 'div') {
      showBit = true;
      html = `${binA('Binary operand A', 'binInputA', 'e.g. 101')}
              ${binA('Binary operand B', 'binInputB', 'e.g. 11')}
              <label>Interpret operands as
                <select id="binSignedMode">
                  <option value="unsigned">Unsigned</option>
                  <option value="signed">Signed (two's complement)</option>
                </select>
              </label>
              <p class="hint" style="grid-column:1/-1;margin:0;">Arithmetic uses BigInt for arbitrary-size integers (not JavaScript 32-bit bitwise operators). Signed mode interprets inputs and results in two's complement at the selected bit width. Division shows quotient and remainder.</p>`;
    } else if (op === 'and' || op === 'or' || op === 'xor') {
      showBit = true;
      html = `${binA('Binary operand A', 'binInputA', 'e.g. 1010')}
              ${binA('Binary operand B', 'binInputB', 'e.g. 1100')}
              <p class="hint" style="grid-column:1/-1;margin:0;">Bitwise operations are performed with BigInt on fixed-width patterns (masked to the selected bit width). Inputs shorter than the bit width are zero-extended on the left.</p>`;
    } else if (op === 'not') {
      showBit = true;
      html = `${binA('Binary operand', 'binInputA', 'e.g. 1010')}
              <p class="hint" style="grid-column:1/-1;margin:0;">NOT inverts all bits within the selected bit width (BigInt with masking). Inputs shorter than the bit width are zero-extended before inversion.</p>`;
    } else if (op === 'repr') {
      showBit = true;
      html = `${txt('Input value', 'binInputA', 'e.g. 11001 or -25')}
              <label>Input type
                <select id="binInputType">
                  <option value="binary">Binary bit pattern</option>
                  <option value="decimal">Decimal integer</option>
                </select>
              </label>
              <p class="hint" style="grid-column:1/-1;margin:0;">Shows unsigned and signed two's-complement interpretations at the selected bit width and explains range/overflow limitations.</p>`;
    }
    fields.innerHTML = html;
    bitWrap.style.display = showBit ? '' : 'none';
  }

  function line(label, value) { return `<div class="result-line"><strong>${esc(label)}</strong></div><pre>${esc(value)}</pre>`; }

  function calculate() {
    setError('');
    try {
      const op = document.getElementById('binOperation').value;
      let html = '', expr = '', res = '', payload = { op };

      if (op === 'dec-bin') {
        const dec = parseDecimalInt(document.getElementById('binInputA').value, 'Decimal integer');
        const width = getBitWidth();
        payload = { op, dec: dec.toString(), width };
        if (dec >= 0n) {
          const bin = dec.toString(2);
          const overflow = !fitsUnsigned(dec, width);
          const padded = overflow ? bin : binOfUnsigned(dec, width);
          const notes = [];
          notes.push('Decimal: ' + dec.toString());
          notes.push('Binary (magnitude): ' + bin);
          if (!overflow) notes.push('Binary padded to ' + width + ' bits (unsigned): ' + padded);
          else notes.push('Unsigned ' + width + '-bit range is 0 to ' + unsignedRange(width).max.toString() + '; value does not fit in ' + width + ' bits (overflow for fixed width). Full binary magnitude shown.');
          notes.push('Note: Fixed-width storage limits values. Use the bit width/representation options for fixed-width forms; for signed fixed-width form of negative values, use a negative decimal input.');
          html = line('Operation', 'Decimal to binary') + line('Result', bin) + line('Explanation', notes.join('\n'));
          res = bin; expr = 'Decimal ' + dec.toString() + ' → binary';
        } else {
          const u = twosComplement(dec, width);
          const out = binOfUnsigned(u, width);
          const fits = fitsSigned(dec, width);
          const r = signedRange(width);
          const notes = [];
          notes.push('Decimal: ' + dec.toString());
          notes.push('Negative values are represented in binary using two\'s complement at a fixed bit width.');
          notes.push('Selected bit width: ' + width + ' bits (signed range ' + r.min.toString() + ' to ' + r.max.toString() + ')');
          notes.push('Two\'s complement (' + width + '-bit): ' + out);
          notes.push(fits ? 'Value fits within the selected signed range.' : 'Overflow: value does NOT fit in ' + width + '-bit signed two\'s complement. The shown pattern is value mod 2^' + width + ' (wrapped). Increase bit width for a correct signed representation.');
          html = line('Operation', 'Decimal to binary (two\'s complement for negative)') + line('Result', out) + line('Explanation', notes.join('\n'));
          res = out; expr = 'Decimal ' + dec.toString() + ' → binary (' + width + '-bit two\'s complement)';
        }
      } else if (op === 'bin-dec') {
        const bin = validateBinary(document.getElementById('binInputA').value, 'Binary value');
        const width = getBitWidth();
        const mode = document.getElementById('binSignedMode').value;
        payload = { op, bin, width, mode };
        const unsignedVal = unsignedInWidthFromBits(bin, width);
        if (mode === 'unsigned') {
          // also allow values wider than width? we validated <= width
          const actualUnsigned = BigInt('0b' + bin);
          const notes = [];
          notes.push('Binary input: ' + bin);
          notes.push('Unsigned decimal value: ' + actualUnsigned.toString());
          notes.push('Interpreted with selected bit width (' + width + '): pattern ' + binOfUnsigned(unsignedVal, width));
          notes.push('Unsigned ' + width + '-bit range: 0 to ' + unsignedRange(width).max.toString() + '.');
          html = line('Operation', 'Binary to decimal (unsigned)') + line('Result', actualUnsigned.toString()) + line('Explanation', notes.join('\n'));
          res = actualUnsigned.toString(); expr = 'Binary ' + bin + ' → decimal (unsigned)';
        } else {
          if (width < 1) throw new Error('Bit width must be at least 1 for signed interpretation.');
          const signedVal = signedFromBinaryStr(bin, width);
          const r = signedRange(width);
          const pattern = binOfUnsigned(unsignedInWidthFromBits(bin, width), width);
          const notes = [];
          notes.push('Binary input: ' + bin);
          notes.push('Interpreted as ' + width + '-bit pattern: ' + pattern);
          notes.push('Signed two\'s-complement decimal value: ' + signedVal.toString());
          notes.push('Signed ' + width + '-bit range: ' + r.min.toString() + ' to ' + r.max.toString() + '.');
          notes.push('Most significant bit of the fixed-width pattern is the sign bit in two\'s complement.');
          html = line('Operation', 'Binary to decimal (signed two\'s complement)') + line('Result', signedVal.toString()) + line('Explanation', notes.join('\n'));
          res = signedVal.toString(); expr = 'Binary ' + bin + ' → decimal (signed ' + width + '-bit)';
        }
      } else if (op === 'bin-hex') {
        const bin = validateBinary(document.getElementById('binInputA').value, 'Binary value');
        payload = { op, bin };
        const valBig = BigInt('0b' + bin);
        const hex = valBig.toString(16).toUpperCase();
        html = line('Operation', 'Binary to hexadecimal') + line('Result', hex) + line('Explanation', 'Binary: ' + bin + '\nDecimal (unsigned): ' + valBig.toString() + '\nHexadecimal: ' + hex);
        res = hex; expr = 'Binary ' + bin + ' → hex';
      } else if (op === 'hex-bin') {
        const hex = validateHex(document.getElementById('binInputA').value, 'Hexadecimal value');
        payload = { op, hex };
        const valBig = BigInt('0x' + hex);
        const bin = valBig.toString(2);
        html = line('Operation', 'Hexadecimal to binary') + line('Result', bin) + line('Explanation', 'Hexadecimal: ' + hex + '\nDecimal (unsigned): ' + valBig.toString() + '\nBinary: ' + bin);
        res = bin; expr = 'Hex ' + hex + ' → binary';
      } else if (op === 'bin-oct') {
        const bin = validateBinary(document.getElementById('binInputA').value, 'Binary value');
        payload = { op, bin };
        const valBig = BigInt('0b' + bin);
        const oct = valBig.toString(8);
        html = line('Operation', 'Binary to octal') + line('Result', oct) + line('Explanation', 'Binary: ' + bin + '\nDecimal (unsigned): ' + valBig.toString() + '\nOctal: ' + oct);
        res = oct; expr = 'Binary ' + bin + ' → octal';
      } else if (op === 'oct-bin') {
        const oct = validateOctal(document.getElementById('binInputA').value, 'Octal value');
        payload = { op, oct };
        const valBig = BigInt('0o' + oct);
        const bin = valBig.toString(2);
        html = line('Operation', 'Octal to binary') + line('Result', bin) + line('Explanation', 'Octal: ' + oct + '\nDecimal (unsigned): ' + valBig.toString() + '\nBinary: ' + bin);
        res = bin; expr = 'Octal ' + oct + ' → binary';
      } else if (['add','sub','mul','div'].includes(op)) {
        const aStr = validateBinary(document.getElementById('binInputA').value, 'Binary operand A');
        const bStr = validateBinary(document.getElementById('binInputB').value, 'Binary operand B');
        const width = getBitWidth();
        const mode = document.getElementById('binSignedMode').value;
        payload = { op, a: aStr, b: bStr, width, mode };
        let aVal, bVal;
        if (mode === 'signed') {
          aVal = signedFromBinaryStr(aStr, width);
          bVal = signedFromBinaryStr(bStr, width);
        } else {
          aVal = unsignedFromBinaryStr(aStr);
          bVal = unsignedFromBinaryStr(bStr);
        }
        const notes = [];
        notes.push('Mode: ' + (mode === 'signed' ? 'Signed two\'s complement (' + width + '-bit inputs)' : 'Unsigned'));
        notes.push('A = ' + aStr + ' (decimal ' + aVal.toString() + ')');
        notes.push('B = ' + bStr + ' (decimal ' + bVal.toString() + ')');
        notes.push('Arithmetic performed with BigInt (not 32-bit JavaScript bitwise operators).');
        if (op === 'add') {
          const r = aVal + bVal;
          const bin = r >= 0n ? r.toString(2) : '-' + (-r).toString(2);
          notes.push('A + B = ' + r.toString());
          if (mode === 'signed') {
            const fits = fitsSigned(r, width);
            const tw = binOfUnsigned(twosComplement(r, width), width);
            notes.push('Fixed-width (' + width + '-bit) two\'s complement result pattern: ' + tw + (fits ? ' (no overflow)' : ' (overflow/wrapped — value outside signed range ' + signedRange(width).min.toString() + ' to ' + signedRange(width).max.toString() + ')'));
          } else {
            notes.push('Unsigned fixed-width check (' + width + ' bits): ' + (fitsUnsigned(r, width) ? 'fits' : 'overflow (exceeds ' + unsignedRange(width).max.toString() + ')'));
          }
          html = line('Operation', 'Binary addition') + line('Result', bin) + line('Explanation', notes.join('\n'));
          res = bin; expr = aStr + ' + ' + bStr;
        } else if (op === 'sub') {
          const r = aVal - bVal;
          const bin = r >= 0n ? r.toString(2) : '-' + (-r).toString(2);
          notes.push('A - B = ' + r.toString());
          if (mode === 'signed') {
            const fits = fitsSigned(r, width);
            const tw = binOfUnsigned(twosComplement(r, width), width);
            notes.push('Fixed-width (' + width + '-bit) two\'s complement result pattern: ' + tw + (fits ? ' (no overflow)' : ' (overflow/wrapped — value outside signed range ' + signedRange(width).min.toString() + ' to ' + signedRange(width).max.toString() + ')'));
          } else {
            notes.push(r < 0n ? 'Unsigned subtraction underflow: mathematical result is negative (' + r.toString() + '). In fixed-width unsigned arithmetic this would wrap modulo 2^' + width + '.' : 'Unsigned fixed-width check (' + width + ' bits): ' + (fitsUnsigned(r, width) ? 'fits' : 'overflow'));
            if (r < 0n) notes.push('Wrapped ' + width + '-bit unsigned pattern: ' + binOfUnsigned(twosComplement(r, width), width));
          }
          html = line('Operation', 'Binary subtraction') + line('Result', bin) + line('Explanation', notes.join('\n'));
          res = bin; expr = aStr + ' - ' + bStr;
        } else if (op === 'mul') {
          const r = aVal * bVal;
          const bin = r >= 0n ? r.toString(2) : '-' + (-r).toString(2);
          notes.push('A × B = ' + r.toString());
          if (mode === 'signed') {
            const fits = fitsSigned(r, width);
            const tw = binOfUnsigned(twosComplement(r, width), width);
            notes.push('Fixed-width (' + width + '-bit) two\'s complement result pattern: ' + tw + (fits ? ' (no overflow)' : ' (overflow/wrapped — value outside signed range ' + signedRange(width).min.toString() + ' to ' + signedRange(width).max.toString() + ')'));
          } else {
            notes.push('Unsigned fixed-width check (' + width + ' bits): ' + (fitsUnsigned(r, width) ? 'fits' : 'overflow (exceeds ' + unsignedRange(width).max.toString() + ')'));
          }
          html = line('Operation', 'Binary multiplication') + line('Result', bin) + line('Explanation', notes.join('\n'));
          res = bin; expr = aStr + ' × ' + bStr;
        } else if (op === 'div') {
          if (bVal === 0n) throw new Error('Division by zero is not allowed.');
          // Truncating division; remainder has same sign as dividend in mathematical truncation choice
          let q = aVal / bVal; // BigInt trunc toward zero
          let rem = aVal % bVal;
          const qBin = q >= 0n ? q.toString(2) : '-' + (-q).toString(2);
          const rBin = rem >= 0n ? rem.toString(2) : '-' + (-rem).toString(2);
          notes.push('Quotient (truncated toward zero): ' + q.toString() + ' (binary ' + qBin + ')');
          notes.push('Remainder: ' + rem.toString() + ' (binary ' + rBin + ')');
          notes.push('Check: A = B × Q + R → ' + bVal.toString() + ' × ' + q.toString() + ' + ' + rem.toString() + ' = ' + (bVal * q + rem).toString());
          if (mode === 'signed') {
            notes.push('Signed ' + width + '-bit range: ' + signedRange(width).min.toString() + ' to ' + signedRange(width).max.toString() + '. Quotient fits: ' + (fitsSigned(q, width) ? 'yes' : 'no (overflow)') + ', remainder fits: ' + (fitsSigned(rem, width) ? 'yes' : 'no') + '.');
          }
          html = line('Operation', 'Binary division') + line('Quotient', qBin) + line('Remainder', rBin) + line('Explanation', notes.join('\n'));
          res = 'Q=' + qBin + ', R=' + rBin; expr = aStr + ' ÷ ' + bStr;
        }
      } else if (['and','or','xor','not'].includes(op)) {
        const width = getBitWidth();
        const mask = maskForWidth(width);
        const aStr = validateBinary(document.getElementById('binInputA').value, op === 'not' ? 'Binary operand' : 'Binary operand A');
        const aU = unsignedInWidthFromBits(aStr, width);
        payload = { op, a: aStr, width };
        let resultU, opName, sym, details = [];
        if (op === 'not') {
          resultU = (~aU) & mask;
          opName = 'Bitwise NOT'; sym = 'NOT';
          details.push('Operand A (zero-extended to ' + width + ' bits): ' + binOfUnsigned(aU, width));
          details.push('NOT flips every bit within the selected bit width.');
        } else {
          const bStr = validateBinary(document.getElementById('binInputB').value, 'Binary operand B');
          const bU = unsignedInWidthFromBits(bStr, width);
          payload.b = bStr;
          details.push('Operand A (zero-extended to ' + width + ' bits): ' + binOfUnsigned(aU, width));
          details.push('Operand B (zero-extended to ' + width + ' bits): ' + binOfUnsigned(bU, width));
          if (op === 'and') { resultU = (aU & bU) & mask; opName = 'Bitwise AND'; sym = 'AND'; }
          else if (op === 'or') { resultU = (aU | bU) & mask; opName = 'Bitwise OR'; sym = 'OR'; }
          else { resultU = (aU ^ bU) & mask; opName = 'Bitwise XOR'; sym = 'XOR'; }
        }
        const out = binOfUnsigned(resultU, width);
        details.push('Bit width: ' + width + ' (fixed-width masking applied using BigInt; no 32-bit JavaScript bitwise operators).');
        details.push('Unsigned decimal of result: ' + resultU.toString());
        const signedRes = signedFromBinaryStr(out, width);
        details.push('Signed two\'s-complement interpretation of result (' + width + '-bit): ' + signedRes.toString());
        html = line('Operation', opName) + line('Result (' + width + '-bit)', out) + line('Explanation', details.join('\n'));
        res = out; expr = (op === 'not') ? ('NOT ' + aStr) : (aStr + ' ' + sym + ' ' + (payload.b || ''));
      } else if (op === 'repr') {
        const width = getBitWidth();
        const inputType = document.getElementById('binInputType').value;
        const raw = document.getElementById('binInputA').value;
        payload = { op, width, inputType, raw: String(raw).trim() };
        let value;
        let sourceDesc = '';
        if (inputType === 'binary') {
          const bin = validateBinary(raw, 'Binary bit pattern');
          // interpret pattern in given width
          if (bin.length > width) throw new Error('Binary pattern requires ' + bin.length + ' bits but the selected bit width is ' + width + '. Increase the bit width.');
          const u = unsignedInWidthFromBits(bin, width);
          value = { u, binPattern: binOfUnsigned(u, width) };
          sourceDesc = 'Input binary pattern: ' + bin + ' (interpreted in ' + width + ' bits as ' + value.binPattern + ')';
        } else {
          const dec = parseDecimalInt(raw, 'Decimal integer');
          const u = twosComplement(dec, width);
          value = { dec, u, binPattern: binOfUnsigned(u, width) };
          sourceDesc = 'Input decimal integer: ' + dec.toString();
        }
        const uVal = value.u;
        const sVal = signedFromBinaryStr(value.binPattern, width);
        const ur = unsignedRange(width);
        const sr = signedRange(width);
        const notes = [];
        notes.push(sourceDesc);
        notes.push('Bit width: ' + width);
        notes.push('');
        notes.push('Unsigned binary (' + width + '-bit): ' + value.binPattern);
        notes.push('Unsigned decimal value: ' + uVal.toString());
        notes.push('Unsigned range for ' + width + ' bits: ' + ur.min.toString() + ' to ' + ur.max.toString());
        notes.push('');
        notes.push('Signed two\'s-complement interpretation: ' + sVal.toString());
        notes.push('Signed range for ' + width + ' bits: ' + sr.min.toString() + ' to ' + sr.max.toString());
        if (value.dec != null) {
          const fitsS = fitsSigned(value.dec, width);
          const fitsU = fitsUnsigned(value.dec, width);
          notes.push('');
          notes.push('Fit/overflow analysis for decimal input:');
          notes.push('Fits unsigned ' + width + '-bit: ' + (fitsU ? 'yes' : 'no'));
          notes.push('Fits signed ' + width + '-bit two\'s complement: ' + (fitsS ? 'yes' : 'no'));
          if (!fitsU && value.dec >= 0n) notes.push('Overflow: value exceeds unsigned maximum; stored pattern wraps modulo 2^' + width + '.');
          if (!fitsS) notes.push('Signed overflow/underflow: two\'s-complement representation wraps modulo 2^' + width + ' and may change sign when interpreted.');
        } else {
          notes.push('');
          notes.push('Note: The same bit pattern can represent different values depending on whether it is interpreted as unsigned or signed two\'s complement.');
        }
        notes.push('');
        notes.push('Two\'s-complement limitations: fixed bit width determines representable range; arithmetic overflow wraps around (mod 2^n). Increasing bit width extends range but does not make it unbounded.');
        html = line('Operation', 'Number representation (unsigned & signed two\'s complement)') + line('Result', 'Unsigned: ' + uVal.toString() + ' | Signed: ' + sVal.toString() + ' | Binary: ' + value.binPattern) + line('Explanation', notes.join('\n'));
        res = value.binPattern; expr = 'Representation at ' + width + ' bits';
      }

      setResult(html);
      window.HistoryStore.addEntry({
        module: 'Binary Calculator',
        moduleId: 'binary',
        expression: expr,
        result: res,
        payload
      });
    } catch (err) {
      setResult('');
      setError(window.EngiCalc.friendlyMathError ? window.EngiCalc.friendlyMathError(err) : (err && err.message ? err.message : String(err)));
    }
  }

  function clearAll() {
    document.getElementById('binOperation').value = 'dec-bin';
    document.getElementById('binBitWidth').value = '8';
    renderFields();
    setError('');
    setResult('');
  }

  function applyExample() {
    const op = document.getElementById('binOperation').value;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    document.getElementById('binBitWidth').value = '8';
    renderFields();
    if (op === 'dec-bin') { set('binInputA', '25'); }
    else if (op === 'bin-dec') { set('binInputA', '11001'); set('binSignedMode', 'unsigned'); }
    else if (op === 'bin-hex') { set('binInputA', '1111'); }
    else if (op === 'hex-bin') { set('binInputA', '1F'); }
    else if (op === 'bin-oct') { set('binInputA', '1111'); }
    else if (op === 'oct-bin') { set('binInputA', '17'); }
    else if (op === 'add') { set('binInputA', '101'); set('binInputB', '11'); set('binSignedMode', 'unsigned'); }
    else if (op === 'sub') { set('binInputA', '1010'); set('binInputB', '0011'); set('binSignedMode', 'unsigned'); }
    else if (op === 'mul') { set('binInputA', '101'); set('binInputB', '11'); set('binSignedMode', 'unsigned'); }
    else if (op === 'div') { set('binInputA', '1100'); set('binInputB', '10'); set('binSignedMode', 'unsigned'); }
    else if (op === 'and') { set('binInputA', '1101'); set('binInputB', '1011'); }
    else if (op === 'or') { set('binInputA', '1101'); set('binInputB', '1011'); }
    else if (op === 'xor') { set('binInputA', '1101'); set('binInputB', '1011'); }
    else if (op === 'not') { set('binInputA', '00001101'); document.getElementById('binBitWidth').value = '8'; }
    else if (op === 'repr') { set('binInputA', '-25'); set('binInputType', 'decimal'); document.getElementById('binBitWidth').value = '8'; }
    setError('');
  }

  function reuse(payload) {
    if (!payload) return;
    if (payload.op) document.getElementById('binOperation').value = payload.op;
    if (payload.width != null) document.getElementById('binBitWidth').value = payload.width;
    renderFields();
    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    set('binInputA', payload.a != null ? payload.a : (payload.bin != null ? payload.bin : (payload.hex != null ? payload.hex : (payload.oct != null ? payload.oct : (payload.dec != null ? payload.dec : payload.raw)))));
    set('binInputB', payload.b);
    set('binSignedMode', payload.mode);
    if (payload.inputType) set('binInputType', payload.inputType);
    // restore specific fields if different mapping
    if (payload.op === 'dec-bin' && payload.dec != null) set('binInputA', payload.dec);
    if (payload.op === 'bin-dec' && payload.bin != null) set('binInputA', payload.bin);
    if (payload.op === 'bin-hex' && payload.bin != null) set('binInputA', payload.bin);
    if (payload.op === 'hex-bin' && payload.hex != null) set('binInputA', payload.hex);
    if (payload.op === 'bin-oct' && payload.bin != null) set('binInputA', payload.bin);
    if (payload.op === 'oct-bin' && payload.oct != null) set('binInputA', payload.oct);
    if (payload.op === 'repr' && payload.raw != null) set('binInputA', payload.raw);
    setError('');
  }

  window.BinaryModule = { init, reuse };
})();