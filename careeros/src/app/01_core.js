/* CareerOS core: state, persistence, routing, helpers. */
"use strict";
const E = window.CareerEngine2 || window.CareerEngine;
const TRACKS = E.TRACKS;
const SEED = window.CAREEROS_SEED;
const TODAY = () => new Date().toISOString().slice(0, 10);
const STATUSES = ["Discovered", "Not reviewed", "Interested", "To apply", "CV prepared", "Applied", "Assessment", "Interview", "Rejected", "Offer received", "Accepted", "Follow-up required", "Withdrawn"];
const SUBMITTED = new Set(["Applied", "Assessment", "Interview", "Rejected", "Offer received", "Accepted", "Follow-up required"]);
let S = null;
/** Large libraries are embedded as text and only executed the first time they are needed. */
const _libs = {};
function loadLib(id) { if (_libs[id]) return; const src = document.getElementById(id); if (!src) throw new Error("Library " + id + " missing"); const s = document.createElement("script"); s.textContent = src.textContent; document.head.appendChild(s); _libs[id] = true; }
const HOOKS = window.CAREEROS_HOOKS || {};

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = (o) => JSON.parse(JSON.stringify(o));
const _fmt = new Map(); const _fmtr = typeof Intl !== "undefined" ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
const fmtDate = (d) => { if (!d) return ""; let v = _fmt.get(d); if (v === undefined) { const dt = new Date(d + (d.length === 10 ? "T00:00:00" : "")); v = isNaN(dt) ? String(d) : _fmtr ? _fmtr.format(dt) : dt.toDateString(); _fmt.set(d, v); } return v; };
const daysUntil = (d) => (d ? Math.round((new Date(d + "T00:00:00") - new Date(TODAY() + "T00:00:00")) / 86400000) : null);
const b64ToBytes = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const bytesToB64 = (u8) => { let s = ""; const c = 0x8000; for (let i = 0; i < u8.length; i += c) s += String.fromCharCode.apply(null, u8.subarray(i, i + c)); return btoa(s); };
function toast(msg, ms) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms || 2800); }
function download(name, data, mime) {
  if (HOOKS.download) return HOOKS.download(name, data instanceof Blob ? data : new Blob([data], { type: mime || "application/octet-stream" }));
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || "application/octet-stream" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const elPill = (l, extra) => `<span class="el ${l}" title="${esc({ GREEN: "Can apply", YELLOW: "Likely eligible, confirm", ORANGE: "Stretch opportunity", RED: "Not currently eligible" }[l] || "")}">${esc(l)}${extra ? " · " + esc(extra) : ""}</span>`;
const stPill = (s) => `<span class="st ${s}">${esc(E.STATUS_LABEL[s] || s)}</span>`;
const trackName = (t) => TRACKS[t] || t;
const meter = (v) => `<div class="meter" title="${v}/100"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;
function modal(html) {
  closeModal();
  const bg = document.createElement("div"); bg.className = "modal-bg"; bg.id = "modal";
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener("click", (e) => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
  const f = bg.querySelector("input,textarea,select"); if (f) f.focus();
}
function closeModal() { const m = document.getElementById("modal"); if (m) m.remove(); }
/** In-page confirmation (browser confirm() is blocked in some viewers). Resolves true or false. */
function ask(msg) {
  if (window.CAREEROS_AUTO_CONFIRM) return Promise.resolve(true);
  return new Promise((res) => {
    const bg = document.createElement("div"); bg.className = "modal-bg"; bg.id = "askmodal"; bg.style.zIndex = 70;
    bg.innerHTML = `<div class="modal" role="alertdialog" style="max-width:460px"><p>${esc(msg)}</p><div class="row mt"><button class="btn primary" id="ask-ok">Yes, continue</button><button class="btn" id="ask-no">Cancel</button></div></div>`;
    const done = (v) => { bg.remove(); res(v); };
    bg.querySelector("#ask-ok").onclick = () => done(true); bg.querySelector("#ask-no").onclick = () => done(false);
    bg.addEventListener("click", (e) => { if (e.target === bg) done(false); });
    document.body.appendChild(bg); bg.querySelector("#ask-ok").focus();
  });
}

// ---------------------------------------------------------------- persistence (IndexedDB, local only)
const DB_NAME = "careeros", STORE = "kv";
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE).objectStore(STORE).get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
async function idbSet(key, val) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(val, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
async function idbClear() { const db = await idb(); return new Promise((res) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).clear(); t.oncomplete = () => res(); }); }
let saveTimer = null;
function save(now) {
  clearTimeout(saveTimer);
  const go = () => Promise.all([HOOKS.save ? null : idbSet("state", S).catch((e) => toast("Could not save: " + e.message)), HOOKS.save ? HOOKS.save(S) : null]).then(() => { S._savedAt = new Date().toISOString(); }).catch((e) => toast("Could not save: " + e.message, 5000));
  if (now) return go();
  saveTimer = setTimeout(go, 600);
}

function freshState() {
  return {
    schema: 1, seedVersion: SEED.seedVersion, researchDate: SEED.researchDate,
    profile: clone(SEED.profile), profileRev: 1,
    jobs: clone(SEED.jobs), excluded: clone(SEED.excluded), companies: clone(SEED.companies), market: clone(SEED.market),
    applications: [], cvVersions: [], packages: [], optim: {},
    settings: { formatLock: true, companionUrl: "http://127.0.0.1:8765", liveSearch: false, discoverView: "cards" },
    master: { kind: "docx", name: SEED.master.docxName, source: SEED.master.docxSource, docxB64: SEED.master.docxB64, pdfB64: SEED.master.pdfB64, pdfName: SEED.master.pdfName, uploadedAt: SEED.researchDate, model: null, pdfText: SEED.master.pdfText || "", approved: false },
    activity: [{ date: SEED.researchDate, text: "Research session: " + SEED.jobs.length + " opportunities loaded" }],
  };
}
function mergeSeed(st) {
  // newer research seeds add jobs/companies without touching user edits
  if ((st.seedVersion || 0) >= SEED.seedVersion) return st;
  // Research jobs are refreshed from the new snapshot; your edits (description, re-check results) are kept.
  // Research jobs dropped from the snapshot are removed unless you are tracking them.
  const seedById = new Map(SEED.jobs.map((j) => [j.id, j]));
  const tracked = new Set((st.applications || []).map((a) => a.jobId));
  let added = 0, removed = 0;
  const kept = [];
  for (const j of st.jobs) {
    const s = seedById.get(j.id);
    if (j.origin === "research_session" && !s) { if (tracked.has(j.jobId)) kept.push(j); else removed++; continue; }
    if (s) {
      const n = clone(s);
      if (j.userEdited) n.description = j.description, n.userEdited = true;
      if (/^Re-checked/.test(j.verification || "")) { n.status = j.status; n.verification = j.verification; n.verifiedDate = j.verifiedDate; }
      kept.push(n);
    } else kept.push(j);
  }
  const have = new Set(kept.map((j) => j.id));
  for (const j of SEED.jobs) if (!have.has(j.id)) { kept.push(clone(j)); added++; }
  st.jobs = kept;
  if (removed) st.activity.unshift({ date: TODAY(), text: "Research update removed " + removed + " listings that no longer qualify" });
  st.excluded = clone(SEED.excluded); st.market = clone(SEED.market);
  const hc = new Set(st.companies.map((c) => c.name));
  for (const c of SEED.companies) if (!hc.has(c.name)) st.companies.push(clone(c));
  st.seedVersion = SEED.seedVersion; st.researchDate = SEED.researchDate;
  st.activity.unshift({ date: TODAY(), text: "Research update merged: " + added + " new opportunities" });
  return st;
}
async function loadState() {
  let st = null;
  try { st = HOOKS.load ? await HOOKS.load() : null; } catch (e) { console.warn(e); }
  if (!st) { try { st = await idbGet("state"); } catch (e) { console.warn(e); } }
  await loadAnalysisCache();
  S = st ? mergeSeed(st) : freshState();
  S.migrations = S.migrations || {};
  if (!S.migrations.gpaPrivate) { const g = S.profile.education.gpa = S.profile.education.gpa || {}; if (!g.value) { g.private = true; g.status = "confirmed_user"; g.note = "You keep your GPA private. CareerOS never asks for it."; } S.migrations.gpaPrivate = true; S.profileRev++; }
  if (!S.master.model && S.master.docxB64) await rebuildMasterModel();
  save(true);
}
async function rebuildMasterModel() {
  try {
    if (S.master.docxB64) {
      S.master.model = await E.readDocx(JSZip, b64ToBytes(S.master.docxB64), DOMParser);
      S.master.model.freeLines = S.master.freeLines != null ? S.master.freeLines : 0;
    }
  } catch (e) { S.master.model = null; toast("Could not read the master DOCX: " + e.message, 5000); }
}

// ---------------------------------------------------------------- computed values (cached)
const cache = new Map();
let evIndex = null;
/* Two caches: the advert analysis depends only on the advert text, so it survives profile edits;
   eligibility, match, coverage and value depend on the profile and are recomputed when it changes. */
const acache = new Map();
let acacheDirty = false, acacheTimer = null;
const ACACHE_KEY = "acache:" + (window.CAREEROS_ENGINE_HASH || "dev");
async function loadAnalysisCache() {
  try { const c = await idbGet(ACACHE_KEY); if (c && c.entries) for (const [id, e] of Object.entries(c.entries)) acache.set(id, e); } catch (e) { /* cache is optional */ }
}
function scheduleAnalysisCacheSave() {
  if (!acacheDirty) return; clearTimeout(acacheTimer);
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 20000 }) : setTimeout(fn, 0));
  acacheTimer = setTimeout(() => idle(async () => {
    acacheDirty = false;
    const entries = {}; for (const [id, e] of acache) { const a = {}; for (const k in e.a) if (k[0] !== "_") a[k] = e.a[k]; entries[id] = { key: e.key, a }; }
    try { const db = await idb(); await new Promise((res) => { const t = db.transaction(STORE, "readwrite"); const st = t.objectStore(STORE); st.put({ entries }, ACACHE_KEY); const r = st.getAllKeys(); r.onsuccess = () => { for (const k of r.result) if (String(k).startsWith("acache:") && k !== ACACHE_KEY) st.delete(k); }; t.oncomplete = res; t.onerror = res; }); } catch (e) { /* optional */ }
  }), 8000);
}
function strHash(t) { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function A(job) { const key = strHash((job.title || "") + "\u0001" + (job.description || "") + "\u0001" + JSON.stringify(job.constraints || null)); let e = acache.get(job.jobId); if (!e || e.key !== key) { e = { key, a: E.analyzeJob(job) }; acache.set(job.jobId, e); acacheDirty = true; scheduleAnalysisCacheSave(); } return e.a; }
function invalidate(jobId) { if (jobId) { cache.delete(jobId); acache.delete(jobId); } else { cache.clear(); evIndex = null; } }
function evidenceIndex() { return evIndex || (evIndex = E.profileEvidenceIndex(S.profile)); }
function C(job) {
  let c = cache.get(job.jobId);
  if (c) return c;
  const a = A(job);
  const el = E.evaluateEligibility(job, S.profile, a, TODAY());
  const m = E.scoreMatch(job, S.profile, a, { evidenceIndex: evidenceIndex() });
  const cov = S.master.model ? E.cvCoverage(a, S.master.model.text, S.profile, { evidenceIndex: evidenceIndex() }) : null;
  const v = E.careerValue ? E.careerValue(job, a, S.profile) : { total: 0, factors: [] };
  c = { a, el, m, cov, v };
  cache.set(job.jobId, c);
  return c;
}
let jobById = (id) => S.jobs.find((j) => j.jobId === id);
const appFor = (jobId) => S.applications.find((a) => a.jobId === jobId);
const isExpired = (j) => j.status === "Closed" || (j.deadline && daysUntil(j.deadline) < 0);
function profileChanged() { S.profileRev++; invalidate(); save(); }
function logActivity(text) { S.activity.unshift({ date: TODAY(), text }); S.activity = S.activity.slice(0, 60); }

// ---------------------------------------------------------------- router and events
const ROUTES = {};
const ACT = {};
function route(name, fn) { ROUTES[name] = fn; }
let CUR_HASH = "#/dashboard";
function go(hash) { if (HOOKS.internalRouting) { CUR_HASH = hash; render(); return; } if (location.hash === hash) render(); else location.hash = hash; }
function parseHash() { const h = ((HOOKS.internalRouting ? CUR_HASH : location.hash) || "#/dashboard").slice(2).split("/"); return { name: h[0] || "dashboard", arg: decodeURIComponent(h.slice(1).join("/") || "") }; }
const NAV = [
  ["Overview"], ["dashboard", "Dashboard", "◧"], ["ai", "CareerOS AI", "✦"],
  ["Opportunities"], ["discover", "Discover", "⌕"], ["compare", "Compare", "⇄"], ["analysis", "Job Analysis", "≣"], ["watchlist", "Companies", "★"],
  ["Applications"], ["cv", "CV Studio", "▤"], ["optimize", "CV Optimizer", "✎"], ["builder", "Command Center", "⚙"], ["tracker", "Tracker", "☑"], ["interview", "Interview Prep", "◎"],
  ["Growth"], ["profile", "Career Profile", "☺"], ["devmap", "Development Map", "↗"], ["analytics", "Analytics", "▥"], ["market", "Market Intelligence", "▦"], ["keywords", "Keywords", "#"],
  ["System"], ["settings", "Settings", "⚒"],
];
const ALIAS = { job: "discover", company: "watchlist" };
const TABS = [["dashboard", "Home", "◧"], ["discover", "Discover", "⌕"], ["ai", "AI", "✦"], ["tracker", "Tracker", "☑"]];
function renderNav(active) {
  const counts = { discover: S.jobs.filter((j) => !isExpired(j) && ["GREEN", "YELLOW"].includes(C(j).el.label)).length, tracker: S.applications.length, compare: (S.compareIds || []).length };
  const a = ALIAS[active] || active;
  document.getElementById("nav").innerHTML = NAV.map((n) => n.length === 1 ? `<div class="sec">${n[0]}</div>` :
    `<a href="#/${n[0]}" class="${a === n[0] ? "on" : ""}"><span class="ico">${n[2]}</span>${n[1]}${counts[n[0]] ? `<span class="count">${counts[n[0]]}</span>` : ""}</a>`).join("");
  const tb = document.getElementById("tabbar");
  if (tb) tb.innerHTML = TABS.map(([k, l, i]) => `<a href="#/${k}" class="${a === k ? "on" : ""}"><span class="i">${i}</span>${l}</a>`).join("") + `<a href="#" data-act="burger"><span class="i">☰</span>More</a>`;
}
function applyTheme() {
  const t = (S && S.settings.theme) || "auto";
  const dark = t === "dark" || (t === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
if (window.matchMedia) try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme()); } catch (e) {}
/** Mobile: every data table becomes a list of cards; label each cell with its column header. */
function labelTables(root) {
  root.querySelectorAll("table").forEach((t) => {
    const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    if (!heads.length) return;
    t.classList.add("rt");
    t.querySelectorAll("tbody tr").forEach((tr) => [...tr.children].forEach((td, i) => { if (heads[i] && !td.hasAttribute("data-label")) td.setAttribute("data-label", heads[i]); }));
  });
}
async function render() {
  if (!out_keepScroll) closeModal();
  const { name, arg } = parseHash();
  const view = ROUTES[name] || ROUTES.dashboard;
  renderNav(name);
  document.querySelector(".side").classList.remove("open");
  const main = document.getElementById("content");
  try {
    const out = await view(arg);
    document.getElementById("title").textContent = out.title;
    document.getElementById("subtitle").textContent = out.sub || "";
    document.getElementById("topActions").innerHTML = out.actions || "";
    document.getElementById("moreBtn").classList.toggle("hide", !out.actions);
    main.innerHTML = out.html;
    labelTables(main);
    if (out.after) out.after();
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card"><h2>Something went wrong</h2><pre class="doc">${esc(e.stack || e.message)}</pre></div>`;
  }
  if (!out_keepScroll) window.scrollTo(0, 0);
  out_keepScroll = false;
}
let out_keepScroll = false;
function rerender() { out_keepScroll = true; const y = window.scrollY; render().then(() => window.scrollTo(0, y)); }
document.addEventListener("click", (e) => {
  const a = HOOKS.internalRouting && e.target.closest('a[href^="#/"]');
  if (a && !a.closest("[data-act]")) { e.preventDefault(); go(a.getAttribute("href")); return; }
  const t = e.target.closest("[data-act]");
  if (!t) return;
  e.preventDefault();
  const fn = ACT[t.dataset.act];
  if (fn) Promise.resolve(fn(t.dataset, t, e)).catch((err) => { console.error(err); toast("Error: " + err.message, 5000); });
});
document.addEventListener("change", (e) => {
  const t = e.target.closest("[data-chg]");
  if (!t) return;
  const fn = ACT[t.dataset.chg];
  if (fn) Promise.resolve(fn(t.dataset, t, e)).catch((err) => { console.error(err); toast("Error: " + err.message, 5000); });
});
document.addEventListener("input", (e) => {
  const t = e.target.closest("[data-inp]");
  if (!t) return;
  const fn = ACT[t.dataset.inp];
  if (fn) fn(t.dataset, t, e);
});
ACT.burger = () => { closeMenu(); document.querySelector(".side").classList.toggle("open"); };
function closeMenu() { const m = document.getElementById("actmenu"); if (m) m.remove(); }
ACT.more = () => {
  if (document.getElementById("actmenu")) return closeMenu();
  const m = document.createElement("div"); m.className = "menu"; m.id = "actmenu";
  m.innerHTML = document.getElementById("topActions").innerHTML;
  document.querySelector(".top").appendChild(m);
};
document.addEventListener("click", (e) => { if (!e.target.closest("#actmenu") && !e.target.closest("#moreBtn")) closeMenu(); else if (e.target.closest("#actmenu [data-act],#actmenu a")) setTimeout(closeMenu, 0); }, true);
document.addEventListener("click", (e) => { const s = document.querySelector(".side.open"); if (s && !e.target.closest(".side") && !e.target.closest('[data-act="burger"]')) s.classList.remove("open"); });
ACT.closeModal = (d, t) => { closeModal(); const h = t && t.getAttribute && t.getAttribute("href"); if (h && h.startsWith("#/")) go(h); };
window.addEventListener("hashchange", render);
