// Historical Admin editor; not loaded by any served page. See README.md.
// Prompting engine. Live copy: Firestore config/prompting, the app reads it at boot.
// If the vault rules deny the shared doc, falls back to a per-account draft at
// users/{uid}/settings/prompting so nothing typed here is lost.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD2rCqPDjiyS1yfZj8ghtDc-mepz3LY634",
  authDomain: "pro-maya.firebaseapp.com",
  projectId: "pro-maya",
  storageBucket: "pro-maya.firebasestorage.app",
  messagingSenderId: "53947659283",
  appId: "1:53947659283:web:4779127af7d5b229867be6",
};
let _fbUser = null;
const _peKeys = ['character', 'background', 'style', 'body'];
let _peBaseline = '', _peEdit = 0, _peLoadSeq = 0, _peBridgeSeq = 0, _peSaving = null, _peLoading = null, _peReady = false;
const _peEditedFields = new Set();
function _peValues() { return Object.fromEntries(_peKeys.map(k => [k, document.getElementById('pe-' + k).value])); }
function _peDirty() { return JSON.stringify(_peValues()) !== _peBaseline; }
function _peState(t) { const el = document.getElementById('pe-state'); if (el) el.textContent = t; }
function _peContext() { return { admin: _adminContext(), uid: _fbUser?.uid }; }
function _peCurrent(context) {
  return !!context.uid && _adminContextCurrent(context.admin) && context.uid === _fbUser?.uid &&
    context.uid === firebase.auth().currentUser?.uid;
}
_peBaseline = JSON.stringify(_peValues());
for (const k of _peKeys) document.getElementById('pe-' + k).addEventListener('input', () => {
  _peEdit++; _peEditedFields.add(k);
  if (!_peSaving) _peState('Unsaved changes.');
});
window.addEventListener('maya-owner-session-changed', () => {
  ++_peBridgeSeq; ++_peLoadSeq; ++_peEdit; _fbUser = null; _peSaving = null; _peLoading = null; _peReady = false; _peEditedFields.clear();
  for (const k of _peKeys) document.getElementById('pe-' + k).value = '';
  _peBaseline = JSON.stringify(_peValues());
  document.getElementById('pe-save').disabled = false;
  _peState('Sign in above to load this account.');
});
function _fbBridge(idToken) {
  const admin = _adminContext(), sequence = ++_peBridgeSeq;
  const current = () => sequence === _peBridgeSeq && _adminContextCurrent(admin);
  try {
    if (!window.firebase || !firebase.auth) return;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const cred = firebase.auth.GoogleAuthProvider.credential(idToken);
    firebase.auth().signInWithCredential(cred)
      .then(u => {
        if (!current()) return;
        const google = u.user?.providerData?.find(p => p.providerId === 'google.com');
        if (!u.user?.uid || (google && google.uid !== admin.subject)) throw Error('account_mismatch');
        _fbUser = u.user;
        if (!_peCurrent(_peContext())) throw Error('account_mismatch');
        return loadPrompting();
      })
      .catch(() => { if (current()) _peState('Could not link to the vault. Sign in again.'); });
  } catch (_) { if (current()) _peState('Could not link to the vault. Sign in again.'); }
}
function _peRefs(uid) {
  const db = firebase.firestore();
  return { live: db.collection('config').doc('prompting'),
           draft: db.collection('users').doc(uid).collection('settings').doc('prompting') };
}
async function loadPrompting() {
  const context = _peContext();
  if (!_peCurrent(context) || _peSaving || (_peReady && _peDirty())) return;
  if (_peLoading) return _peLoading.promise;
  const loading = {}; _peLoading = loading;
  loading.promise = _peRead(context);
  try { await loading.promise; } finally { if (_peLoading === loading) _peLoading = null; }
}
async function _peRead(context) {
  const sequence = ++_peLoadSeq, edit = _peEdit, { live, draft } = _peRefs(context.uid);
  const current = () => sequence === _peLoadSeq && !_peSaving && _peCurrent(context);
  const results = await Promise.allSettled([live.get(), draft.get()]);
  if (!current() || (_peReady && (edit !== _peEdit || _peDirty()))) return;
  const data = result => result.status === 'fulfilled' && result.value.exists ? result.value.data() : null;
  const liveWords = data(results[0]), draftWords = data(results[1]);
  const stamp = words => Date.parse(words?.updatedAt) || 0;
  const from = draftWords && (!liveWords || stamp(draftWords) > stamp(liveWords)) ? 'draft' : liveWords ? 'live' : '';
  const d = from === 'draft' ? draftWords : liveWords;
  if (!d && results.some(r => r.status === 'rejected')) { _peState('Saved words could not be loaded. Your current words are kept.'); return; }
  const words = Object.fromEntries(_peKeys.map(k => [k, typeof d?.[k] === 'string' ? d[k] : '']));
  for (const k of _peKeys) if (_peReady || !_peEditedFields.has(k)) document.getElementById('pe-' + k).value = words[k];
  _peBaseline = JSON.stringify(words); _peReady = true;
  if (_peDirty()) { _peState('Saved words loaded. Your edits remain unsaved.'); return; }
  _peState((from === 'live' ? 'live, the app reads these words' :
           from === 'draft' ? 'Private draft restored. Live app unchanged; retry Save to publish.' :
           'nothing saved yet: MAYA currently draws with only the baked layers above, write here to add words') +
           (from === 'live' && results[1].status === 'rejected' ? ' Private draft could not be checked.' : ''));
}
async function savePrompting() {
  const context = _peContext();
  if (!_peCurrent(context)) { _peState('Sign in above before saving.'); return; }
  if (_peSaving) return;
  if (!_peReady) {
    _peState('Loading saved words before saving…');
    try { await loadPrompting(); } catch (_) { if (_peCurrent(context)) _peState('Saved words could not be loaded. Your current words are kept.'); }
    if (_peCurrent(context) && _peReady) _peState('Saved words loaded. Review them, then press Save.');
    return;
  }
  const values = _peValues(), snapshot = JSON.stringify(values), save = {};
  const body = {
    ...Object.fromEntries(_peKeys.map(k => [k, values[k].trim()])),
    updatedAt: new Date().toISOString(),
    updatedBy: _fbUser.email || ''
  };
  _peSaving = save; ++_peLoadSeq;
  const button = document.getElementById('pe-save'); button.disabled = true;
  const current = () => _peSaving === save && _peCurrent(context);
  const saved = text => {
    if (!current()) return;
    _peBaseline = snapshot;
    _peState(text + (_peDirty() ? ' Your newer changes are unsaved.' : ''));
  };
  _peState('saving…');
  try {
    const { live, draft } = _peRefs(context.uid);
    try { await live.set(body); saved('Saved live. The app reads these words.'); return; } catch (_) {}
    if (!current()) return;
    await draft.set(body); saved('Saved as a private draft. Live app unchanged; retry Save to publish.');
  } catch (e) { if (current()) _peState('Could not save (' + (e?.code || 'error') + '). Your words are kept; retry Save.');
  } finally { if (_peSaving === save) { _peSaving = null; button.disabled = false; } }
}
