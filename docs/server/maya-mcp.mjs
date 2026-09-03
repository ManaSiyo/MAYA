// MAYA's own door. v14.02.
//
// This is the Model Context Protocol server that makes Maya an entity other
// agents can talk to: Claude (Cowork, claude.ai custom connector), Codex, or
// any MCP client. It speaks Streamable HTTP (one POST per JSON-RPC message,
// JSON reply, no SSE stream) and exposes Maya's memory, soul, people, feature
// inbox and lead station as tools. Reads are plain; the two writes (journal,
// feature_done) are the same ones Maya herself performs on the voice line.
//
// Pure module: it receives store functions and never touches the network, so
// tests/maya-mcp.mjs can drive it with fakes. server.js wires the real GCS
// stores and guards the route with MAYA_MCP_TOKEN.
export const MCP_PROTOCOL = '2025-06-18';

const TOOLS = [
  { name: 'maya_status',
    description: 'Who Maya is right now: server version, what is configured, how many memories, people and open feature requests she holds.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'maya_inbox',
    description: 'The feature inbox: everything Fromsa, teammates or customers asked Maya for that MAYA does not do yet. Newest first. This is the work queue Claude ships from once Fromsa approves.',
    inputSchema: { type: 'object', properties: {
      open: { type: 'boolean', description: 'true (default) hides items already marked done' },
      limit: { type: 'integer', minimum: 1, maximum: 200, description: 'default 50' } },
      additionalProperties: false } },
  { name: 'maya_feature_done',
    description: 'Mark a feature request shipped, by id, after Fromsa approved it and it is built. Adds a note about the version that carried it.',
    inputSchema: { type: 'object', required: ['id'], properties: {
      id: { type: 'string' }, note: { type: 'string', description: 'e.g. shipped in v14.03' } },
      additionalProperties: false } },
  { name: 'maya_memory',
    description: 'Maya\'s saved facts (the things she was told to remember on the voice line), newest last.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 200 } }, additionalProperties: false } },
  { name: 'maya_people',
    description: 'The people Maya knows: name, role, aliases, note.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'maya_soul',
    description: 'Maya\'s soul: who she is plus her running journal, as markdown. Read this before changing anything about her.',
    inputSchema: { type: 'object', properties: { tail: { type: 'integer', description: 'return only the last N characters' } }, additionalProperties: false } },
  { name: 'maya_journal',
    description: 'Write one dated line into Maya\'s soul journal so she carries it into her next conversation. Use for decisions and shipped work.',
    inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string', maxLength: 1000 } }, additionalProperties: false } },
  { name: 'maya_leads',
    description: 'The Lead Station, read only: name, email, source, tier, last quote and latest note for every lead.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 500 } }, additionalProperties: false } },
];

function text(obj) {
  return { content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] };
}
function err(id, code, message) {
  return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } };
}

export function createMayaMcp(stores = {}) {
  const S = {
    version: 'dev', configured: () => ({}),
    loadFeatures: async () => ({ items: [] }), saveFeatures: async () => {},
    loadMemory: async () => ({ items: [] }),
    loadPeople: async () => ({ items: [] }),
    loadSoul: async () => '', appendSoul: async () => true,
    loadLeads: async () => ({ leads: [] }),
    ...stores,
  };
  async function call(name, args) {
    const a = args && typeof args === 'object' ? args : {};
    switch (name) {
      case 'maya_status': {
        const [f, m, p] = await Promise.all([S.loadFeatures(), S.loadMemory(), S.loadPeople()]);
        const open = (f.items || []).filter(i => !i.done).length;
        return text({ maya: 'here', version: S.version, protocol: MCP_PROTOCOL, configured: S.configured(),
          memories: (m.items || []).length, people: (p.items || []).length, openFeatureRequests: open,
          note: 'Writes on the voice line stay confirmation gated in Admin. This door only journals and marks features done.' });
      }
      case 'maya_inbox': {
        const f = await S.loadFeatures();
        const open = a.open !== false;
        const limit = Math.min(200, Math.max(1, Number(a.limit) || 50));
        const items = (f.items || []).filter(i => !open || !i.done).slice().reverse().slice(0, limit)
          .map(i => ({ id: i.id, when: i.ts, who: i.who, ask: i.text, source: i.source, done: !!i.done, note: i.note || undefined }));
        return text({ count: items.length, items });
      }
      case 'maya_feature_done': {
        const id = String(a.id || '').trim();
        if (!id) throw new Error('id required');
        const f = await S.loadFeatures();
        const hit = (f.items || []).find(i => i.id === id);
        if (!hit) throw new Error('no feature with id ' + id);
        hit.done = true; hit.doneTs = new Date().toISOString();
        if (a.note) hit.note = String(a.note).slice(0, 200);
        await S.saveFeatures(f);
        return text({ ok: true, id, ask: hit.text });
      }
      case 'maya_memory': {
        const m = await S.loadMemory();
        const limit = Math.min(200, Math.max(1, Number(a.limit) || 60));
        return text({ items: (m.items || []).slice(-limit) });
      }
      case 'maya_people': {
        const p = await S.loadPeople();
        return text({ items: p.items || [] });
      }
      case 'maya_soul': {
        let s = String(await S.loadSoul() || '');
        const tail = Number(a.tail) || 0;
        if (tail > 0 && s.length > tail) s = s.slice(-tail);
        return text(s);
      }
      case 'maya_journal': {
        const t = String(a.text || '').trim();
        if (!t) throw new Error('text required');
        await S.appendSoul(t);
        return text({ ok: true });
      }
      case 'maya_leads': {
        const d = await S.loadLeads();
        const limit = Math.min(500, Math.max(1, Number(a.limit) || 100));
        const leads = (d.leads || d.items || []).slice(0, limit).map(l => ({
          name: l.name, email: l.email, phone: l.phone, source: l.source, tier: l.tier,
          lastQuote: l.lastQuote || l.quote, note: l.note || l.latestNote, updated: l.updatedAt || l.ts }));
        return text({ count: leads.length, leads });
      }
      default: throw Object.assign(new Error('unknown tool ' + name), { code: -32602 });
    }
  }
  async function one(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return err(msg && msg.id, -32600, 'invalid request');
    }
    const { id, method, params } = msg;
    const isNotification = id === undefined;
    try {
      let result;
      switch (method) {
        case 'initialize':
          result = { protocolVersion: MCP_PROTOCOL, capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'maya', title: 'Maya, by Mana Siyo', version: S.version },
            instructions: 'Maya is the intelligence layer of Mana Siyo. Read maya_soul and maya_inbox first. ' +
              'Ship only what Fromsa approved; mark it with maya_feature_done and journal what you did.' };
          break;
        case 'ping': result = {}; break;
        case 'tools/list': result = { tools: TOOLS }; break;
        case 'tools/call': {
          const p = params || {};
          try { result = await call(String(p.name || ''), p.arguments); }
          catch (e) {
            if (e && e.code === -32602) return isNotification ? null : err(id, -32602, e.message);
            result = { content: [{ type: 'text', text: 'error: ' + (e && e.message || 'failed') }], isError: true };
          }
          break;
        }
        default:
          if (method.startsWith('notifications/')) return null;
          return isNotification ? null : err(id, -32601, 'method not found: ' + method);
      }
      return isNotification ? null : { jsonrpc: '2.0', id, result };
    } catch (e) {
      return isNotification ? null : err(id, -32603, e && e.message || 'internal error');
    }
  }
  // returns null for a pure notification (HTTP 202, no body), an object, or an array for a batch
  async function handle(body) {
    if (Array.isArray(body)) {
      if (!body.length) return err(null, -32600, 'empty batch');
      const out = (await Promise.all(body.map(one))).filter(Boolean);
      return out.length ? out : null;
    }
    return one(body);
  }
  return { handle, tools: TOOLS, call };
}
