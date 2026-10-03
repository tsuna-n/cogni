// One ordered queue per signed-in workspace. Failed saves remain pending for retry.
let owner = '';
/** @type {Map<string, unknown>} */
let pending = new Map();
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;
let tail = Promise.resolve();
/** @typedef {{ fields?: Record<string, string | boolean>, journey?: object, history?: object[], markers?: object[] }} WorkspaceForm */
/** @type {Record<string, unknown> & { workspace?: WorkspaceForm }} */
let forms = {};
/** @param {string} status */
const report = (status) => window.dispatchEvent(new CustomEvent('forms-save-status', { detail: status }));
/** @param {string} email @param {Record<string, unknown> & { workspace?: WorkspaceForm }} initialForms */
export function initializeForms(email, initialForms) {
  clearTimeout(timer);
  owner = email;
  pending = new Map();
  forms = initialForms;
}
export function getWorkspaceForm() { return forms.workspace || {}; }
export function hasUnsavedForms() { return pending.size > 0; }
/** @param {string} email @param {string} key @param {unknown} value */
export function queueFormSave(email, key, value) {
  if (!email || email !== owner) return;
  forms[key] = structuredClone(value);
  pending.set(key, forms[key]);
  report('pending');
  clearTimeout(timer);
  timer = setTimeout(() => { flushForms().catch(() => {}); }, 500);
}
/** @param {string} email @param {WorkspaceForm} changes */
export function queueWorkspaceSave(email, changes) {
  queueFormSave(email, 'workspace', { ...getWorkspaceForm(), ...changes });
}
/** @param {{ keepalive?: boolean }} options */
export function flushForms({ keepalive = false } = {}) {
  clearTimeout(timer);
  const run = tail.catch(() => {}).then(async () => {
    while (pending.size) {
      const entry = pending.entries().next().value;
      if (!entry) break;
      const [key, value] = entry;
      try {
        const response = await fetch('/api/forms', { method: 'PUT', keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (pending.get(key) === value) pending.delete(key);
      } catch (error) { report('error'); throw error; }
    }
    report('saved');
  });
  tail = run;
  return run;
}
