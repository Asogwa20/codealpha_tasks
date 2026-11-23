(function () {
  const STORAGE_KEY = 'engiCalcHistory';

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function addEntry(entry) {
    const items = loadHistory();
    items.unshift({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      expression: entry.expression || '',
      result: entry.result || '',
      module: entry.module || '',
      moduleId: entry.moduleId || '',
      timestamp: entry.timestamp || new Date().toISOString(),
      payload: entry.payload || null
    });
    if (items.length > 200) items.length = 200;
    saveHistory(items);
    renderHistory();
  }

  function clearHistory() {
    saveHistory([]);
    renderHistory();
  }

  function formatTimestamp(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function renderHistory() {
    const body = document.getElementById('historyBody');
    const empty = document.getElementById('historyEmpty');
    if (!body) return;
    const items = loadHistory();
    body.innerHTML = '';
    if (empty) empty.style.display = items.length ? 'none' : 'block';
    items.forEach(item => {
      const tr = document.createElement('tr');
      const canReuse = item.moduleId && item.payload;
      tr.innerHTML = `
        <td>${formatTimestamp(item.timestamp)}</td>
        <td>${escapeHtml(item.module)}</td>
        <td class="mono">${escapeHtml(item.expression)}</td>
        <td class="mono">${escapeHtml(item.result)}</td>
        <td>${canReuse ? '<button type="button" class="secondary-btn" data-history-id="' + item.id + '">Reuse</button>' : '<span class="muted">—</span>'}</td>
      `;
      body.appendChild(tr);
    });
    body.querySelectorAll('button[data-history-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-history-id');
        const items = loadHistory();
        const entry = items.find(i => i.id === id);
        if (entry && window.EngiCalc && typeof window.EngiCalc.reuseHistoryEntry === 'function') {
          window.EngiCalc.reuseHistoryEntry(entry);
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.HistoryStore = {
    loadHistory,
    addEntry,
    clearHistory,
    renderHistory
  };
})();