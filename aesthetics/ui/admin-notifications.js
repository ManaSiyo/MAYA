/* Private operational history. Only fixed source/code states leave the page. */
(() => {
  window.createMayaAdminNotifications = ({context, current}) => {
    const host = document.getElementById('admin-notification-list');
    const feedback = document.getElementById('notifications-feedback');
    let epoch = 0, readSequence = 0, revision = 0, timer = null, writing = null;
    const pending = new Map(), observed = new Map();
    const say = text => { if (feedback) feedback.textContent = text; };
    const valid = (owner, generation) => generation === epoch && current(owner);
    function render(items) {
      if (!host) return;
      host.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('p'); empty.dataset.mayaType = 'P1';
        empty.textContent = 'No saved notifications yet.'; host.append(empty); return;
      }
      for (const item of items.slice(0, 200)) {
        const article = document.createElement('article');
        article.className = 'admin-notification'; article.dataset.mayaPanel = 'inner';
        const time = document.createElement('time'); time.dataset.mayaType = 'P3';
        const date = new Date(item.ts);
        time.textContent = Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : '';
        if (time.textContent) time.dateTime = date.toISOString();
        const text = document.createElement('p'); text.dataset.mayaType = 'P1';
        text.textContent = typeof item.text === 'string' ? item.text : 'Operational status recorded.';
        article.append(time, text); host.append(article);
      }
    }
    async function flush() {
      if (writing) return writing;
      const owner = context(), generation = epoch;
      if (!owner.token || !pending.size) return;
      const updates = [...pending].slice(0, 16).map(([source, code]) => ({source, code}));
      for (const item of updates) pending.delete(item.source);
      let saved = false;
      const operation = (async () => {
        try {
          const response = await fetch('/api/admin/notifications', {method:'POST', headers:{Authorization:'Bearer ' + owner.token, 'Content-Type':'application/json'}, cache:'no-store', signal:AbortSignal.timeout(10000), body:JSON.stringify({items:updates})});
          const result = await response.json();
          if (!valid(owner, generation)) return;
          if (!response.ok || !result.ok || !Array.isArray(result.items)) throw Error('unavailable');
          revision++; render(result.items); say(''); saved = true;
        } catch (_) {
          if (!valid(owner, generation)) return;
          for (const item of updates) if (!pending.has(item.source)) pending.set(item.source, item.code);
          say('Notification history could not be saved. Current status is available below. Use Refresh to try again.');
        }
      })();
      writing = operation;
      await operation;
      if (writing === operation) writing = null;
      if (saved && pending.size && valid(owner, generation) && timer === null) timer = setTimeout(() => {timer = null; void flush();}, 40);
    }
    function record(items) {
      if (!context().token || !Array.isArray(items)) return;
      let changed = false;
      for (const item of items) {
        if (!item || typeof item.source !== 'string' || typeof item.code !== 'string' || observed.get(item.source) === item.code) continue;
        observed.set(item.source, item.code); pending.set(item.source, item.code); changed = true;
      }
      if (changed && timer === null) timer = setTimeout(() => {timer = null; void flush();}, 40);
    }
    async function load() {
      const owner = context(), generation = epoch, sequence = ++readSequence;
      if (!owner.token) { if (host) host.replaceChildren(); say('Sign in to read notifications.'); return; }
      clearTimeout(timer); timer = null;
      await flush();
      if (!valid(owner, generation) || sequence !== readSequence) return;
      const version = revision;
      try {
        const response = await fetch('/api/admin/notifications', {headers:{Authorization:'Bearer ' + owner.token}, cache:'no-store', signal:AbortSignal.timeout(10000)});
        const result = await response.json();
        if (!valid(owner, generation) || sequence !== readSequence || version !== revision) return;
        if (!response.ok || !result.ok || !Array.isArray(result.items)) throw Error('unavailable');
        render(result.items);
        if (!pending.size) say('');
      } catch (_) {
        if (valid(owner, generation) && sequence === readSequence) say('Notification history could not be loaded. Current status is available below. Use Refresh to try again.');
      }
    }
    function reset() {
      epoch++; readSequence++; revision++; clearTimeout(timer); timer = null;
      pending.clear(); observed.clear(); writing = null;
      if (host) host.replaceChildren(); say('');
      document.getElementById('maya-logs-list')?.replaceChildren();
      for (const element of document.querySelectorAll('#notification-current [data-notification-status]')) {element.replaceChildren(); element.style.display = 'none';}
      const logs = document.getElementById('maya-logs-disclosure'); if (logs) logs.open = false;
      const details = document.getElementById('notification-current'); if (details) details.open = false;
    }
    window.addEventListener('maya-owner-session-changed', reset);
    return {record, load, reset};
  };
})();
