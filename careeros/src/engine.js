/* CareerOS engine: shared by the browser app and the Node build/test scripts.
   No network calls. No randomness. Every score is derived from stored data and explained. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./taxonomy.js"));
  else root.CareerEngine = factory(root.CareerTaxonomy);
})(typeof window !== "undefined" ? window : globalThis, function (TAX) {
  "use strict";
  const { TAXONOMY, TRACKS } = TAX;
  const STATUS_LABEL = {
    verified_doc: "Verified from uploaded documentation",
    confirmed_user: "Confirmed by me",
    needs_confirmation: "Requires confirmation",
    suggested: "Suggested but not established",
  };
  const TRUSTED = new Set(["verified_doc", "confirmed_user"]);

  // ------------------------------------------------------------------ text utils
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const norm = (s) => (s || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, " ");
  const variantCache = new Map();
  function variantRegex(v) {
    if (variantCache.has(v)) return variantCache.get(v);
    const caseSensitive = /^[A-Z0-9&/+.\- ]{1,5}$/.test(v) && v === v.toUpperCase();
    let body = esc(v).replace(/\\-|\s+/g, (m) => (m === "\\-" ? "[-\\s]?" : "[\\s-]+"));
    const re = new RegExp("(?<![A-Za-z0-9])" + body + "(?![A-Za-z0-9+])", caseSensitive ? "g" : "gi");
    variantCache.set(v, re);
    return re;
  }
  // Fast pre-check: the longest alphanumeric chunk of a variant must appear (lowercased) in the text
  // before the slower boundary-aware regular expression runs.
  const needleCache = new Map();
  function needle(v) {
    let n = needleCache.get(v);
    if (n === undefined) { const parts = v.toLowerCase().split(/[^a-z0-9\u0600-\u06ff+#]+/).filter(Boolean).sort((a, b) => b.length - a.length); n = parts[0] || ""; needleCache.set(v, n); }
    return n;
  }
  let lowCacheKey = null, lowCacheVal = "", tokCache = null;
  function lower(text) { if (text !== lowCacheKey) { lowCacheKey = text; lowCacheVal = text.toLowerCase(); tokCache = null; } return lowCacheVal; }
  function tokens(text) { lower(text); if (!tokCache) tokCache = new Set(lowCacheVal.split(/[^a-z0-9]+/)); return tokCache; }
  const simpleVariant = new Map();
  function countVariant(text, v) {
    const n = needle(v);
    if (n) {
      let simple = simpleVariant.get(v);
      if (simple === undefined) { simple = !/[^A-Za-z0-9 ]/.test(v); simpleVariant.set(v, simple); }
      // plain words: each word of the variant must be a whole word of the text; otherwise substring check
      if (simple && text.length > 600 ? !tokens(text).has(n) : !lower(text).includes(n)) return 0;
    }
    const re = variantRegex(v);
    re.lastIndex = 0;
    const m = text.match(re);
    return m ? m.length : 0;
  }
  /** Find taxonomy terms in a text. Returns [{id, term, hits, variants:{variant:count}}] */
  function findKeywords(text, taxonomy) {
    taxonomy = taxonomy || TAXONOMY;
    text = norm(text);
    const out = [];
    for (const k of taxonomy) {
      const variants = {};
      let hits = 0;
      for (const v of [k.term, ...k.syn]) {
        const c = countVariant(text, v);
        if (c) { variants[v] = c; hits += c; }
      }
      if (hits) out.push({ id: k.id, term: k.term, cat: k.cat, tracks: k.tracks, hits, variants });
    }
    return out.sort((a, b) => b.hits - a.hits);
  }
  const taxById = (id, taxonomy) => (taxonomy || TAXONOMY).find((k) => k.id === id);

  // ------------------------------------------------------------------ profile helpers
  function profileEvidenceIndex(profile, taxonomy) {
    // kid -> {status:'trusted'|'unverified', items:[...], skill}
    const idx = {};
    const add = (kid, status, ref) => {
      if (!kid) return;
      const e = (idx[kid] = idx[kid] || { trusted: [], unverified: [] });
      (TRUSTED.has(status) ? e.trusted : e.unverified).push(ref);
    };
    for (const it of profile.items || []) {
      for (const kid of it.skills || []) add(kid, it.status, { kind: "item", id: it.id, title: it.title, org: it.org, status: it.status });
      const text = [it.title, it.org, ...(it.bullets || [])].join(" . ");
      for (const k of findKeywords(text, taxonomy)) add(k.id, it.status, { kind: "item", id: it.id, title: it.title, org: it.org, status: it.status, textual: true });
    }
    for (const s of profile.skills || []) {
      const st = s.strength === "interest" ? "suggested" : s.status;
      add(s.kid, st, { kind: "skill", id: s.kid, title: s.name, status: st, note: s.note, strength: s.strength });
    }
    const ed = profile.education || {};
    if (ed.degree && /mechanical/i.test(ed.degree)) {
      const ref = { kind: "education", id: "EDU", title: ed.degree + (ed.graduated ? "" : " (in progress, expected " + ed.expectedGraduation + ")"), status: ed.status || "verified_doc" };
      add("bsme", ref.status, ref); add("bseng", ref.status, ref);
    }
    // a skill explicitly marked needs_confirmation overrides textual item matches with the same word
    for (const s of profile.skills || []) {
      if (s.status === "needs_confirmation" && s.override) delete idx[s.kid];
    }
    return idx;
  }

  // ------------------------------------------------------------------ JD analysis
  const MANDATORY_CUES = /\b(must|required|requirement|mandatory|minimum|essential|need to have|shall|should have)\b|يجب|مطلوب|إلزامي/i;
  const PREFERRED_CUES = /\b(preferred|preferably|desirable|advantage|advantageous|nice to have|a plus|is a plus|bonus|ideally|would be an asset|asset)\b|يفضل|ميزة/i;
  const SECTION_RES = [
    ["responsibilities", /^(key |main |your |job |role )?(responsibilities|duties|what you('|’)ll do|what you will do|the role|role overview|job description|accountabilities|المهام|المسؤوليات)\b/i],
    ["preferred", /^(preferred|desired|nice to have|bonus|additional|good to have)( qualifications| skills| requirements)?\b/i],
    ["requirements", /^(requirements|qualifications|minimum qualifications|basic qualifications|required|what we('|’)re looking for|what you('|’)ll bring|what you bring|who you are|skills|education|experience|job requirements|candidate profile|المؤهلات|المتطلبات|الشروط)\b/i],
    ["benefits", /^(benefits|what we offer|perks|why join|compensation)\b/i],
    ["about", /^(about (us|the company|the team)|who we are|company overview|overview)\b/i],
  ];
  function splitLines(jd) {
    return norm(jd)
      .split(/\n|(?<=[.;])\s+(?=[A-Z•\-])|•/)
      .map((s) => s.replace(/^[\s\-–*·o]+/, "").trim())
      .filter((s) => s.length > 2);
  }
  function extractConstraints(text, title) {
    const t = norm((title || "") + "\n" + (text || ""));
    const c = { nationality: "any", gender: "any", minYears: null, maxYears: null, entry: false, studentOnly: false, coopLetter: false, gradYears: null, degree: "unknown", gpa: null, certsRequired: [], raw: {} };
    if (/saudi nationals?( only)?\b|saudis only|for saudis|saudi citizens?|\(saudi( national)?\)|saudi nationality|only saudi|saudi candidates only|local citizen of \[?saudi|saudi only|سعودي الجنسية|للسعوديين|سعوديين فقط|سعودي فقط|saudization role|nationals only/i.test(t)) c.nationality = "saudi";
    if (/\b(females? only|women only|female candidates only|female saudi|ladies only)\b|للنساء|نسائي/i.test(t)) c.gender = "female";
    else if (/\b(males? only|male candidates only|male saudi)\b/i.test(t)) c.gender = "male";
    // years of experience
    const yrs = [];
    const re = /(\d{1,2})\s*(\+|plus)?\s*(?:(?:-|–|to)\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?)\b([^.\n]{0,70})/gi;
    let m;
    while ((m = re.exec(t))) {
      const ctx = t.slice(Math.max(0, m.index - 60), m.index) + m[0];
      const before = t.slice(Math.max(0, m.index - 45), m.index);
      if (/(up to|maximum( of)?|max\.?|no more than|not more than|less than)\s*$/i.test(before)) { yrs.push([0, parseInt(m[1], 10)]); continue; }
      if (parseInt(m[1], 10) > 20 || /\b(we|our|company|firm|group|with over|has over|for over|history|legacy|established|since|founded)\b/i.test(before)) continue;
      if (/experience|exp\b|background|working|work|industry|field|relevant|post[- ]graduat/i.test(ctx + (m[4] || "")) && !/old|age|warranty|contract|program(me)? duration|month|of (operation|history|excellence|service)/i.test(m[4] || "")) {
        yrs.push([parseInt(m[1], 10), m[3] ? parseInt(m[3], 10) : null]);
      }
    }
    if (/\b(0|zero)\s*(-|–|to)\s*\d\s*years?/i.test(t)) yrs.push([0, null]);
    const re2 = /(?:minimum|min\.?|at least)\s*(?:of\s*)?(\d{1,2})\s*\+?\s*(?:years?|yrs?)|years? of experience\s*:?\s*0?(\d{1,2})\b/gi;
    while ((m = re2.exec(t))) { const v = parseInt(m[1] || m[2], 10); if (v <= 20) yrs.push([v, null]); }
    if (yrs.length) { c.minYears = Math.min(...yrs.map((y) => y[0])); const mx = yrs.map((y) => y[1]).filter((x) => x != null); c.maxYears = mx.length ? Math.max(...mx) : null; }
    if (/fresh graduate|new graduate|recent graduate|graduate (development|trainee|program|engineer)|entry[- ]level|no experience (is )?required|0\s*(-|–|to)\s*[12]\s*years?|حديثي التخرج|حديث التخرج|خريجين/i.test(t)) c.entry = true;
    if (/intern(ship)?\b|trainee|co-?op\b|cooperative training|summer (student|program)|تدريب تعاوني|متدرب/i.test(t)) c.entry = true;
    if (/currently enrolled|current(ly)? (a )?(university )?students?|undergraduate students?|enrolled (in|at) (a|an)? ?(university|bachelor)|final[- ]year students?|must not have graduated|not (yet )?graduated|طلاب|طالب/i.test(t)) c.studentOnly = true;
    if (/co-?op\b|cooperative training|تدريب تعاوني|university letter|training letter|letter from (your|the) university/i.test(t)) c.coopLetter = true;
    const gy = t.match(/(?:graduat\w*|class)\s*(?:date\s*)?(?:of|in|from|between|year)?\s*:?\s*(20\d\d)\s*(?:(?:or|and|-|–|to|,)\s*(20\d\d))?(?:\s*(?:or|and|,)\s*(20\d\d))?/i);
    if (gy) c.gradYears = [gy[1], gy[2], gy[3]].filter(Boolean).map(Number);
    if (/mechanical engineering|mechanical engineer\b|B\.?Sc\.? (in )?mechanical|هندسة ميكانيكية|الهندسة الميكانيكية/i.test(t)) c.degree = "mechanical";
    else if (/(bachelor'?s?|b\.?sc|degree)[^.\n]{0,40}engineering|engineering (degree|graduate|discipline)|any engineering/i.test(t)) c.degree = "engineering";
    else if (/(bachelor'?s?|degree)[^.\n]{0,60}(electrical|civil|chemical|computer|software|industrial|petroleum|architect)/i.test(t)) c.degree = "other_engineering";
    else if (/(bachelor'?s?|degree)[^.\n]{0,60}(business|finance|accounting|economics|marketing|management)/i.test(t)) c.degree = "business";
    if (c.degree === "engineering" && /(electrical|civil|chemical)\s+engineering/i.test(t) && !/mechanical/i.test(t)) c.degree = "other_engineering";
    c.requiresGraduate = /fresh graduates?\b|recent graduates?\b|new graduates?\b|have completed (their|your|a) bachelor|completed their bachelor|university graduates|graduated (in|from)\b|must be a graduate|حديثي التخرج/i.test(t) && !/currently (pursuing|enrolled|studying)|current students?|final[- ]year students?/i.test(t);
    c.degreeMentioned = /bachelor|b\.?sc|degree|graduate|خريج|بكالوريوس/i.test(t);
    c.tamheer = /tamheer|tatween|tawteen|تمهير/i.test(t);
    c.fullTime = /full[- ]time|دوام كامل/i.test(t);
    const g = t.match(/GPA[^0-9]{0,25}(\d(?:\.\d{1,2})?)\s*(?:\/|out of)?\s*(4|5)?/i);
    if (g) c.gpa = { min: parseFloat(g[1]), scale: g[2] ? parseInt(g[2], 10) : null };
    const certs = [
      ["SCE", /(SCE|Saudi Council of Engineers)[^.\n]{0,40}(registration|registered|membership|accredit|certified|license|licence)|(registered|accredited|membership)[^.\n]{0,30}(SCE|Saudi Council of Engineers)/i],
      ["PMP", /\bPMP\b/],
      ["NEBOSH", /NEBOSH/i],
      ["OSHA", /\bOSHA\b/],
      ["IOSH", /\bIOSH\b/],
      ["GACA drone licence", /GACA[^.\n]{0,40}(licen|certif|permit)|drone (pilot )?licen/i],
      ["API 510/570/653", /API\s*(510|570|653)/i],
      ["ASNT / NDT Level II", /(ASNT|NDT)[^.\n]{0,20}level\s*(ii|2|iii|3)/i],
      ["Saudi driving licence", /(valid )?(saudi )?driv(ing|er'?s) licen[cs]e/i],
      ["CSWA/CSWP", /\bCSW[AP]\b/],
    ];
    for (const [name, rx] of certs) {
      const mm = t.match(rx);
      if (mm) {
        const i = t.indexOf(mm[0]);
        const ctx = t.slice(Math.max(0, i - 120), i + 120);
        c.certsRequired.push({ name, mandatory: !PREFERRED_CUES.test(ctx), context: ctx.replace(/\s+/g, " ").trim() });
      }
    }
    return c;
  }
  function analyzeJob(job, opts) {
    opts = opts || {};
    const taxonomy = opts.taxonomy || TAXONOMY;
    const text = norm(job.description || "");
    const lines = splitLines(text);
    // keywords present anywhere in the advert; per-line matching only needs to consider these
    const keywords = findKeywords((job.title || "") + "\n" + text, taxonomy);
    const present = new Set(keywords.map((k) => k.id));
    const lineTax = taxonomy.filter((k) => present.has(k.id));
    let section = "general";
    const reqs = [];
    const responsibilities = [];
    for (const raw of lines) {
      const line = raw.replace(/:$/, "");
      const hdr = SECTION_RES.find(([, rx]) => rx.test(line) && line.length < 70);
      if (hdr && line.split(" ").length <= 8) { section = hdr[0]; continue; }
      if (section === "about" || section === "benefits") continue;
      const kws = findKeywords(line, lineTax);
      const looksReq = /experience|degree|bachelor|knowledge|proficien|familiar|ability|skills?|understanding|certif|licen|years|fluent|graduate|gpa|must|required|preferred|nationality|saudi|qualification|background|exposure/i.test(line);
      if (section === "responsibilities" || (section === "general" && /^(develop|design|support|coordinate|prepare|conduct|perform|assist|manage|lead|ensure|review|monitor|work|participate|carry|maintain|implement|provide|oversee|analy|create|plan|execute|drive|build|track|deliver)/i.test(line) && !looksReq)) {
        if (line.length > 15) responsibilities.push({ text: line, keywords: kws.map((k) => k.id) });
        continue;
      }
      if (section === "requirements" || section === "preferred" || looksReq || kws.length) {
        let importance = section === "preferred" ? "preferred" : section === "requirements" ? "mandatory" : "unspecified";
        if (PREFERRED_CUES.test(line)) importance = "preferred";
        else if (MANDATORY_CUES.test(line)) importance = "mandatory";
        if (line.length > 8 && (looksReq || kws.length)) reqs.push({ text: line, importance, keywords: kws.map((k) => k.id), section });
      }
    }
    const constraints = Object.assign(extractConstraints(text, job.title), job.constraints || {});
    const byCat = (cat) => keywords.filter((k) => k.cat === cat).map((k) => k.term);
    // repeated terms
    const repeated = keywords.filter((k) => k.hits >= 2).map((k) => ({ term: k.term, hits: k.hits }));
    const saudiSpecific = [];
    if (constraints.nationality === "saudi") saudiSpecific.push("Saudi nationals only");
    if (/SCE|Saudi Council of Engineers/i.test(text)) saudiSpecific.push("Saudi Council of Engineers registration mentioned");
    if (/GACA/i.test(text)) saudiSpecific.push("GACA (civil aviation) requirement mentioned");
    if (/Saudi Building Code|\bSBC\b/i.test(text)) saudiSpecific.push("Saudi Building Code (SBC)");
    if (/Iqama|transferable/i.test(text)) saudiSpecific.push("Iqama / transferable visa mentioned");
    if (/Arabic/i.test(text)) saudiSpecific.push("Arabic language mentioned");
    if (/HRDF|Tamheer|هدف|تمهير/i.test(text)) saudiSpecific.push("HRDF / Tamheer support mentioned");
    if (/Aramco (approved|approval)|SEC approved|Aramco standards|SAES/i.test(text)) saudiSpecific.push("Aramco / SEC client approvals or standards");
    return {
      requirements: reqs,
      responsibilities,
      keywords,
      constraints,
      extracted: {
        mandatory: reqs.filter((r) => r.importance === "mandatory").map((r) => r.text),
        preferred: reqs.filter((r) => r.importance === "preferred").map((r) => r.text),
        technical: byCat("technical"),
        software: byCat("software"),
        domain: byCat("domain"),
        certifications: [...new Set([...byCat("cert"), ...constraints.certsRequired.map((c) => c.name)])],
        education: byCat("education"),
        business: byCat("business"),
        soft: byCat("soft"),
        regulatory: byCat("regulatory"),
        years: constraints.minYears,
        saudiSpecific,
        repeated,
      },
    };
  }

  // ------------------------------------------------------------------ eligibility
  function monthsBetween(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()); }
  function evaluateEligibility(job, profile, analysis, today) {
    today = today ? new Date(today) : new Date();
    const c = (analysis || analyzeJob(job)).constraints;
    const reasons = [];
    let level = 0; // 0 green, 1 yellow, 2 orange, 3 red
    const bump = (l, msg, kind) => { level = Math.max(level, l); reasons.push({ level: ["GREEN", "YELLOW", "ORANGE", "RED"][l], msg, kind }); };
    const pass = (msg) => reasons.push({ level: "PASS", msg });
    const nat = ((profile.personal || {}).nationality || {}).value || "";
    const natConfirmed = nat && ((profile.personal.nationality.status || "") === "confirmed_user");
    const gender = ((profile.personal || {}).gender || {}).value || "";
    const edu = profile.education || {};
    const grad = edu.expectedGraduation ? new Date(edu.expectedGraduation + "-28") : null;
    const graduated = !!edu.graduated;
    const gpaVal = parseFloat(((edu.gpa || {}).value || "").toString());

    // status / deadline
    if (job.status === "Closed") bump(3, "Applications are closed (" + (job.statusNote || "per source") + ").", "status");
    else if (job.deadline && new Date(job.deadline + "T23:59:59") < today) bump(3, "Deadline " + job.deadline + " has passed.", "deadline");
    else if (job.status === "Unknown" || !job.status) bump(1, "Open status could not be confirmed. Check the source before applying.", "status");
    else pass("Listing appeared open on " + (job.verifiedDate || "the verification date") + ".");

    // nationality
    if (c.nationality === "saudi") {
      if (!nat) bump(1, "Restricted to Saudi nationals. Your nationality is not set in your profile, so this cannot be confirmed.", "nationality");
      else if (/saudi/i.test(nat) && natConfirmed) pass("Saudi nationals only: matches your confirmed nationality.");
      else if (/saudi/i.test(nat)) bump(1, "Saudi nationals only: nationality entered but not marked confirmed.", "nationality");
      else bump(3, "Restricted to Saudi nationals.", "nationality");
    }
    if (c.gender !== "any") {
      if (!gender) bump(1, "Posting is restricted to " + c.gender + " candidates. Gender not set in profile.", "gender");
      else if (gender.toLowerCase() !== c.gender) bump(3, "Posting is restricted to " + c.gender + " candidates.", "gender");
      else pass("Gender restriction matches profile.");
    }
    // academic status
    const type = (job.type || "").toLowerCase();
    const isInternship = /intern|co-?op|trainee|summer|tamheer|training/.test(type) || /intern|co-?op|cooperative|summer student|trainee/i.test(job.title || "");
    const isGradProgram = /graduate|gdp|development program|fresh/i.test((job.title || "") + " " + type);
    if (!graduated && grad) {
      if (c.studentOnly || (isInternship && !isGradProgram)) {
        if (grad < today) bump(2, "Internship appears to require current enrolment, but your expected graduation date has passed. Update your profile.", "academic");
        else if (c.requiresGraduate && !c.studentOnly) bump(1, "Internship is aimed at graduates. You graduate " + edu.expectedGraduation + "; confirm they accept final-semester students or a start after graduation.", "academic");
        else pass("Student / internship role: you are an enrolled final-year student (graduating " + edu.expectedGraduation + ").");
        if (c.coopLetter) {
          const coop = ((edu.coopRequired || {}).value || "").toLowerCase();
          if (!coop) bump(1, "Requires a university co-op / training letter. Confirm IMSIU co-op requirement and letter in Settings.", "coop");
          else if (/no/.test(coop)) bump(3, "Program is only for students whose university requires co-op training; your profile says it is not required.", "coop");
          else pass("University co-op requirement confirmed in profile.");
        }
      } else if (!c.degreeMentioned && !isGradProgram) {
        bump(1, "No degree requirement stated, but this is a " + (job.type || "full-time") + " role while you are a final-semester student. Confirm you can meet the hours and start date.", "availability");
      } else if (isGradProgram || c.entry || /full|permanent|contract/.test(type)) {
        const m = monthsBetween(today, grad);
        if (c.gradYears && c.gradYears.length) {
          const y = grad.getFullYear();
          if (!c.gradYears.includes(y)) bump(3, "Program targets graduates of " + c.gradYears.join("/") + "; your expected graduation is " + edu.expectedGraduation + ".", "academic");
          else bump(1, "Targets " + c.gradYears.join("/") + " graduates; you graduate " + edu.expectedGraduation + ". Confirm they accept final-semester applicants.", "academic");
        } else bump(1, "Role expects a completed degree. You graduate " + edu.expectedGraduation + " (" + (m > 0 ? "in about " + m + " month(s)" : "soon") + "). Confirm the start date and that final-semester applicants are accepted.", "academic");
      }
    } else if (graduated && c.studentOnly) bump(3, "Program is for currently enrolled students.", "academic");
    if (c.tamheer) bump(1, "Tamheer / Tawteen on-the-job training: HRDF rules target Saudi graduates who have not been registered with GOSI (social insurance) in the previous 6 months and have not used Tamheer before. Your current part-time JNH role and TalMal internship may count as GOSI registration; confirm.", "tamheer");
    for (const f of job.manualFlags || []) bump(f.level, f.msg + " (manual review " + (job.verifiedDate || "") + ")", "manual");
    // degree
    if (c.degree === "other_engineering") bump(2, "Advert names a different engineering discipline. Mechanical may still be accepted; check the wording.", "degree");
    else if (c.degree === "business") bump(2, "Advert asks for a business / finance degree. An engineering degree may be accepted for analyst roles; confirm.", "degree");
    else if (c.degree === "mechanical" || c.degree === "engineering") pass("Degree field matches (" + (c.degree === "mechanical" ? "Mechanical Engineering" : "Engineering") + ").");
    // GPA
    if (c.gpa && edu.gpa && edu.gpa.private) reasons.push({ level: "NOTE", msg: "Advert sets a minimum GPA of " + c.gpa.min + (c.gpa.scale ? "/" + c.gpa.scale : "") + ". You keep your GPA private, so check this yourself.", kind: "gpa" });
    else if (c.gpa) {
      if (isNaN(gpaVal)) bump(1, "Minimum GPA " + c.gpa.min + (c.gpa.scale ? "/" + c.gpa.scale : "") + " stated. Your GPA is not in your profile.", "gpa");
      else if (gpaVal < c.gpa.min) bump(3, "Minimum GPA " + c.gpa.min + " is above your recorded GPA " + gpaVal + ".", "gpa");
      else pass("GPA requirement met.");
    }
    // experience
    if (c.minYears != null) {
      if (c.minYears >= 3) bump(3, "Requires " + c.minYears + "+ years of experience. Your documented experience is internships and a part-time role since 2025.", "experience");
      else if (c.minYears >= 1) bump(2, "Asks for " + c.minYears + "+ year(s) of experience. Internships and part-time work may partly count; stretch application.", "experience");
      else pass("No minimum experience (0 years) stated.");
    } else if (/mid-senior|director|executive/i.test(job.seniority || "")) bump(2, "Listed as " + job.seniority + " level although no years are stated.", "experience");
    // certifications
    const certHeld = (name) => {
      const items = profile.items || [];
      const rx = { SCE: /saudi council of engineers|\bSCE\b/i, PMP: /\bPMP\b/, NEBOSH: /NEBOSH/i, OSHA: /OSHA/i, IOSH: /IOSH/i, "GACA drone licence": /GACA/i }[name];
      if (!rx) return null;
      const hit = items.find((it) => it.type === "certification" && rx.test(it.title));
      if (!hit) return false;
      return TRUSTED.has(hit.status) ? true : "unverified";
    };
    for (const cert of c.certsRequired) {
      const held = certHeld(cert.name);
      if (held === true) pass(cert.name + " required: held (" + STATUS_LABEL.verified_doc + ").");
      else if (cert.mandatory) {
        if (cert.name === "SCE") bump(1, "Saudi Council of Engineers registration mentioned. Registration normally follows graduation; confirm whether it is needed at application or after hiring.", "cert");
        else if (cert.name === "Saudi driving licence") bump(1, "Driving licence mentioned. Not in your profile.", "cert");
        else bump(2, cert.name + " appears required and is not held" + (held === "unverified" ? " (in progress, not yet earned)" : "") + ".", "cert");
      } else bump(0, cert.name + " is preferred, not required.", "cert");
    }
    // location
    const loc = (job.location || "") + " " + (job.country || "");
    if (!/saudi|riyadh|jeddah|dammam|khobar|dhahran|jubail|yanbu|neom|tabuk|makkah|mecca|madinah|medina|abha|qassim|hail|jazan|kingdom/i.test(loc) && !/remote/i.test(loc)) bump(1, "Outside Saudi Arabia: work authorization and relocation need checking.", "location");
    const label = ["GREEN", "YELLOW", "ORANGE", "RED"][level];
    const summary = { GREEN: "Can apply", YELLOW: "Likely eligible, confirm", ORANGE: "Stretch opportunity", RED: "Not currently eligible" }[label];
    return { label, summary, reasons };
  }

  // ------------------------------------------------------------------ match scoring
  const ENTRY_TYPES = /intern|graduate|trainee|entry|fresh|co-?op|summer|junior|gdp/i;
  function scoreMatch(job, profile, analysis, opts) {
    opts = opts || {};
    analysis = analysis || analyzeJob(job);
    const taxonomy = opts.taxonomy || TAXONOMY;
    const idx = opts.evidenceIndex || profileEvidenceIndex(profile, taxonomy);
    const c = analysis.constraints;
    const kws = analysis.keywords.filter((k) => !["saudinational", "coop", "english", "arabic", "teamwork", "communication", "problemsolving", "timemgmt"].includes(k.id));
    const factors = [];
    const add = (key, label, weight, frac, why, details) => factors.push({ key, label, weight, points: Math.round(Math.max(0, Math.min(1, frac)) * weight * 10) / 10, why, details: details || [] });

    // 1 Education 15
    let ef, ew;
    if (c.degree === "mechanical") { ef = 1; ew = "Advert asks for Mechanical Engineering, your degree field."; }
    else if (c.degree === "engineering") { ef = 0.9; ew = "Advert accepts engineering degrees; Mechanical qualifies."; }
    else if (c.degree === "other_engineering") { ef = 0.35; ew = "Advert names a different engineering discipline."; }
    else if (c.degree === "business") { ef = 0.5; ew = "Advert leans to business degrees; engineering is often accepted for technical-commercial roles."; }
    else { ef = tracksHint(job) ? 0.7 : 0.4; ew = "No specific degree field stated" + (tracksHint(job) ? "; the role is engineering-related, so a Mechanical Engineering degree is relevant." : "; the role does not look engineering-specific."); }
    if (!(profile.education || {}).graduated && !/intern|co-?op|trainee|summer/i.test((job.type || "") + " " + (job.title || ""))) { ef -= 0.15; ew += " Degree completes January 2027, so it is not yet in hand."; }
    add("education", "Education and qualification match", 15, ef, ew);

    // 2 Experience & projects 25
    const domainK = kws.filter((k) => ["domain", "technical"].includes(k.cat));
    const withEv = domainK.filter((k) => idx[k.id] && idx[k.id].trusted.length);
    const itemsHit = new Map();
    const GENERIC = new Set(["hse", "documentation", "siteeng", "construction", "testing", "installation", "manufacturing"]);
    for (const k of withEv) for (const r of idx[k.id].trusted) if (r.kind === "item") itemsHit.set(r.id, (itemsHit.get(r.id) || 0) + Math.min(3, k.hits) * (GENERIC.has(k.id) ? 0.4 : 1));
    const jt = new Set(job.tracks && job.tracks.length ? job.tracks : inferTracks(job, analysis));
    for (const [id, v] of itemsHit) { const it = (profile.items || []).find((i) => i.id === id); if (it) itemsHit.set(id, v + 1.5 * (it.tracks || []).filter((t) => jt.has(t)).length); }
    const topItems = [...itemsHit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => (profile.items || []).find((i) => i.id === id)).filter(Boolean);
    let xf = domainK.length ? 0.25 + 0.75 * (withEv.length / domainK.length) : 0.2;
    if (domainK.length && domainK.length < 3) xf = Math.min(xf, 0.6);
    let xw = domainK.length ? withEv.length + " of " + domainK.length + " domain/technical requirements are backed by documented experience or projects." + (domainK.length < 3 ? " Few technical terms in the advert, so the overlap is thin." : "") : "The advert names no engineering or domain requirements that your experience can be matched against.";
    if (c.minYears >= 3) { xf -= 0.4; xw += " Advert asks for " + c.minYears + "+ years, far above your internship-level experience."; }
    else if (c.minYears >= 1) { xf -= 0.15; xw += " Advert asks for " + c.minYears + "+ year(s)."; }
    add("experience", "Relevant experience and projects", 25, xf, xw, topItems.map((i) => i.title + (i.org ? " (" + i.org + ")" : "")));

    // 3 Skills 20
    const skillK = kws.filter((k) => ["software", "technical", "business", "cert", "regulatory"].includes(k.cat));
    const sHave = skillK.filter((k) => idx[k.id] && idx[k.id].trusted.length);
    const sUnv = skillK.filter((k) => idx[k.id] && !idx[k.id].trusted.length && idx[k.id].unverified.length);
    const sf = skillK.length ? (sHave.length + 0.25 * sUnv.length) / skillK.length * (skillK.length < 2 ? 0.7 : 1) : 0.25;
    add("skills", "Technical and professional skills", 20, sf,
      skillK.length ? sHave.length + " of " + skillK.length + " named skills/tools are evidenced" + (sUnv.length ? "; " + sUnv.length + " only appear in unconfirmed items" : "") + "." : "Advert names no specific skills or tools from the keyword library.",
      [...sHave.map((k) => "Have: " + k.term), ...sUnv.map((k) => "Unconfirmed: " + k.term), ...skillK.filter((k) => !idx[k.id]).map((k) => "Missing: " + k.term)]);

    // 4 Entry-level suitability 15
    let lf = 0.5, lw = "Seniority not clear from the advert.";
    const sen = (job.seniority || "").toLowerCase();
    if (ENTRY_TYPES.test((job.type || "") + " " + (job.title || "")) || c.entry || /internship|entry/.test(sen)) { lf = 1; lw = "Explicitly aimed at students, interns, graduates or entry level."; }
    else if (c.minYears === 0) { lf = 0.9; lw = "No minimum experience stated."; }
    else if (/associate/.test(sen)) { lf = 0.65; lw = "Associate level: early-career but not graduate-specific."; }
    if (c.minYears >= 1 && c.minYears < 3) { lf = Math.min(lf, 0.5); lw = "Asks for " + c.minYears + " year(s) of experience."; }
    if (c.minYears >= 3 || /mid-senior|director|executive/.test(sen)) { lf = 0.1; lw = "Experienced-hire role."; }
    add("entry", "Entry-level suitability", 15, lf, lw);

    // 5 Industry / track alignment 10
    const tracks = job.tracks && job.tracks.length ? job.tracks : inferTracks(job, analysis);
    const pr = {}; (profile.careerTracks || []).forEach((t) => (pr[t.code] = t.priority));
    const best = tracks.length ? Math.min(...tracks.map((t) => pr[t] || 4)) : 4;
    const tf = tracks.length ? ({ 1: 1, 2: 0.8, 3: 0.6, 4: 0.35 }[best] || 0.35) : 0.1;
    add("track", "Industry and career-track alignment", 10, tf, "Career track(s): " + (tracks.map((t) => TRACKS[t] || t).join(", ") || "unclassified") + ". Priority " + (best < 4 ? best : "not set") + " in your profile.");

    // 6 Location 5
    const loc = (job.location || "").toLowerCase();
    let pf = 0.3, pw = "Outside Saudi Arabia.";
    if (/riyadh|الرياض/.test(loc)) { pf = 1; pw = "Riyadh: your home city."; }
    else if (/remote/.test(loc)) { pf = 0.85; pw = "Remote."; }
    else if (/saudi|jeddah|dammam|khobar|dhahran|jubail|yanbu|neom|tabuk|makkah|madinah|abha|qassim|kingdom|eastern/.test(loc)) { pf = 0.6; pw = "In Saudi Arabia outside Riyadh: relocation or rotation likely."; }
    add("location", "Location and work arrangement", 5, pf, pw);

    // 7 Development potential 10
    const dp = job.devPotential != null ? job.devPotential : defaultDevPotential(job);
    add("development", "Career development potential", 10, dp / 5, (job.devNote || "Estimated from employer type and role structure") + " (" + dp + "/5).");

    const total = Math.round(factors.reduce((s, f) => s + f.points, 0));
    // narrative
    const strengths = factors.filter((f) => f.points / f.weight >= 0.75).map((f) => f.label + ": " + f.why);
    const missing = kws.filter((k) => !idx[k.id] && k.cat !== "soft").map((k) => k.term);
    const mandatoryGaps = analysis.requirements.filter((r) => r.importance === "mandatory" && r.keywords.length && r.keywords.every((id) => !(idx[id] && idx[id].trusted.length))).map((r) => r.text);
    return {
      total, factors, tracks,
      suitable: strengths,
      supportingExperience: topItems.map((i) => ({ id: i.id, title: i.title, org: i.org })),
      missing,
      mandatoryGaps,
      emphasize: withEv.filter((k) => !GENERIC.has(k.id)).sort((a, b) => b.hits - a.hits).slice(0, 8).map((k) => k.term),
      strategy: strategyText(total, job, mandatoryGaps, topItems),
      disclaimer: "Estimated opportunity fit, not a probability of being hired.",
    };
  }
  function tracksHint(job) { return /engineer|technical|technician|mechanic|project|site|hse|safety|inspect|maintenance|quality|drone|uav|robot|energy|power|plant|survey|analyst|consult|planning|commission|operations|apprentice|graduate|co-?op|intern/i.test(job.title || ""); }
  function strategyText(total, job, gaps, topItems) {
    const lead = topItems[0] ? topItems[0].title.split(":")[0] : "your strongest project";
    if (total >= 75) return "Strong fit. Apply with a tailored CV that leads with " + lead + ", mirror the advert's own terminology, and follow up within a week.";
    if (total >= 60) return "Good fit. Tailor the summary and skills to the advert, address " + (gaps.length ? "the mandatory gaps openly" : "any experience gap") + " in the cover letter, and lead with " + lead + ".";
    if (total >= 45) return "Partial fit. Apply only if the employer or role is strategic for you; use a referral or recruiter message to explain why your project work transfers.";
    return "Weak fit. Keep for market intelligence; prioritise better-matched roles.";
  }
  function defaultDevPotential(job) {
    const e = (job.employer || "").toLowerCase();
    const big = /aramco|sabic|sami|gami|ma'?aden|acwa|saudi electricity|swcc|neom|pif|kacst|kaust|lockheed|boeing|raytheon|bae|airbus|thales|siemens|ge |schneider|abb|honeywell|parsons|atkins|jacobs|worley|wood|kbr|bechtel|technip|wsp|egis|aecom|dar al|mckinsey|bcg|kpmg|pwc|deloitte|ey|nestl|red sea global|roshn|qiddiya|diriyah|elm|sdaia|saudia|alfaisal|samsung|hyundai|larsen|halliburton|schlumberger|slb|baker hughes/;
    let d = big.test(e) ? 4 : 3;
    if (/graduate|development program|gdp|trainee/i.test(job.title || "")) d = Math.min(5, d + 1);
    return d;
  }
  function inferTracks(job, analysis) {
    const score = {};
    for (const k of analysis.keywords) for (const t of k.tracks) score[t] = (score[t] || 0) + Math.min(3, k.hits) * (k.cat === "domain" ? 2 : 1);
    const t = (job.title || "").toLowerCase();
    const boost = (code, rx) => { if (rx.test(t)) score[code] = (score[code] || 0) + 12; };
    boost("ME", /mechanic|mep|hvac|fire|plumb|maintenance|reliab|commission|production|manufactur|design eng|qa|qc|quality/);
    boost("UAV", /uav|drone|unmanned|uas/); boost("DEF", /defen|aero|aviation|military|missile|aircraft/);
    boost("ROB", /robot|autonom|automation|mechatron/); boost("INSP", /inspect|integrity|ndt|thermo|condition|survey|gis/);
    boost("HSE", /hse|safety|sshe|ehs|risk/); boost("ENERGY", /energy|power|oil|gas|solar|renewable|water|petro|plant|refin/);
    boost("PM", /project|planning|pmo|coordinat|site eng|field eng/); boost("BD", /business dev|sales|account|bd\b|solutions? eng|application eng|pre-?sales/);
    boost("STRAT", /strategy|analyst|commercial|finance|consult/);
    return Object.entries(score).sort((a, b) => b[1] - a[1]).filter(([, v], i, arr) => v >= Math.max(4, arr[0][1] * 0.45)).slice(0, 3).map(([k]) => k);
  }

  // ------------------------------------------------------------------ CV coverage
  function cvCoverage(analysis, cvText, profile, opts) {
    opts = opts || {};
    const taxonomy = opts.taxonomy || TAXONOMY;
    const idx = opts.evidenceIndex || profileEvidenceIndex(profile, taxonomy);
    const cv = norm(cvText || "");
    const ignore = new Set(["saudinational", "coop"]);
    const rows = [];
    for (const k of analysis.keywords) {
      if (ignore.has(k.id)) continue;
      const tk = taxById(k.id, taxonomy);
      const jdForms = Object.keys(k.variants);
      const exact = jdForms.filter((v) => countVariant(cv, v) > 0);
      const otherForms = [tk.term, ...tk.syn].filter((v) => !jdForms.includes(v) && countVariant(cv, v) > 0);
      const ev = idx[k.id];
      let status, note;
      if (exact.length) { status = "exact"; note = "CV uses the same wording: " + exact.join(", "); }
      else if (otherForms.length) { status = "equivalent"; note = "CV says '" + otherForms[0] + "', the advert says '" + jdForms[0] + "'."; }
      else if (ev && ev.trusted.length) { status = "supported"; note = "Not in CV, but evidenced by: " + [...new Set(ev.trusted.map((r) => r.title))].slice(0, 2).join("; "); }
      else if (ev && ev.unverified.length) { status = "unsupported"; note = "Only in unconfirmed items: " + [...new Set(ev.unverified.map((r) => r.title))].slice(0, 2).join("; ") + ". Confirm before using."; }
      else { status = "missing"; note = "No evidence in your profile."; }
      rows.push({ id: k.id, term: k.term, jdForms, hits: k.hits, cat: k.cat, status, note });
    }
    const n = rows.length || 1;
    const count = (s) => rows.filter((r) => r.status === s).length;
    const c = { exact: count("exact"), equivalent: count("equivalent"), supported: count("supported"), unsupported: count("unsupported"), missing: count("missing") };
    return {
      rows, counts: c, total: rows.length,
      keywordCoverage: Math.round(((c.exact + c.equivalent) / n) * 100),
      evidenceCoverage: Math.round(((c.exact + c.equivalent + c.supported) / n) * 100),
      method: "Keyword coverage = (exact + verified equivalent matches) / relevant keywords found in this advert. Evidence coverage also counts keywords your profile supports but your CV does not yet mention.",
    };
  }

  /** Requirement-by-requirement assessment for the analysis screen. */
  function requirementMatrix(analysis, cvModel, profile, opts) {
    opts = opts || {};
    const idx = opts.evidenceIndex || profileEvidenceIndex(profile, opts.taxonomy);
    const paras = (cvModel && cvModel.paragraphs) || [];
    const where = (kid) => {
      const tk = taxById(kid, opts.taxonomy);
      const forms = [tk.term, ...tk.syn];
      const secs = new Set();
      for (const p of paras) if (forms.some((f) => countVariant(p.text, f))) secs.add(p.section || "Header");
      return [...secs];
    };
    const c = analysis.constraints;
    return analysis.requirements.map((r) => {
      let meets = "Unclear", evidence = [], whereCV = [], canAdd = false, confirm = false;
      if (r.keywords.length) {
        const st = r.keywords.map((id) => {
          const e = idx[id];
          const w = where(id);
          whereCV.push(...w);
          if (e && e.trusted.length) { evidence.push(...e.trusted.map((x) => x.title)); if (!w.length) canAdd = true; return 2; }
          if (e && e.unverified.length) { confirm = true; evidence.push(...e.unverified.map((x) => x.title + " (unconfirmed)")); return 1; }
          return 0;
        });
        const avg = st.reduce((a, b) => a + b, 0) / st.length;
        meets = avg >= 1.6 ? "Yes" : avg >= 0.6 ? "Partly" : "No";
        if (confirm && meets !== "Yes") meets = "Confirm";
      }
      if (/(\d+)\s*\+?\s*(years|yrs)/i.test(r.text) && c.minYears != null) {
        meets = c.minYears === 0 ? "Yes" : c.minYears >= 3 ? "No" : "Partly";
        evidence.push("Internships 2025 to 2026 and part-time role since 04/2026");
      }
      if (/bachelor|degree|b\.?sc/i.test(r.text)) {
        meets = /mechanical|engineering/i.test(r.text) ? "Confirm" : meets;
        evidence.push("B.Sc. Mechanical Engineering, IMSIU, expected 01/2027 (not yet completed)");
        confirm = true;
      }
      if (/saudi national|saudis only/i.test(r.text)) { meets = "Confirm"; confirm = true; evidence.push("Nationality not recorded in profile"); }
      return { requirement: r.text, importance: r.importance, meets, evidence: [...new Set(evidence)].slice(0, 3), whereInCV: [...new Set(whereCV)], canIncorporate: canAdd ? "Yes, evidence exists but the CV does not show it" : meets === "Yes" ? "Already shown" : confirm ? "Only after you confirm" : "No", needsConfirmation: confirm };
    });
  }

  // ------------------------------------------------------------------ ATS readability
  function atsAssessDocx(model) {
    const checks = [];
    const add = (name, result, detail) => checks.push({ name, result, detail });
    const text = model.paragraphs.map((p) => p.text).join("\n");
    add("Text extraction", text.length > 500 ? "pass" : "fail", text.length + " characters extracted from the document body in reading order.");
    const email = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text), phone = /(\+?966|05)\s?\d[\d\s]{7,}/.test(text);
    const headerContact = (model.meta.headerText || "").match(/@|\+966/);
    add("Contact information", email && phone ? "pass" : "warn", (email ? "Email found. " : "Email NOT found in body. ") + (phone ? "Phone found." : "Phone NOT found in body.") + (headerContact ? " Some contact details sit in the page header, which some parsers skip." : ""));
    const heads = model.paragraphs.filter((p) => p.isHeading).map((p) => p.text);
    const std = heads.filter((h) => /profile|summary|experience|employment|education|skills|projects|certific|languages|leadership/i.test(h));
    add("Section headings", std.length >= 4 ? "pass" : "warn", "Recognised: " + (std.join(", ") || "none") + ".");
    const dates = text.match(/\b(0[1-9]|1[0-2])\/20\d\d\b|\b20\d\d\s*[–-]\s*(Present|20\d\d|\d\d\/20\d\d)/g) || [];
    add("Employment date recognition", dates.length >= 3 ? "pass" : "warn", dates.length + " date ranges in MM/YYYY or YYYY form detected. Consistent MM/YYYY is parsed well by most ATS.");
    add("Tables", model.meta.tables ? "warn" : "pass", model.meta.tables ? model.meta.tables + " table(s). Some ATS read table cells out of order." : "No tables.");
    add("Text boxes / shapes", model.meta.textboxes ? "fail" : "pass", model.meta.textboxes ? model.meta.textboxes + " text box(es). Text inside is often skipped by parsers." : "No text boxes.");
    add("Columns", model.meta.columns > 1 ? "warn" : "pass", model.meta.columns > 1 ? "Multi-column section layout." : "Single column.");
    add("Header / footer content", model.meta.headerText || model.meta.footerText ? "warn" : "pass", model.meta.headerText || model.meta.footerText ? "Content in header/footer: '" + ((model.meta.headerText || "") + " " + (model.meta.footerText || "")).trim().slice(0, 80) + "'." : "No header/footer text.");
    add("Images", model.meta.images ? "warn" : "pass", model.meta.images ? model.meta.images + " image(s). Text in images is invisible to ATS." : "No images.");
    const fonts = model.meta.fonts || [];
    const uncommon = fonts.filter((f) => !/arial|calibri|cambria|times|georgia|helvetica|garamond|verdana|tahoma|aptos|segoe|source sans|roboto|open sans|lato/i.test(f));
    add("Fonts", uncommon.length ? "warn" : "pass", "Fonts: " + (fonts.join(", ") || "default") + ". " + (/source sans/i.test(fonts.join()) ? "Source Sans Pro is not installed with Microsoft Office; if the recruiter opens the DOCX without it, Word substitutes a similar font. Send PDF where allowed." : ""));
    const glyph = /[-]/.test(text);
    add("Special characters", glyph ? "warn" : "pass", glyph ? "Private-use symbol characters found (icon fonts)." : "Standard characters and bullets only.");
    add("File integrity", model.meta.valid ? "pass" : "fail", model.meta.valid ? "DOCX package opened and parsed without errors." : "Could not parse the DOCX package.");
    const score = { pass: 0, warn: 0, fail: 0 }; checks.forEach((c) => score[c.result]++);
    return { checks, score, note: "Checks common parsing risks. ATS products differ and their ranking formulas are proprietary, so this is not a prediction of any specific system's result." };
  }
  function atsAssessPdfText(text, meta) {
    const checks = [];
    const add = (name, result, detail) => checks.push({ name, result, detail });
    add("Text layer", text.length > 500 ? "pass" : "fail", text.length > 500 ? text.length + " characters extracted (text-based PDF)." : "Little or no text: likely a scanned image. ATS cannot read it.");
    add("Contact information", /@/.test(text) && /\+?966|05\d/.test(text) ? "pass" : "warn", "Email and phone " + (/@/.test(text) ? "found" : "missing") + ".");
    const heads = (text.match(/^(Profile|Summary|Working Experience|Experience|Projects|Education|Skills|Certificates & Languages|Certifications)\s*$/gim) || []);
    add("Section headings", heads.length >= 4 ? "pass" : "warn", "Recognised: " + heads.join(", "));
    const dates = text.match(/\b(0[1-9]|1[0-2])\/20\d\d\b/g) || [];
    add("Employment date recognition", dates.length >= 3 ? "pass" : "warn", dates.length + " MM/YYYY dates found.");
    add("Reading order", meta && meta.orderOk === false ? "warn" : "pass", meta && meta.orderOk === false ? "Some right-aligned dates extract before their titles." : "Lines extract top-to-bottom.");
    add("Editability", "warn", "PDF text can be read but not edited in place with formatting guaranteed. Use the DOCX master for tailoring.");
    const score = { pass: 0, warn: 0, fail: 0 }; checks.forEach((c) => score[c.result]++);
    return { checks, score, note: "Checks common parsing risks only. ATS products differ." };
  }

  // ------------------------------------------------------------------ DOCX (format preserving)
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const HEADING_RX = /^(profile|summary|professional summary|objective|working experience|work experience|experience|professional experience|employment|projects|education|skills|technical skills|certificates( & languages)?|certifications|languages|awards|leadership|activities|volunteering|achievements)$/i;
  function wEls(node, local) { return Array.from(node.getElementsByTagNameNS(W, local)); }
  function paraSegments(p) {
    // ordered list of text-bearing nodes: {node, type:'t'|'tab'|'br', text}
    const segs = [];
    const walk = (n) => {
      for (let c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        const ln = c.localName;
        if (c.namespaceURI === W && ln === "t") segs.push({ node: c, type: "t", text: c.textContent });
        else if (c.namespaceURI === W && ln === "tab" && n.localName === "r") segs.push({ node: c, type: "tab", text: "\t" });
        else if (c.namespaceURI === W && (ln === "br" || ln === "cr") && n.localName === "r") segs.push({ node: c, type: "br", text: "\n" });
        else if (ln === "pPr" || ln === "rPr" || ln === "instrText" || ln === "delText") continue;
        else walk(c);
      }
    };
    walk(p);
    return segs;
  }
  function bodyParagraphs(doc) {
    const body = doc.getElementsByTagNameNS(W, "body")[0];
    return wEls(body, "p");
  }
  async function readDocx(JSZipLib, bytes, DOMParserImpl) {
    const zip = await JSZipLib.loadAsync(bytes);
    const xml = await zip.file("word/document.xml").async("string");
    const doc = new DOMParserImpl().parseFromString(xml, "application/xml");
    const ps = bodyParagraphs(doc);
    let section = "Header";
    const paragraphs = ps.map((p, i) => {
      const text = paraSegments(p).map((s) => s.text).join("");
      const hasBorder = wEls(p, "pBdr").length > 0;
      const isHeading = HEADING_RX.test(text.trim()) || (hasBorder && text.trim().length < 40 && text.trim().length > 0);
      if (isHeading) section = text.trim();
      const runs = wEls(p, "r");
      const bold = runs.length > 0 && runs.every((r) => wEls(r, "b").length > 0 || !wEls(r, "t").length);
      const inTable = !!(function up(n) { while (n) { if (n.localName === "tc") return true; n = n.parentNode; } return false; })(p);
      return { i, text, isHeading, section: isHeading ? text.trim() : section, bold, inTable, bullet: /^[•▪◦\-–*]\s*\t?/.test(text) || wEls(p, "numPr").length > 0 };
    });
    const fonts = new Set();
    const collectFonts = (x) => { const re = /<w:rFonts\b[^>]*\bw:ascii="([^"]+)"/g; let m; while ((m = re.exec(x))) fonts.add(m[1]); };
    collectFonts(xml);
    if (zip.file("word/styles.xml")) collectFonts(await zip.file("word/styles.xml").async("string"));
    const pgSz = wEls(doc, "pgSz")[0], pgMar = wEls(doc, "pgMar")[0];
    const attr = (n, a) => (n ? parseInt(n.getAttributeNS(W, a) || n.getAttribute("w:" + a) || "0", 10) : 0);
    let headerText = "", footerText = "";
    for (const name of Object.keys(zip.files)) {
      if (/^word\/header\d*\.xml$/.test(name)) headerText += (await zip.file(name).async("string")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (/^word\/footer\d*\.xml$/.test(name)) footerText += (await zip.file(name).async("string")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    const cols = wEls(doc, "cols")[0];
    const meta = {
      valid: true,
      pageWidthPt: attr(pgSz, "w") / 20, pageHeightPt: attr(pgSz, "h") / 20,
      margins: pgMar ? { top: attr(pgMar, "top") / 20, right: attr(pgMar, "right") / 20, bottom: attr(pgMar, "bottom") / 20, left: attr(pgMar, "left") / 20 } : null,
      fonts: [...fonts],
      tables: wEls(doc, "tbl").length,
      textboxes: wEls(doc, "txbxContent").length,
      images: wEls(doc, "drawing").length + doc.getElementsByTagName("v:imagedata").length,
      columns: cols ? attr(cols, "num") || 1 : 1,
      headerText: headerText.trim(), footerText: footerText.trim(),
      hyperlinks: wEls(doc, "hyperlink").length,
      paragraphCount: ps.length,
    };
    return { paragraphs, meta, text: paragraphs.map((p) => p.text).join("\n") };
  }
  /** Replace the text of one paragraph while keeping every run's formatting.
      Only the changed middle span is rewritten; untouched runs are not modified. */
  function editParagraphText(p, oldText, newText, doc) {
    const segs = paraSegments(p);
    const cur = segs.map((s) => s.text).join("");
    if (cur !== oldText) throw new Error("Paragraph text does not match the master (expected '" + oldText.slice(0, 40) + "...').");
    let pre = 0;
    while (pre < oldText.length && pre < newText.length && oldText[pre] === newText[pre]) pre++;
    let suf = 0;
    while (suf < oldText.length - pre && suf < newText.length - pre && oldText[oldText.length - 1 - suf] === newText[newText.length - 1 - suf]) suf++;
    const delStart = pre, delEnd = oldText.length - suf; // [delStart, delEnd)
    const insert = newText.slice(pre, newText.length - suf);
    if (delStart === delEnd && !insert) return;
    // map positions to segments
    let pos = 0, inserted = false;
    for (const s of segs) {
      const a = pos, b = pos + s.text.length;
      pos = b;
      const ovA = Math.max(a, delStart), ovB = Math.min(b, delEnd);
      const touches = ovA < ovB || (!inserted && delStart >= a && delStart <= b && s.type === "t" && (delStart < b || delStart === b));
      if (!touches) continue;
      if (s.type !== "t") {
        if (ovA < ovB) throw new Error("The change would delete a tab or line break that controls layout. Edit only the words.");
        continue;
      }
      const local = s.text;
      const la = Math.max(0, delStart - a), lb = Math.max(la, Math.min(local.length, delEnd - a));
      let replacement = "";
      if (!inserted) { replacement = insert; inserted = true; }
      const nt = local.slice(0, la) + replacement + local.slice(lb);
      s.node.textContent = nt;
      if (/^\s|\s$/.test(nt)) s.node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      s.text = nt;
    }
    if (!inserted) throw new Error("Could not place the inserted text.");
  }
  async function applyChangesToDocx(JSZipLib, masterBytes, changes, DOMParserImpl, XMLSerializerImpl) {
    const zip = await JSZipLib.loadAsync(masterBytes);
    const xml = await zip.file("word/document.xml").async("string");
    const declMatch = xml.match(/^<\?xml[^>]*\?>/);
    const doc = new DOMParserImpl().parseFromString(xml, "application/xml");
    const ps = bodyParagraphs(doc);
    const log = [];
    const removals = [];
    for (const ch of changes) {
      const p = ps[ch.paragraph];
      if (!p) { log.push({ id: ch.id, ok: false, error: "Paragraph " + ch.paragraph + " not found" }); continue; }
      try {
        if (ch.op === "remove") removals.push(p);
        else editParagraphText(p, ch.original, ch.proposed, doc);
        log.push({ id: ch.id, ok: true });
      } catch (e) { log.push({ id: ch.id, ok: false, error: e.message }); }
    }
    for (const p of removals) p.parentNode.removeChild(p);
    let out = new XMLSerializerImpl().serializeToString(doc);
    if (!/^<\?xml/.test(out)) out = (declMatch ? declMatch[0] : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>') + "\n" + out;
    zip.file("word/document.xml", out);
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return { bytes, log };
  }

  // ------------------------------------------------------------------ CV optimizer
  /* Pre-written alternatives for specific CV bullets. Every alternative restates facts that are
     documented in the profile (item id given) and is tagged with the keywords it brings forward. */
  const BULLET_VARIANTS = [
    { match: "Reviewed 11+ engineering drawings across HVAC, plumbing and firefighting scopes and resolved clashes with contractors", item: "E04", alts: [
      { tags: ["fireprotection", "mep", "clash", "drawings"], text: "Reviewed 11+ MEP drawings across HVAC, plumbing and fire protection (firefighting) scopes and resolved 8 clashes with contractors" },
      { tags: ["hvac", "ducting", "vrf", "clash"], text: "Reviewed 11+ HVAC, plumbing and firefighting drawings; resolved 8 clashes incl. duct resizing and rerouting around VRF units" } ] },
    { match: "Oversaw on-site installations and enforced HSE requirements, working to a zero-incident standard", item: "E04", alts: [
      { tags: ["installation", "hvac", "mep", "fireprotection", "plumbing"], text: "Oversaw on-site HVAC, plumbing and fire protection installations and enforced HSE requirements to a zero-incident standard" },
      { tags: ["hse", "riskassessment", "siteeng"], text: "Enforced HSE requirements during on-site MEP installations, working to a zero-incident standard" } ] },
    { match: "Coordinated multidisciplinary site crews of 15+ tradesmen against daily targets on an active construction site", item: "E04", alts: [
      { tags: ["planning", "siteeng", "construction", "pm", "mep"], text: "Coordinated MEP site crews of 15+ tradesmen against daily targets and proposed a shared electrical, mechanical and fire schedule" } ] },
    { match: "Designed a fixed-wing platform from a clean sheet, carrying it from concept through detailed design to build", item: "E03", alts: [
      { tags: ["solidworks", "cad", "drawings", "mechdesign", "3dprinting"], text: "Designed a fixed-wing UAV from a clean sheet in SolidWorks, releasing 45+ part drawings and taking it to 3D-printed parts" } ] },
    { match: "Owned the full bill of materials, balancing fixed cost and performance targets across the platform", item: "E03", alts: [
      { tags: ["bom", "procurement", "costcontrol", "payload", "autopilot"], text: "Owned the full bill of materials, selecting propulsion, avionics and structural components against cost and performance targets" } ] },
    { match: "Presented the department and its platforms to visiting delegations and investors, translating capability for non-technical decision makers", item: "E03", alts: [
      { tags: ["missionplanner", "ardupilot", "flightops", "uav"], text: "Set up Mission Planner and flight parameters for the lab's UAV platforms and presented them to visiting delegations and investors" } ] },
    { match: "Owned the mechanical design of the docking station from requirements to working prototype, coordinating suppliers and design reviews", item: "E01", alts: [
      { tags: ["fea", "mechdesign", "prototyping", "thermo", "telemetry"], text: "Owned the mechanical design of the docking station and an IP65 GCS enclosure with thermal management and FEA-checked retention hardware" } ] },
    { match: "Built the business strategy and technical validation plan for an autonomy initiative, covering competitive benchmarking, use case definition and presentations to senior stakeholders", item: "E01", alts: [
      { tags: ["slam", "lidar", "testing", "mining", "autonomy", "systemseng", "simulation"], text: "Built the technical validation plan for an underground-mining autonomy initiative (GPS-denied LiDAR SLAM), incl. benchmarking and a 5-module simulation test plan" } ] },
    { match: "Built the full flight simulation from scratch to validate the concept and support the pitch to judges", item: "P01", alts: [
      { tags: ["matlab", "simulink", "simulation", "kalman", "gnc"], text: "Built a 6-DOF MATLAB/Simulink flight model from scratch (15-state EKF, L1 guidance) to validate the concept for judges" } ] },
    { match: "Positioned NavPod as a plug-in upgrade that lets existing drone fleets navigate without GPS", item: "P01", alts: [
      { tags: ["slam", "navigation", "systemseng", "computervision", "ardupilot", "mavlink", "systemsintegration"], text: "Defined the two-loop architecture: SLAM-based GPS-denied navigation on a companion computer, ArduPilot flight control via MAVLink" } ] },
    { match: "Managed the hardware budget and procurement for the demo build, holding the pod to its 575 g weight target", item: "P01", alts: [
      { tags: ["solidworks", "cfd", "mechdesign"], text: "Designed the pod in SolidWorks, ran CFD on it and managed the hardware budget, holding it to its 575 g mass target" } ] },
    { match: "Led an autonomous aerial survey with a DJI Matrice 300 RTK, turning 147 images over 4,342 sqm into a 3D terrain model and orthomosaic", item: "P03", alts: [
      { tags: ["pix4d", "photogrammetry", "gaca", "surveying", "pointcloud", "flightops"], text: "Flew an autonomous DJI M300 RTK survey under GACA Part 107; processed 147 images (4,342 sqm) in PIX4Dmatic into a 3D mesh, DSM and orthomosaic" },
      { tags: ["ardupilot", "fixedwing", "flightops", "missionplanner"], text: "Assembled and flight-tested a custom fixed-wing UAV, configuring ArduPilot and Mission Planner for autonomous waypoint missions" } ] },
  ];
  const HEADLINES = {
    ME: "Senior Mechanical Engineering Student | MEP Site Engineering, Mechanical Design, Unmanned Systems",
    DEF: "Senior Mechanical Engineering Student | Unmanned Systems, Systems Engineering, Defence Technology",
    UAV: "Senior Mechanical Engineering Student | UAV Systems, Autonomous Navigation, Systems Engineering",
    ROB: "Senior Mechanical Engineering Student | Autonomous Systems, UAV Integration, Simulation",
    INSP: "Senior Mechanical Engineering Student | UAV Survey and Mapping, HSE, Mechanical Systems",
    HSE: "Senior Mechanical Engineering Student | Site HSE, MEP Installations, UAV Operations",
    ENERGY: "Senior Mechanical Engineering Student | Industrial Projects, Mechanical Systems, Business Cases",
    PM: "Senior Mechanical Engineering Student | Project Coordination, MEP Site Engineering, Unmanned Systems",
    BD: "Senior Mechanical Engineering Student | Technical Business Development, Business Cases, Unmanned Systems",
    STRAT: "Senior Mechanical Engineering Student | Business Cases, Financial Modeling, Engineering Projects",
  };
  const OBJECTIVE_DOMAIN = {
    ME: "mechanical and MEP engineering", DEF: "defence and unmanned systems", UAV: "UAV and autonomous systems", ROB: "robotics and autonomous systems",
    INSP: "industrial inspection and UAV survey", HSE: "HSE and site engineering", ENERGY: "energy and industrial projects", PM: "engineering project delivery",
    BD: "technical business development", STRAT: "strategy and commercial analysis",
  };
  const SKILL_LINE_FOR = (k) => {
    if (["business"].includes(k.cat) && !["pm", "planning", "stakeholder", "vendor", "pmo", "documentation"].includes(k.id)) return "Business & Commercial";
    if (["pm", "planning", "stakeholder", "vendor", "pmo", "leadership", "presentation", "documentation"].includes(k.id)) return "Leadership & Coordination";
    if (k.tracks.includes("INSP") || k.tracks.includes("HSE") || ["surveying", "gis", "pointcloud", "remotesensing", "telemetry"].includes(k.id)) return "Operations & Data";
    return "Engineering & Tools";
  };
  const CHARS_PER_LINE = 125; // fallback only
  let FONT_W = (typeof globalThis !== "undefined" && globalThis.CAREEROS_FONT_WIDTHS) || null;
  function setFontWidths(w) { FONT_W = w; }
  function textWidth(t, st, sz) { let w = 0; const tb = FONT_W[st]; for (const ch of t) w += (tb[ch] != null ? tb[ch] : tb["n"]) * sz; return w; }
  function wrapLines(t, st, sz, maxw) {
    // break opportunities: spaces, and after hyphens inside words (as Word and LibreOffice do)
    const sp = textWidth(" ", st, sz); let n = 1, cur = 0;
    const toks = [];
    t.split(" ").forEach((w) => { const parts = w.split(/(?<=-)(?=[A-Za-z])/); parts.forEach((pt, i) => toks.push({ w: textWidth(pt, st, sz), gap: i === 0 })); });
    for (const tk of toks) { const add = (cur === 0 ? 0 : tk.gap ? sp : 0) + tk.w; if (cur === 0) cur = tk.w; else if (cur + add <= maxw) cur += add; else { n++; cur = tk.w; } }
    return n;
  }
  /* Line count of a paragraph on the master layout: 527 pt text width, 9 pt body, bullets indented 12 pt,
     headline 10.5 pt. Glyph advance widths come from Source Sans Pro (data/font_widths.json); this reproduces
     LibreOffice's line breaks on the master. Without the width table it falls back to characters per line. */
  function estLines(text, kind) {
    if (!FONT_W) return Math.max(1, Math.ceil(text.replace(/^•\t/, "").length / CHARS_PER_LINE));
    if (/^•\t/.test(text)) return wrapLines(text.slice(2), "r", 9, 515);
    if (kind === "headline") return wrapLines(text, "r", 10.5, 527);
    if (text.includes("\t")) { const [a, b] = text.split("\t"); return textWidth(a, "b", 9) + textWidth(b || "", "r", 9) + 12 > 527 ? 2 : 1; }
    return wrapLines(text, "r", 9, 527);
  }

  function optimizeSuggestions(job, analysis, cvModel, profile, opts) {
    opts = opts || {};
    const taxonomy = opts.taxonomy || TAXONOMY;
    const idx = opts.evidenceIndex || profileEvidenceIndex(profile, taxonomy);
    const cov = cvCoverage(analysis, cvModel.text, profile, { evidenceIndex: idx, taxonomy });
    const want = new Set(cov.rows.filter((r) => r.status !== "missing" && r.status !== "unsupported").map((r) => r.id));
    const gaps = new Set(cov.rows.filter((r) => r.status === "supported" || r.status === "equivalent").map((r) => r.id));
    const tracks = job.tracks && job.tracks.length ? job.tracks : inferTracks(job, analysis);
    const sugg = [];
    let n = 0;
    const P = cvModel.paragraphs;
    const findP = (pred) => P.find(pred);
    const push = (o) => { o.id = "S" + ++n; const kind = o.type === "Headline" ? "headline" : ""; o.lineDelta = o.op === "remove" ? -estLines(o.original, kind) : estLines(o.proposed, kind) - estLines(o.original, kind); o.status = "pending"; sugg.push(o); };
    const isInternship = /intern|co-?op|trainee|summer/i.test((job.type || "") + " " + job.title);

    // 1. headline
    const head = findP((p) => p.section === "Header" && /Senior Mechanical Engineering Student \|/.test(p.text));
    const t0 = tracks[0];
    if (head && t0 && HEADLINES[t0] && HEADLINES[t0] !== head.text)
      push({ type: "Headline", paragraph: head.i, section: "Header", original: head.text, proposed: HEADLINES[t0], reason: "Aligns the headline with the " + (TRACKS[t0] || t0) + " track of this role. Every phrase is backed by documented work.", evidence: "Track inferred from the advert; phrases map to E01, E03, E04, P01, P03." });

    // 2. objective sentence of profile
    const prof = findP((p) => p.section === "Profile" && /Graduating January 2027 and seeking/.test(p.text));
    if (prof) {
      const m = prof.text.match(/Graduating January 2027 and seeking[^.]*\./);
      if (m) {
        const domain = OBJECTIVE_DOMAIN[t0] || "engineering";
        const role = isInternship ? "an internship or cooperative training placement" : /graduate (development |trainee )?program|\bgdp\b|development program|graduate trainee|tamayuz/i.test(job.title) ? "a place on a graduate development program" : "an entry-level " + cleanTitle(job.title) + " role";
        const sentence = "Graduating January 2027 and seeking " + role + " in " + domain + (job.employer ? " at " + job.employer : "") + ".";
        if (sentence !== m[0]) push({ type: "Profile summary", paragraph: prof.i, section: "Profile", original: prof.text, proposed: prof.text.replace(m[0], sentence), reason: "States the exact target (role type, field and employer) instead of a general co-op objective.", evidence: "Graduation date 01/2027 (education record)." });
      }
    }
    // 3. terminology alignment within bullets: CV uses a synonym, advert uses a different form
    for (const r of cov.rows.filter((r) => r.status === "equivalent")) {
      const tk = taxById(r.id, taxonomy);
      const jdForm = r.jdForms[0];
      const cvForm = [tk.term, ...tk.syn].find((v) => countVariant(cvModel.text, v));
      if (!cvForm || jdForm.length > 40) continue;
      if (tk.cat === "domain" && !["uav", "fixedwing", "multirotor", "robotics", "autonomy", "hse", "oilgas", "power", "renewables", "water"].includes(tk.id)) continue;
      // only body text: bullets, the profile summary and skills lines. Never titles, employer names, dates or the header.
      const p = findP((p) => !p.isHeading && countVariant(p.text, cvForm) && p.section !== "Header" && !p.bold && (p.bullet || p.section === "Profile" || (p.section === "Skills" && p.text.length > 40)) && !/\t/.test(p.text.replace(/^•\t/, "")));
      if (!p) continue;
      const re = variantRegex(cvForm); re.lastIndex = 0;
      const mm = re.exec(p.text);
      if (!mm) continue;
      const proposed = p.text.slice(0, mm.index) + jdForm + " (" + mm[0] + ")" + p.text.slice(mm.index + mm[0].length);
      if (proposed.length - p.text.length > 30) continue;
      push({ type: "Terminology", paragraph: p.i, section: p.section, original: p.text, proposed, reason: "The advert says '" + jdForm + "'. Your CV says '" + mm[0] + "' for the same thing. Using both helps keyword matching without changing the claim.", evidence: "Taxonomy equivalence: " + tk.term + " = " + [tk.term, ...tk.syn].join(" / ") });
    }
    // 4. bullet variants that surface supported keywords
    for (const bv of BULLET_VARIANTS) {
      const p = findP((p) => p.text.replace(/^•\t/, "") === bv.match);
      if (!p) continue;
      let best = null, bestScore = 0;
      for (const alt of bv.alts) {
        const grow = estLines(p.text.replace(bv.match, alt.text)) - estLines(p.text);
        const sc = alt.tags.filter((t) => want.has(t)).length + alt.tags.filter((t) => gaps.has(t)).length - (grow > 0 ? 1.5 * grow : 0);
        if (sc > bestScore) { best = alt; bestScore = sc; }
      }
      if (!best || bestScore < 2) continue;
      const it = (profile.items || []).find((i) => i.id === bv.item);
      if (it && !TRUSTED.has(it.status)) continue;
      push({ type: "Bullet", paragraph: p.i, section: p.section, original: p.text, proposed: p.text.replace(bv.match, best.text), reason: "Brings forward " + best.tags.filter((t) => want.has(t)).map((t) => taxById(t).term).join(", ") + ", which this advert asks for.", evidence: "Documented in " + (it ? it.title + " (" + STATUS_LABEL[it.status] + ")" : bv.item) });
    }
    // 5. skills lines: add supported keywords not shown anywhere in the CV
    const additions = {};
    for (const r of cov.rows.filter((r) => r.status === "supported")) {
      const k = taxById(r.id, taxonomy);
      if (["domain", "soft", "education", "regulatory"].includes(k.cat)) continue;
      const ev = idx[r.id];
      const strong = ev.trusted.some((x) => x.kind === "item" && !x.textual) || ev.trusted.some((x) => x.strength === "project");
      if (!strong) continue;
      const label = SKILL_LINE_FOR(k);
      (additions[label] = additions[label] || []).push(r.jdForms[0].length <= 30 ? r.jdForms[0] : k.term);
    }
    for (const [label, terms] of Object.entries(additions)) {
      const lp = findP((p) => p.text.trim() === label);
      if (!lp) continue;
      const line = P[lp.i + 1];
      if (!line) continue;
      const add = [...new Set(terms)].slice(0, 4);
      push({ type: "Skills", paragraph: line.i, section: "Skills", original: line.text, proposed: line.text.replace(/\s*$/, "") + ", " + add.join(", "), reason: "Adds " + add.join(", ") + ": requested in the advert and evidenced in your profile but not shown on the CV.", evidence: add.map((a) => { const r = cov.rows.find((x) => x.jdForms[0] === a || x.term === a); return r ? r.note : ""; }).join(" | ") });
    }
    // 6. integrity corrections (always offered)
    const eng = findP((p) => /HVAC Design/.test(p.text));
    if (eng) push({ type: "Integrity", paragraph: eng.i, section: eng.section, original: eng.text, proposed: eng.text.replace("HVAC Design", "HVAC Coordination"), reason: "Your documented HVAC work is installation coordination and clash resolution. 'HVAC Design' can be challenged in an interview unless you confirm design work.", evidence: "Integrity flag F2" });
    const fh = findP((p) => /\(165\+ flight hours\)/.test(p.text));
    if (fh) push({ type: "Integrity", paragraph: fh.i, section: fh.section, original: fh.text, proposed: fh.text.replace("(165+ flight hours)", "(165+ hours UAV training)"), reason: "Your earlier CV said 165+ hours of UAV training, and the Tuwaiq bootcamps total 165 training hours. Use this unless your logbook confirms 165+ flight hours.", evidence: "Integrity flag F1" });
    // 7. optional removal of low-relevance block
    if (!tracks.some((t) => ["BD", "STRAT"].includes(t))) {
      const tal = findP((p) => /^Business Development Intern,?/.test(p.text) && /TalMal/.test(p.text));
      if (tal) {
        const block = [tal, P[tal.i + 1], P[tal.i + 2]].filter((p) => p && (p === tal || p.bullet));
        block.forEach((p, j) => push({ type: "Remove (needs permission)", op: "remove", paragraph: p.i, section: p.section, original: p.text, proposed: "", reason: j === 0 ? "The fintech business-development internship is least relevant to this engineering role. Removing it frees about 3 lines for engineering content. Only applied if you accept." : "Part of the TalMal block above.", evidence: "Relevance: E02 is tagged BD/STRAT only." }));
      }
    }
    // measure each wording change on its own; drop any that would lower keyword coverage
    const base = cov.counts.exact + cov.counts.equivalent;
    const kept = [];
    for (const sg of sugg) {
      if (sg.op === "remove" || sg.type === "Integrity") { kept.push(sg); continue; }
      const t2 = applySuggestionsToText(cvModel, [sg]);
      const c2 = cvCoverage(analysis, t2, profile, { evidenceIndex: idx, taxonomy });
      sg.coverageImpact = c2.counts.exact + c2.counts.equivalent - base;
      if (sg.coverageImpact < 0) continue;
      if (sg.coverageImpact === 0 && (sg.type === "Bullet" || sg.type === "Terminology")) {
        const jd = new Set(analysis.keywords.map((k) => k.id));
        const before = new Set(findKeywords(sg.original, taxonomy).map((k) => k.id));
        const gained = findKeywords(sg.proposed, taxonomy).filter((k) => jd.has(k.id) && !before.has(k.id) && k.cat !== "soft");
        if (!gained.length) continue;
        sg.reason = "Puts " + gained.map((k) => k.term).join(", ") + " into this bullet, where the advert's reader will look for it.";
      }
      if (sg.coverageImpact > 0) sg.reason += " (+" + sg.coverageImpact + " advert keyword" + (sg.coverageImpact > 1 ? "s" : "") + " on the CV)";
      kept.push(sg);
    }
    kept.forEach((sg, i) => (sg.id = "S" + (i + 1)));
    return { suggestions: kept, coverage: cov, tracks };
  }
  function cleanTitle(t) { return (t || "").replace(/\(.*?\)/g, "").replace(/\s*[-–|:]\s+.*$|\s*\|.*$/g, "").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim(); }
  function applySuggestionsToText(cvModel, accepted) {
    const map = new Map();
    for (const s of accepted) map.set(s.paragraph, s);
    return cvModel.paragraphs.filter((p) => !(map.get(p.i) && map.get(p.i).op === "remove")).map((p) => (map.has(p.i) ? map.get(p.i).proposed : p.text)).join("\n");
  }
  function overflowEstimate(cvModel, accepted) {
    const kind = (a) => (a.type === "Headline" ? "headline" : "");
    const delta = accepted.reduce((s, a) => s + (a.op === "remove" ? -estLines(a.original, kind(a)) : estLines(a.proposed, kind(a)) - estLines(a.original, kind(a))), 0);
    const free = cvModel.freeLines != null ? cvModel.freeLines : 0;
    return { delta, free, risk: delta > free ? "high" : delta > 0 ? "low" : "none", note: (FONT_W ? "Measured with Source Sans Pro glyph widths on the master layout (matches LibreOffice line breaks)." : "Estimated from characters per line.") + " Word can wrap slightly differently; confirm the page count after export." };
  }

  // ------------------------------------------------------------------ application documents
  const TOPICS = {
    hvac: "HVAC basics: cooling load drivers, duct sizing (equal friction), VRF vs chilled-water systems, ventilation per ASHRAE 62.1.",
    fireprotection: "Fire protection: sprinkler system types (NFPA 13), standpipes and fire pumps, SBC 801 in Saudi projects.",
    plumbing: "Plumbing: drainage slopes, pipe sizing logic, vent systems, coordination with structure.",
    mep: "MEP coordination: clash detection workflow, shop drawing review, RFIs, sequencing trades on site.",
    clash: "Clash resolution: how you found and fixed the 8 Al-Tawala clashes, and how you would use Navisworks/BIM for the same.",
    commissioning: "Testing and commissioning: pre-functional checks, functional performance tests, punch lists, handover documentation.",
    maintenance: "Maintenance strategy: preventive vs predictive vs corrective, CMMS use, MTBF/MTTR.",
    reliability: "Reliability: FMEA, root cause analysis (5 Whys, fishbone), RCM principles.",
    qaqc: "QA/QC: inspection and test plans (ITP), NCRs, material inspection requests, hold and witness points.",
    hse: "HSE: hierarchy of controls, JSA/risk assessment, permit-to-work, incident reporting and the zero-incident standard you worked to.",
    riskassessment: "Risk assessment: likelihood x severity matrices, HAZID, controls and residual risk.",
    uav: "UAV systems: airframe types, propulsion sizing, endurance and payload trade-offs, regulatory limits (GACA).",
    flightops: "Flight operations: pre-flight checklists, mission planning, airspace and GACA Part 107 operating rules, emergency procedures.",
    navigation: "GPS-denied navigation: INS drift, visual/terrain-relative navigation, how NavPod bounds error between fixes.",
    slam: "SLAM: front end vs back end, loop closure, why LiDAR SLAM suits underground mines (your JNH benchmark).",
    kalman: "Kalman filtering: predict/update steps, process vs measurement noise, why an EKF for nonlinear dynamics.",
    gnc: "Guidance and control: PID tuning, L1 guidance, elevon mixing for tailless aircraft.",
    systemseng: "Systems engineering: requirements to verification traceability, interface control, test planning.",
    testing: "Test and validation: test matrix design, acceptance criteria, uncertainty (your PSP campaign is a good example).",
    systemsintegration: "Integration: autopilot, telemetry and GNSS wiring; MAVLink data flow; bench vs flight test.",
    photogrammetry: "Photogrammetry: overlap, GSD, ground control, accuracy checks (your Binban survey: 0.69 cm/px GSD).",
    inspection: "Inspection: visual inspection workflows, drone-based inspection reporting, defect classification.",
    thermography: "Thermography basics: emissivity, reflected temperature, delta-T criteria. Be clear this is an interest, not a credential.",
    solidworks: "SolidWorks: part/assembly modelling, drawings and tolerances, design for manufacture (your 45+ QSS drawings).",
    cfd: "CFD: meshing, boundary conditions, validation against theory (your fixed-wing and NavPod pod studies).",
    fea: "FEA: boundary conditions, mesh convergence, safety factors (your GCS retention hardware check).",
    bizdev: "Business development: qualifying leads, value propositions, pricing (your docking-station payback and margin curves).",
    businesscase: "Business cases: CAPEX/OPEX, payback, ROI, sensitivity (your MIRQAB value model and JNH docking station).",
    pm: "Project management: scope, schedule, cost, risk; critical path; how you delivered NavPod against a fixed deadline.",
    planning: "Planning: work breakdown structures, Primavera P6 / MS Project basics, look-ahead schedules.",
    oilgas: "Oil and gas: upstream vs downstream, rotating vs static equipment, Aramco standards (SAES) at a basic level.",
    power: "Power and utilities: plant types, availability and reliability, maintenance outages.",
    defence: "Defence industry: localization targets (GAMI), security clearance processes, systems engineering discipline.",
  };
  function pickEvidence(profile, analysis, n, jobTracks) {
    const ids = new Set(analysis.keywords.map((k) => k.id));
    return (profile.items || [])
      .filter((i) => TRUSTED.has(i.status) && ["employment", "internship", "project", "leadership", "achievement"].includes(i.type))
      .map((i) => ({ i, s: (i.skills || []).filter((k) => ids.has(k)).length + (i.type === "employment" || i.type === "internship" ? 0.5 : 0) + 1.5 * (i.tracks || []).filter((t) => (jobTracks || []).includes(t)).length }))
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map((x) => x.i);
  }
  function bestBullets(item, analysis, n) {
    const ids = analysis.keywords.map((k) => k.id);
    return (item.bullets || []).map((b) => ({ b, s: findKeywords(b).filter((k) => ids.includes(k.id)).length })).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.b);
  }
  const lc1 = (s) => (/^[A-Z][A-Z0-9]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
  function generatePackage(job, analysis, match, profile, company, opts) {
    opts = opts || {};
    const P = profile.personal, E = profile.education;
    const ev = pickEvidence(profile, analysis, 3, job.tracks && job.tracks.length ? job.tracks : inferTracks(job, analysis));
    const [a, b, c] = ev;
    const isIntern = /intern|co-?op|trainee|summer/i.test((job.type || "") + " " + job.title);
    const title = job.title, emp = job.employer;
    const kwTerms = analysis.keywords.filter((k) => !["soft"].includes(k.cat)).slice(0, 6).map((k) => k.term);
    const why = company && company.whyNote ? company.whyNote : "[Add one specific, true reason you want to join " + emp + ": a project, product, program or person you can name. CareerOS will not invent one.]";
    const VERB = /^(led|built|owned|designed|ran|wrote|flew|set|took|presented|reviewed|coordinated|oversaw|originated|defined|managed|positioned|planned|assembled|configured|released|produced|found|proposed|developed|engaged|co-led|completed|passed|selected|benchmarked|worked|source|pitch|support|coordinate|manage)\b/i;
    const sent = (b) => { b = b.replace(/\.$/, "").replace(/^\s*[-•]\s*/, ""); return VERB.test(b) ? "I " + lc1(b) : "my work included " + lc1(b); };
    const Sent = (b) => { const x = sent(b); return x.charAt(0).toUpperCase() + x.slice(1) + "."; };
    const role = (i) => i.type === "internship" ? "my internship as " + i.title + " at " + i.org : i.type === "employment" ? "my role as " + i.title + " at " + i.org : i.type === "project" ? "my project " + i.title.split(":")[0] : i.title + (i.org ? " (" + i.org + ")" : "");
    const coverLetter = [
      P.name, P.city + ", " + P.country + " | " + P.email + " | " + P.phone, "",
      new Date(opts.today || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), "",
      "Hiring Team, " + emp, (job.location || ""), "",
      "Re: " + title + (job.ref ? " (" + job.ref + ")" : ""), "",
      "Dear Hiring Team,", "",
      "I am applying for the " + title + " " + (isIntern ? "opportunity" : "position") + " at " + emp + ". I am a final-year Mechanical Engineering student at " + E.university + " in Riyadh and expect to graduate in January 2027" + (isIntern ? "." : ". I would be ready to start after graduation, subject to your timeline."),
      "",
      a ? "The experience most relevant to this role comes from " + role(a) + ". " + bestBullets(a, analysis, 2).map(Sent).join(" ") : "",
      "",
      b ? "In " + role(b) + ", " + bestBullets(b, analysis, 2).map(sent).join(", and ") + "." : "",
      "",
      c ? "I would also bring what I learned in " + role(c) + ", where " + sent(bestBullets(c, analysis, 1)[0] || c.title) + "." : "",
      "",
      why, "",
      "Your advert emphasises " + kwTerms.slice(0, 4).join(", ") + ". I have described above where my experience covers these, and I would welcome the chance to discuss the areas I am still developing.", "",
      "Thank you for your time and consideration.", "",
      "Sincerely,", P.name,
    ].filter((x, i, arr) => !(x === "" && arr[i - 1] === "")).join("\n");

    const firstName = (P.name || "").split(" ")[0];
    const messages = {
      recruiterIntro: "Hello [Name],\n\nI have applied for the " + title + " role at " + emp + ". I am a final-year Mechanical Engineering student at IMSIU (graduating January 2027). " + (a ? "Recently I " + lc1((bestBullets(a, analysis, 1)[0] || a.title).replace(/\.$/, "")) + "." : "") + " I would value a short conversation about the team and the role.\n\nThank you,\n" + P.name + "\n" + P.linkedin,
      followUp: "Hello [Name],\n\nI applied for the " + title + " position at " + emp + " on [date]. I remain very interested and wanted to confirm my application was received. I am happy to share anything else that would help.\n\nBest regards,\n" + P.name,
      internshipInquiry: "Hello [Name],\n\nI am a final-year Mechanical Engineering student at IMSIU (graduating January 2027) with UAV, MEP site and business-development experience. Does " + emp + " offer internships or co-op placements in [team]? My portfolio: " + P.portfolio + "\n\nThank you,\n" + firstName,
      graduateInquiry: "Hello [Name],\n\nI graduate in Mechanical Engineering from IMSIU in January 2027 and am exploring graduate opportunities at " + emp + ". Could you point me to the right program or contact? Portfolio: " + P.portfolio + "\n\nThank you,\n" + firstName,
      referralRequest: "Hello [Name],\n\nI am applying for the " + title + " role at " + emp + " and noticed you work there. Would you be open to a 10-minute chat about the team, and if you think I am a fit, a referral? My CV and portfolio are here: " + P.portfolio + "\n\nThank you,\n" + firstName,
      applicationEmail: "Subject: Application for " + title + (job.ref ? " (" + job.ref + ")" : "") + ", " + P.name + "\n\nDear Hiring Team,\n\nPlease find attached my CV for the " + title + " " + (isIntern ? "opportunity" : "position") + " at " + emp + ". I am a final-year Mechanical Engineering student at IMSIU in Riyadh, graduating in January 2027." + (a ? " " + Sent(bestBullets(a, analysis, 1)[0] || a.title) : "") + "\n\nI would welcome the opportunity to discuss how I can contribute to your team.\n\nKind regards,\n" + P.name + "\n" + P.phone + " | " + P.email + "\n" + P.portfolio,
      note: "CareerOS does not invent contact names or emails. Replace [Name] with a real contact you find on LinkedIn or the company site.",
    };
    const verifiedSkills = (profile.skills || []).filter((s) => TRUSTED.has(s.status) && s.strength !== "interest").map((s) => s.name.split(" (")[0]);
    const relevantSkills = verifiedSkills.filter((s) => findKeywords(s).some((k) => analysis.keywords.find((x) => x.id === k.id))).slice(0, 10);
    const form = [
      { q: "Tell us about yourself.", a: "I am a final-year Mechanical Engineering student at IMSIU in Riyadh, graduating January 2027. I work part-time as a UAV Systems Engineer at JNH Systems, interned at QSS AI & Robotics designing a fixed-wing UAV, and worked as an MEP site engineering intern at Athlath Construction. I led NavPod, a GPS-denied navigation pod that placed 2nd nationally at Defensathon 2026.", input: false },
      { q: "Why do you want to work here?", a: why, input: !(company && company.whyNote) },
      { q: "What relevant experience do you have?", a: ev.map((i) => "- " + i.title + (i.org ? " (" + i.org + ")" : "") + ": " + (bestBullets(i, analysis, 1)[0] || "")).join("\n"), input: false },
      { q: "Why are you suitable for this role?", a: match.suitable.slice(0, 3).map((s) => "- " + s).join("\n") + (match.mandatoryGaps.length ? "\n(Do not overstate: gaps exist in " + match.mandatoryGaps.length + " mandatory requirement(s).)" : ""), input: false },
      { q: "What technical skills do you have?", a: (relevantSkills.length ? relevantSkills : verifiedSkills.slice(0, 10)).join(", ") + ". (Only skills with documented evidence are listed.)", input: false },
      { q: "What is your graduation date?", a: "Expected January 2027 (Bachelor's in Mechanical Engineering, IMSIU). Not yet graduated.", input: false },
      { q: "What is your availability?", a: (P.availability && P.availability.value) || "[YOUR INPUT REQUIRED: start date and any co-op window]", input: !(P.availability && P.availability.value) },
      { q: "What are your salary expectations?", a: (P.salaryExpectation && P.salaryExpectation.value) || "[YOUR INPUT REQUIRED. CareerOS never fills this in.]" + (job.salary && job.salary !== "Not disclosed" ? " Advertised: " + job.salary + "." : ""), input: !(P.salaryExpectation && P.salaryExpectation.value) },
      { q: "Nationality / right to work?", a: (P.nationality && P.nationality.value) || "[YOUR INPUT REQUIRED]", input: !(P.nationality && P.nationality.value) },
      { q: "GPA?", a: (E.gpa && E.gpa.value) || (E.gpa && E.gpa.private ? "[Private: enter it yourself only if the form requires it]" : "[YOUR INPUT REQUIRED]"), input: !(E.gpa && (E.gpa.value || E.gpa.private)) },
    ];
    const sectionsHit = {};
    for (const r of (opts.coverage ? opts.coverage.rows : [])) if (["exact", "equivalent"].includes(r.status)) sectionsHit[r.term] = 1;
    const strategy = {
      relevantSections: ["Working Experience", "Projects", "Skills"].filter(Boolean),
      sellingPoints: ev.map((i) => i.title + (i.org ? " (" + i.org + ")" : "")),
      emphasize: match.emphasize,
      weaknesses: [...match.mandatoryGaps.slice(0, 4), ...(analysis.constraints.minYears >= 1 ? ["Experience requirement: " + analysis.constraints.minYears + "+ years"] : []), "Degree completes January 2027"],
      talkingPoints: ev.map((i) => (bestBullets(i, analysis, 1)[0] || i.title)),
      prepare: ["Your exact availability and notice for current roles (JNH part-time, TalMal internship)", "GPA and transcript", "A 2-minute walkthrough of NavPod with one number you can defend", "Why " + emp + " specifically"],
      approach: match.strategy,
    };
    const topics = analysis.keywords.map((k) => TOPICS[k.id]).filter(Boolean).slice(0, 8);
    const qFromJD = [
      ...analysis.responsibilities.slice(0, 5).map((r) => "This role involves: \"" + r.text.slice(0, 140) + "\". Describe a time you did something similar."),
      ...analysis.requirements.filter((r) => r.importance === "mandatory").slice(0, 4).map((r) => "How does your background meet: \"" + r.text.slice(0, 140) + "\"?"),
    ];
    const interview = {
      company: company ? [company.name + " (" + company.industry + ", " + company.location + ")", company.notes || ""].filter(Boolean) : ["[Research the company: core business, recent projects, Saudi footprint.]"],
      responsibilities: analysis.responsibilities.slice(0, 8).map((r) => r.text),
      technicalTopics: topics,
      likelyQuestions: qFromJD,
      generalQuestions: ["Walk me through your CV.", "Tell me about NavPod and your specific contribution.", "Describe a conflict on a team and how you handled it.", "Tell me about a mistake and what you changed afterwards.", "Where do you see yourself in three years?"],
      questionsToAsk: ["What does success look like in the first six months?", "How are new engineers trained and rotated across projects?", "Which projects would I join first?", "How is performance reviewed for graduates or interns?", "What are the next steps and timeline?"],
      evidenceMap: ev.map((i) => ({ item: i.title, use: bestBullets(i, analysis, 2) })),
      note: "Questions above are generated from the advert text. They are not questions supplied by the employer.",
    };
    const checklist = [
      "Re-open the original advert and confirm it is still open: " + (job.source || ""),
      "Generate the tailored CV (DOCX) and export PDF",
      "Read the cover letter aloud and fix anything that does not sound like you",
      "Fill fields marked YOUR INPUT REQUIRED",
      ...(analysis.constraints.coopLetter ? ["Get the university co-op / training letter"] : []),
      ...(analysis.constraints.nationality === "saudi" ? ["Have National ID ready (Saudi nationals only)"] : []),
      "Apply via: " + (job.applyUrl || job.source || "see advert"),
      "Mark the application as Applied in the Tracker only after you submit",
      "Set a follow-up date 7 to 10 days after applying",
    ];
    return { coverLetter, messages, form, strategy, interview, checklist, generatedFor: job.id };
  }

  return {
    TAXONOMY, TRACKS, STATUS_LABEL, TRUSTED,
    findKeywords, countVariant, profileEvidenceIndex, analyzeJob, extractConstraints, evaluateEligibility,
    scoreMatch, inferTracks, cvCoverage, requirementMatrix, atsAssessDocx, atsAssessPdfText,
    readDocx, applyChangesToDocx, setFontWidths, estLines, editParagraphText, optimizeSuggestions, applySuggestionsToText, overflowEstimate,
    generatePackage, defaultDevPotential, BULLET_VARIANTS, TOPICS, cleanTitle,
  };
});
