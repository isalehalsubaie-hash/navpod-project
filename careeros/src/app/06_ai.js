/* CareerOS AI: conversational career agent.
   Hosted page: Claude via the platform `sample` capability, with read-only tools over the user's own data.
   Local file (no AI available): deterministic answers from the same engine, clearly labelled. */
const AI = { busy: false, ctrl: null };
const AI_PROMPTS = [
  "Which jobs should I apply for today?",
  "What should I prioritise this week?",
  "Which opportunities have the highest potential for my career?",
  "Why am I not matching some positions?",
  "What skills are missing from my profile?",
  "Which companies should I target?",
  "Which CV version should I use for CO-0003?",
  "Am I eligible for the Luberef co-op (CO-0023)?",
  "How can I position my UAV experience for an engineering position?",
  "How can I position my engineering background for technical business development?",
];
function compactJob(j) { const c = C(j); return { id: j.jobId, title: j.title, employer: j.employer, location: j.location, type: j.type, tracks: (j.tracks || []).map(trackName), eligibility: c.el.label, eligibilityReasons: c.el.reasons.filter((r) => !["PASS", "NOTE"].includes(r.level)).map((r) => r.msg).slice(0, 3), match: c.m.total, careerValue: c.v.total, keywordCoverage: c.cov ? c.cov.keywordCoverage : null, deadline: j.deadline || null, published: j.published || null, verified: j.verifiedDate, status: isExpired(j) ? "Closed" : j.status, tracker: (appFor(j.jobId) || {}).status || null }; }
const AI_TOOLS = () => [
  { name: "search_jobs", description: "Search the user's saved opportunity database (researched, imported and manually added jobs). Returns compact rows with eligibility, match (0-100), career value (0-100), deadline and tracker status. Never returns jobs that do not exist in the database.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Words to match in title, employer or description" }, track: { type: "string", enum: Object.keys(TRACKS), description: "Career track code" }, eligibility: { type: "array", items: { type: "string", enum: ["GREEN", "YELLOW", "ORANGE", "RED"] } }, minMatch: { type: "number" }, sort: { type: "string", enum: ["match", "value", "deadline", "newest"] }, limit: { type: "number" } } },
    execute: (i) => { let L = S.jobs.filter((j) => !isExpired(j)); const q = (i.query || "").toLowerCase(); if (q) L = L.filter((j) => (j.title + " " + j.employer + " " + (j.description || "").slice(0, 3000)).toLowerCase().includes(q)); if (i.track) L = L.filter((j) => (j.tracks || []).includes(i.track)); if (i.eligibility && i.eligibility.length) L = L.filter((j) => i.eligibility.includes(C(j).el.label)); if (i.minMatch) L = L.filter((j) => C(j).m.total >= i.minMatch);
      const so = { match: (a, b) => C(b).m.total - C(a).m.total, value: (a, b) => C(b).v.total - C(a).v.total, deadline: (a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"), newest: (a, b) => (b.published || "").localeCompare(a.published || "") }[i.sort || "match"];
      L.sort(so); return { total: L.length, rows: L.slice(0, Math.min(25, i.limit || 12)).map(compactJob) }; } },
  { name: "get_job", description: "Full analysis of one job by id (CO-xxxx): requirements, eligibility reasons, match factors, career value factors, keyword coverage and missing keywords.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    execute: (i) => { const j = jobById(i.id) || trackTarget(i.id); if (!j) throw new Error("No job with id " + i.id); const c = C(j);
      return { ...compactJob(j), notes: j.notes || "", source: j.source, eligibility: { label: c.el.label, reasons: c.el.reasons }, matchFactors: c.m.factors.map((f) => ({ factor: f.label, points: f.points, of: f.weight, why: f.why })), careerValueFactors: c.v.factors.map((f) => ({ factor: f.label, points: f.points, of: f.weight, why: f.why })), mandatoryRequirements: c.a.extracted.mandatory.slice(0, 12), preferred: c.a.extracted.preferred.slice(0, 8), responsibilities: c.a.responsibilities.slice(0, 8).map((r) => r.text), keywords: c.cov ? c.cov.rows.map((r) => ({ keyword: r.jdForms[0], status: r.status })) : [], missing: c.m.missing, supportingEvidence: c.m.supportingExperience }; } },
  { name: "get_profile", description: "The user's verified career profile: evidence items with ids (E01, P01...), verification status and bullets; skills with status and strength; education; personal fields that are set or missing; integrity flags.",
    inputSchema: { type: "object", properties: {} },
    execute: () => { const P = S.profile; return { education: P.education, personal: Object.fromEntries(Object.entries(P.personal).map(([k, v]) => [k, typeof v === "object" ? { value: v.value || null, status: v.status } : v])), items: P.items.map((i) => ({ id: i.id, type: i.type, title: i.title, org: i.org, start: i.start, end: i.end, status: i.status, tracks: i.tracks, bullets: i.bullets, notes: i.notes || "" })), skills: P.skills.map((s) => ({ name: s.name, status: s.status, strength: s.strength, note: s.note || "" })), integrityFlags: P.integrityFlags }; } },
  { name: "get_applications", description: "The user's application tracker: status, dates, channel, CV version, notes.",
    inputSchema: { type: "object", properties: {} },
    execute: () => S.applications.map((a) => { const j = jobById(a.jobId); return { jobId: a.jobId, title: j ? j.title : (a.snapshot || {}).title, employer: j ? j.employer : (a.snapshot || {}).employer, status: a.status, applied: a.appliedDate, followUp: a.followUp, channel: a.channel || null, tailoredCV: !!a.cvVersionId, notes: a.notes }; }) },
  { name: "get_next_moves", description: "CareerOS's ranked list of next actions (deadlines, follow-ups, interviews, profile fixes, best applications) with reasons.",
    inputSchema: { type: "object", properties: {} }, execute: () => nextMoves() },
  { name: "get_skill_gaps", description: "Development map: skills and certifications requested in reachable adverts that the user has no verified evidence for, with frequency, tier, cost band and learning resources.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } }, execute: (i) => devMapData().list.slice(0, i.limit || 15).map((x) => ({ term: x.term, adverts: x.n, mandatoryIn: x.mandatory, tier: x.tier, cost: x.cost, time: x.time, unconfirmedInProfile: x.unconfirmed, resources: x.res.map((r) => r[0]) })) },
  { name: "compare_jobs", description: "Compare two or more jobs by id and get CareerOS's priority recommendation.",
    inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
    execute: (i) => { const r = E.compareJobs(i.ids.map((id) => jobById(id)).filter(Boolean).map((j) => ({ job: j, ...C(j) }))); return { recommendation: r.recommendation, method: r.method, ranking: r.rows.map((x) => ({ id: x.job.jobId, title: x.job.title, employer: x.job.employer, priority: x.priority, eligibility: x.el.label, match: x.m.total, careerValue: x.v.total })) }; } },
  { name: "get_companies", description: "Company watchlist entries with verified-vacancy counts, programs, careers site status and notes.",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
    execute: (i) => S.companies.filter((c) => !i.query || (c.name + " " + c.industry + " " + (c.tracks || []).join(" ")).toLowerCase().includes(i.query.toLowerCase())).slice(0, 25).map((c) => ({ name: c.name, industry: c.industry, location: c.location, type: c.opportunityType, openVacancies: S.jobs.filter((j) => !isExpired(j) && companyMatch(c, j.employer)).length, internship: c.internshipPrograms, graduate: c.graduatePrograms, notes: c.notes, followed: !!c.followed })) },
];
const AI_RULES = `You are CareerOS AI, a career advisor inside the user's private CareerOS app. The user is Saleh Alsubaie, a final-year Mechanical Engineering student at IMSIU in Riyadh (expected graduation January 2027).
Rules:
- Use the tools to read the user's real data before answering. Never invent jobs, employers, requirements, salaries, deadlines, contacts, qualifications or results.
- Only treat profile items with status verified_doc or confirmed_user as the user's qualifications. Items marked needs_confirmation or suggested must be described as unconfirmed. Never upgrade a personal interest into a qualification.
- Cite evidence: job ids like CO-0003 and profile item ids like E04 or P01 when you rely on them.
- You cannot browse the web or check live job boards. If a question needs that, say so and suggest Discover, Job Analysis or the Gmail import.
- Eligibility, match, career value and readiness are separate measures; none is a probability of being hired.
- The user keeps their GPA private by choice. Never ask for it or list it as missing; mention GPA minimums only as something to check.
- Be concise and practical: short paragraphs or numbered steps. No em dashes. Plain text with simple bullets.`;
function aiHistoryText() { const h = (S.aiChat || []).slice(-12).map((m) => ({ role: m.role, content: m.content })); while (h.length && h[0].role !== "user") h.shift(); return h; }
async function aiSample() { return HOOKS.sample ? HOOKS.sample() : null; }
route("ai", async () => {
  S.aiChat = S.aiChat || [];
  const avail = !!(HOOKS.sample);
  const msgs = S.aiChat.map((m) => `<div class="msg ${m.role === "user" ? "me" : ""}">${m.role === "user" ? esc(m.content) : aiFormat(m.content)}<div class="meta">${esc(m.meta || "")}</div></div>`).join("");
  return {
    title: "CareerOS AI", sub: avail ? "Answers from your own data, through Claude" : "Built-in answers (AI model not available in this view)",
    actions: S.aiChat.length ? `<button class="btn" data-act="aiClear">Clear conversation</button>` : "",
    html: `${avail ? "" : `<div class="note mb">The AI model is only available when CareerOS runs as your private claude.ai page. Here, questions are answered by CareerOS's built-in rules using the same data, and labelled as such.</div>`}
    <div class="chat" id="chat">${msgs || `<div class="card"><h2>Ask about your opportunities, CV and next steps</h2><p class="small muted">CareerOS AI reads your saved jobs, career profile, tracker and development map. It cannot browse the web, and it never treats unconfirmed items as qualifications.</p><div class="prompts mt">${AI_PROMPTS.map((p) => `<button class="chip" data-act="aiAsk" data-q="${esc(p)}">${esc(p)}</button>`).join("")}</div></div>`}</div>
    ${S.aiChat.length ? `<div class="prompts mt">${AI_PROMPTS.slice(0, 5).map((p) => `<button class="chip" data-act="aiAsk" data-q="${esc(p)}">${esc(p)}</button>`).join("")}</div>` : ""}
    <div class="composer"><textarea id="aiq" placeholder="Ask CareerOS AI..." rows="2"></textarea><button class="btn primary big" data-act="aiSend" id="aiSendBtn">${AI.busy ? "Stop" : "Send"}</button></div>`,
    after: () => { const c = document.getElementById("chat"); if (S.aiChat.length) window.scrollTo(0, document.body.scrollHeight); const t = document.getElementById("aiq"); t && t.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ACT.aiSend(); } }); },
  };
});
function aiFormat(t) {
  let h = esc(t);
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  h = h.replace(/\b(CO-\d{4}|TRACK-[A-Z]+)\b/g, (m) => `<a href="#/job/${m}">${m}</a>`);
  return h;
}
ACT.aiClear = async () => { if (!(await ask("Clear this conversation?"))) return; S.aiChat = []; save(); render(); };
ACT.aiAsk = (d) => { const t = document.getElementById("aiq"); if (t) t.value = d.q; ACT.aiSend(); };
ACT.aiSend = async () => {
  if (AI.busy) { if (AI.ctrl) AI.ctrl.abort(); return; }
  const t = document.getElementById("aiq"); const q = (t ? t.value : "").trim(); if (!q) return;
  S.aiChat = S.aiChat || []; S.aiChat.push({ role: "user", content: q, meta: new Date().toLocaleString() });
  const sample = await aiSample();
  if (!sample) { S.aiChat.push({ role: "assistant", content: localAnswer(q), meta: "Built-in answer (no AI model in this view)" }); save(); await render(); return; }
  AI.busy = true; AI.ctrl = new AbortController();
  S.aiChat.push({ role: "assistant", content: "Thinking...", meta: "CareerOS AI" });
  await render();
  const live = () => { const all = document.querySelectorAll("#chat .msg"); return all[all.length - 1]; };
  const hist = aiHistoryText().slice(0, -1);
  hist[hist.length - 1] = { role: "user", content: AI_RULES + "\n\nToday is " + TODAY() + ".\n\nQuestion: " + q };
  try {
    const res = await sample(hist, { tools: AI_TOOLS(), signal: AI.ctrl.signal, cache: false, modelTier: "default", onText: ({ text }) => { const el = live(); if (el) el.innerHTML = aiFormat(text) + '<div class="meta">CareerOS AI (writing...)</div>'; } });
    S.aiChat[S.aiChat.length - 1] = { role: "assistant", content: (res.text || "").replace(/\u2014/g, ", "), meta: "CareerOS AI · " + new Date().toLocaleTimeString() + (res.truncated ? " · answer truncated" : "") };
  } catch (e) {
    const msg = e && e.code === "not_granted" ? "AI access was not granted for this page. You can allow it when prompted, or use the built-in answer below.\n\n" + localAnswer(q) : e && e.code === "rate_limited" ? "The AI is rate limited right now. Try again in a minute. Built-in answer:\n\n" + localAnswer(q) : e && e.name === "AbortError" ? (e.text || "Stopped.") : "The AI could not answer (" + (e && (e.message || e.code)) + "). Built-in answer:\n\n" + localAnswer(q);
    S.aiChat[S.aiChat.length - 1] = { role: "assistant", content: msg, meta: "CareerOS" };
  }
  AI.busy = false; AI.ctrl = null; S.aiChat = S.aiChat.slice(-40); save(); render();
};
/** Deterministic answers from the engine for when no AI model is available. */
function localAnswer(q) {
  const ql = q.toLowerCase();
  const idm = q.match(/CO-\d{4}/i);
  const P = S.profile;
  const top = (n, f) => S.jobs.filter((j) => !isExpired(j) && (!f || f(j))).sort((a, b) => (0.55 * C(b).m.total + 0.45 * C(b).v.total) - (0.55 * C(a).m.total + 0.45 * C(a).v.total)).slice(0, n);
  if (idm && /eligib/.test(ql)) { const j = jobById(idm[0].toUpperCase()); if (!j) return "No job " + idm[0] + " in your database."; const c = C(j); return j.title + " (" + j.employer + "): " + c.el.label + ", " + c.el.summary + ".\n" + c.el.reasons.map((r) => "- " + r.level + ": " + r.msg).join("\n"); }
  if (idm && /cv|version/.test(ql)) { const j = jobById(idm[0].toUpperCase()); if (!j) return "No job " + idm[0] + "."; const t = (j.tracks || [])[0]; const map = { ME: "Mechanical Engineering", DEF: "UAV and Aerospace", UAV: "UAV and Aerospace", ROB: "UAV and Aerospace", INSP: "Safety and Inspection", HSE: "Safety and Inspection", PM: "Project Engineering", ENERGY: "Project Engineering", BD: "Business and Technical Development", STRAT: "Business and Technical Development" }; const vs = S.cvVersions.filter((v) => v.jobId === j.jobId); return vs.length ? "Use your tailored version " + vs[vs.length - 1].name + " (coverage " + vs[vs.length - 1].coverageAfter + "%)." : "Start from the " + (map[t] || "Master") + " CV track version in CV Studio, then tailor it for " + j.jobId + " in the CV Optimizer. Its track is " + (j.tracks || []).map(trackName).join(", ") + "."; }
  if (/today|this week|prioriti|next/.test(ql)) return "Your next best moves:\n" + nextMoves().map((m, i) => (i + 1) + ". " + m.title + "\n   " + m.why + " (" + m.time + ")").join("\n");
  if (/apply/.test(ql)) return "Best opportunities to apply for now (Green or Yellow, ranked by match and career value):\n" + top(6, (j) => ["GREEN", "YELLOW"].includes(C(j).el.label)).map((j, i) => (i + 1) + ". " + j.jobId + " " + j.title + " · " + j.employer + " · " + C(j).el.label + ", match " + C(j).m.total + ", value " + C(j).v.total).join("\n");
  if (/potential|career value|long[- ]term/.test(ql)) return "Highest career value among reachable roles:\n" + S.jobs.filter((j) => !isExpired(j) && C(j).el.label !== "RED").sort((a, b) => C(b).v.total - C(a).v.total).slice(0, 6).map((j, i) => (i + 1) + ". " + j.jobId + " " + j.title + " · " + j.employer + " · value " + C(j).v.total + " (" + C(j).v.factors.filter((f) => f.points / f.weight >= 0.9).map((f) => f.label.toLowerCase()).join(", ") + ")").join("\n");
  if (/not matching|why am i not|low match/.test(ql)) { const low = S.jobs.filter((j) => !isExpired(j) && C(j).el.label === "RED"); const cnt = {}; low.forEach((j) => C(j).el.reasons.filter((r) => r.level === "RED").forEach((r) => (cnt[r.kind] = (cnt[r.kind] || 0) + 1))); return low.length + " active roles are RED. Main reasons:\n" + Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => "- " + ({ experience: "Years of experience required", academic: "Graduation timing or year restrictions", manual: "Specific licence, major or experience (manual review)", nationality: "Nationality restriction", gpa: "GPA", cert: "Certification", status: "Closed" }[k] || k) + ": " + n).join("\n") + "\nThese are requirement gaps, not CV wording problems; tailoring cannot fix them."; }
  if (/skill|missing|gap|learn|course|certif/.test(ql)) { const d = devMapData(); return "Most requested items you have no verified evidence for:\n" + d.list.slice(0, 8).map((x, i) => (i + 1) + ". " + x.term + ": " + x.n + " adverts, " + x.tier + ", cost " + x.cost + (x.res[0] ? ". Start: " + x.res[0][0] : "")).join("\n") + "\nSee the Development Map for the full roadmap."; }
  if (/compan|employer|target/.test(ql)) { const L = S.companies.map((c) => ({ c, n: S.jobs.filter((j) => !isExpired(j) && companyMatch(c, j.employer) && ["GREEN", "YELLOW"].includes(C(j).el.label)).length })).filter((x) => x.n || (x.c.tracks || []).some((t) => ["DEF", "UAV", "ROB"].includes(t))).sort((a, b) => b.n - a.n).slice(0, 8); return "Companies to target:\n" + L.map((x, i) => (i + 1) + ". " + x.c.name + ": " + (x.n ? x.n + " reachable vacancy(ies) now" : "no verified vacancy; " + (x.c.opportunityType === "D" ? "networking target" : "watch programs")) + ". " + (x.c.notes || "").slice(0, 100)).join("\n"); }
  if (/uav|drone/.test(ql) && /engineer/.test(ql)) return "Position your UAV work as engineering, using only documented evidence:\n- Systems engineering and integration: NavPod two-loop architecture, MAVLink integration (P01, P08).\n- Mechanical design and manufacture: fixed-wing airframe from clean sheet, 45+ SolidWorks drawings, BOM ownership (E03).\n- Simulation and analysis: 6-DOF MATLAB/Simulink model, 15-state EKF, CFD on the pod (P01, P07).\n- Test and validation: JNH five-module simulation test plan (E01), PSP test matrix and uncertainty budget (P05).\n- Survey and inspection data: M300 RTK survey, PIX4Dmatic outputs (P03) for inspection or geospatial roles.\nDo not claim flight hours until confirmed (flag F1).";
  if (/business|commercial|sales|bd/.test(ql)) return "Position your engineering background for technical business development:\n- Business cases: docking-station CAPEX/OPEX payback and margin curves that set pricing (E01); MIRQAB value model, described as a model (P02).\n- Customer-facing: LEAP 2026 booth, 2 POC agreements (E01, self-reported); investor and delegation briefings at QSS (E03).\n- Technical credibility: MEP drawing review and clash resolution (E04), UAV design (E03), NavPod (P01).\n- Commercial practice: TalMal partnerships internship (E02).\nBest current matches: " + top(3, (j) => (j.tracks || []).includes("BD") && C(j).el.label !== "RED").map((j) => j.jobId + " " + j.title).join("; ") + ".";
  return "I can answer from your data: try one of the suggested questions, or name a job id (for example CO-0003) and ask about eligibility or which CV version to use.";
}
