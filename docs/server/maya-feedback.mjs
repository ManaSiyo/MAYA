// A failed read must never become an empty inbox. Generation preconditions
// protect feedback written by different Cloud Run instances at the same time.
import crypto from 'node:crypto';

export function createFeedbackStore({ load, save }) {
  async function read() {
    const rec = await load();
    if (!rec || !Array.isArray(rec.items)) throw new Error('invalid feedback store');
    return structuredClone(rec);
  }
  async function mutate(change) {
    for (let attempt = 0; ; attempt++) {
      const rec = await read();
      const result = change(rec);
      if (result === null) return null;
      try { await save(rec); return result; }
      catch (e) { if (e.status !== 412 || attempt >= 4) throw e; }
    }
  }
  return {
    read,
    // Used by the existing MCP completion workflow. A stale edit fails safely.
    save,
    async append(text, who, source = 'voice') {
      const wording = String(text || '').trim().slice(0, 4000);
      if (!wording) return null;
      const item = { id: 'f_' + crypto.randomBytes(6).toString('hex'),
        ts: new Date().toISOString(), who: String(who || 'fromsa').trim().slice(0, 80),
        text: wording, source, done: false };
      return mutate(rec => { rec.items.push(item); return rec.items.length; });
    },
    async complete(id, done) {
      return mutate(rec => {
        const item = rec.items.find(i => i.id === id);
        if (!item) return null;
        item.done = done;
        item.doneTs = done ? new Date().toISOString() : null;
        return done;
      });
    },
  };
}
