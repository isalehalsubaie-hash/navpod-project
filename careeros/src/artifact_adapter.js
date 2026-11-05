/* CareerOS hosted-page adapter: used only in CareerOS_web.html (private claude.ai page).
   Saves state to the viewer's private per-person store (data/users/<id>/), uses the platform
   download prompt, routes inside the page, and disables printing. */
window.CAREEROS_HOOKS = (function () {
  const H = { internalRouting: true, noPrint: true };
  const cap = (n) => (window.claude && typeof window.claude.use === "function" ? window.claude.use(n) : Promise.resolve(null));
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  let store = null;
  function getStore() {
    if (!store) store = (async () => {
      const db = await withTimeout(cap("db"), 10000); if (!db) return null;
      const user = await withTimeout(cap("user"), 10000); if (!user) return null;
      const id = await user.id(); if (!id) return null;
      return db.collection("data/users/" + id);
    })().catch((e) => { console.warn("CareerOS store unavailable", e); return null; });
    return store;
  }
  const val = (r) => (r == null ? null : typeof r.data === "function" ? r.data() : r.data !== undefined && r.exists !== undefined ? r.data : r);
  const SEEDJ = () => window.CAREEROS_SEED;
  const PATCH_KEYS = ["status", "verification", "verifiedDate", "description", "notes", "deadline", "tracks"];
  function compact(S) {
    const seed = SEEDJ(), byId = new Map(seed.jobs.map((j) => [j.id, j]));
    const o = Object.assign({}, S);
    o.jobs = S.jobs.filter((j) => !byId.has(j.id));
    o.jobPatches = {};
    for (const j of S.jobs) { const s = byId.get(j.id); if (!s) continue; const p = {}; for (const k of PATCH_KEYS) if (JSON.stringify(j[k]) !== JSON.stringify(s[k])) p[k] = j[k]; if (Object.keys(p).length) o.jobPatches[j.id] = p; }
    delete o.excluded; delete o.market;
    o.master = Object.assign({}, S.master); delete o.master.model;
    if (o.master.pdfB64 === seed.master.pdfB64) o.master.pdfB64 = "__SEED__";
    if (o.master.docxB64 === seed.master.docxB64) o.master.docxB64 = "__SEED__";
    return o;
  }
  function expand(o) {
    const seed = SEEDJ();
    const jobs = JSON.parse(JSON.stringify(seed.jobs)).map((j) => Object.assign(j, (o.jobPatches || {})[j.id] || {}));
    o.jobs = jobs.concat(o.jobs || []); delete o.jobPatches;
    o.excluded = JSON.parse(JSON.stringify(seed.excluded)); o.market = JSON.parse(JSON.stringify(seed.market));
    if (o.master.pdfB64 === "__SEED__") o.master.pdfB64 = seed.master.pdfB64;
    if (o.master.docxB64 === "__SEED__") o.master.docxB64 = seed.master.docxB64;
    o.master.model = null;
    return o;
  }
  const CHUNK = 300000;
  let last = [];
  H.load = async () => {
    const col = await getStore(); if (!col) return null;
    const meta = val(await col.doc("careeros_meta").get());
    if (!meta || !meta.n) return null;
    const parts = [];
    for (let i = 0; i < meta.n; i++) { const c = val(await col.doc("careeros_" + i).get()); if (!c || typeof c.s !== "string") return null; parts.push(c.s); }
    last = parts.slice();
    return expand(JSON.parse(parts.join("")));
  };
  let busy = Promise.resolve();
  H.save = (S) => {
    const json = JSON.stringify(compact(S));
    busy = busy.then(async () => {
      const col = await getStore(); if (!col) return;
      const parts = []; for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      for (let i = 0; i < parts.length; i++) if (last[i] !== parts[i]) await col.doc("careeros_" + i).set({ s: parts[i] });
      if (last.length !== parts.length || parts.some((p, i) => last[i] !== p)) await col.doc("careeros_meta").set({ n: parts.length, savedAt: new Date().toISOString() });
      last = parts;
    }).catch((e) => { console.warn(e); });
    return busy;
  };
  H.download = async (name, blob) => {
    const d = await withTimeout(cap("downloads"), 10000);
    if (!d) { window.toast && toast("Downloads are not available in this view.", 5000); return; }
    try { await d.save({ filename: name, data: blob }); }
    catch (e) {
      try { await d.save({ filename: name, data: new Uint8Array(await blob.arrayBuffer()) }); }
      catch (e2) { if (!/declin|cancel|abort/i.test(String(e2 && (e2.code || e2.message)))) toast("Download did not complete: " + (e2.message || e2), 5000); }
    }
  };
  return H;
})();
