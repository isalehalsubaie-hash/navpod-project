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
  const PATCH_KEYS = ["status", "verification", "verifiedDate", "description", "notes", "deadline", "tracks", "userEdited"];
  function compact(S) {
    const seed = SEEDJ(), byId = new Map(seed.jobs.map((j) => [j.id, j]));
    const o = Object.assign({}, S);
    const tracked = new Set((S.applications || []).map((a) => a.jobId));
    o.jobs = S.jobs.filter((j) => !byId.has(j.id) || tracked.has(j.jobId)); // tracked research jobs are kept in full so they survive research updates
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
    const seedIds = new Set(jobs.map((j) => j.id));
    o.jobs = jobs.concat((o.jobs || []).filter((j) => !seedIds.has(j.id))); delete o.jobPatches;
    o.excluded = JSON.parse(JSON.stringify(seed.excluded)); o.market = JSON.parse(JSON.stringify(seed.market));
    if (o.master.pdfB64 === "__SEED__") o.master.pdfB64 = seed.master.pdfB64;
    if (o.master.docxB64 === "__SEED__") o.master.docxB64 = seed.master.docxB64;
    o.master.model = null;
    return o;
  }
  const CHUNK = 300000;
  /* Saves are atomic: a changed chunk is written to the slot ("a" or "b") that the current meta record does NOT use,
     and the meta record (the list of slots) is written last. If the page closes mid-save, the previous meta still
     points at a complete, consistent set of chunks. Old saves (no slots) are read as before. */
  let last = [], lastSlots = [];
  const key = (i, slot) => "careeros_" + i + (slot ? "_" + slot : "");
  H.load = async () => {
    const col = await getStore(); if (!col) return null;
    const meta = val(await col.doc("careeros_meta").get());
    if (!meta || !meta.n) return null;
    const slots = Array.isArray(meta.slots) && meta.slots.length === meta.n ? meta.slots : new Array(meta.n).fill("");
    const parts = [];
    for (let i = 0; i < meta.n; i++) { const c = val(await col.doc(key(i, slots[i])).get()); if (!c || typeof c.s !== "string") throw new Error("Saved data is incomplete (part " + (i + 1) + " of " + meta.n + ")"); parts.push(c.s); }
    const o = JSON.parse(parts.join(""));
    last = parts.slice(); lastSlots = slots.slice();
    return expand(o);
  };
  let busy = Promise.resolve();
  H.save = (S) => {
    const json = JSON.stringify(compact(S));
    busy = busy.then(async () => {
      const col = await getStore(); if (!col) return;
      const parts = []; for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
      if (parts.length === last.length && parts.every((p, i) => last[i] === p)) return;
      const slots = parts.map((p, i) => (last[i] === p && lastSlots[i] !== undefined ? lastSlots[i] : lastSlots[i] === "a" ? "b" : "a"));
      for (let i = 0; i < parts.length; i++) if (!(last[i] === parts[i] && lastSlots[i] === slots[i])) await col.doc(key(i, slots[i])).set({ s: parts[i] });
      await col.doc("careeros_meta").set({ n: parts.length, slots, savedAt: new Date().toISOString() });
      last = parts; lastSlots = slots;
    }).catch((e) => { console.warn(e); window.toast && toast("Could not save: " + (e.message || e), 5000); });
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
  H.sample = () => withTimeout(cap("sample"), 10000);
  H.mcp = async () => {
    const m = await withTimeout(cap("mcp"), 10000); if (!m) return null;
    return { callTool: async (server, tool, input) => {
      if (typeof m.callTool === "function") return m.callTool(server, tool, input);
      if (typeof m.server === "function") { const s = await m.server(server); return { payload: await s[tool](input) }; }
      throw new Error("Connector API not available");
    } };
  };
  return H;
})();
