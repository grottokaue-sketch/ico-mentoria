/* ICP na prática · aplicação estática (sem servidor). Estado salvo no localStorage do navegador. */
(function () {
  "use strict";
  const CFG = window.CONFIG || {}, U = window.U, TOOLS = window.TOOLS, SLIDES = window.SLIDES, SECTIONS = window.SECTIONS;
  const KEY = CFG.storageKey || "icp-mentoria-v1";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = U.esc;
  const TOOLSLIDE = {};
  SLIDES.forEach(s => { if (s.type === "tool") TOOLSLIDE[s.tool] = s.id; });

  /* ---------- estado ---------- */
  let S = { startup: "", data: {}, checks: {}, poll: {}, text: {}, seen: {}, last: "" };
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
  let saveTimer = null, PRINTING = false, idx = 0, timerInt = null;

  function save() {
    $("#saveState").textContent = "Salvando…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      let ok = true;
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { ok = false; }
      $("#saveState").textContent = ok ? "Salvo neste navegador" : "Não foi possível salvar: exporte um backup";
    }, 300);
  }
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500);
  }

  /* ---------- acesso aos dados das ferramentas ---------- */
  const secDef = (key, id) => TOOLS[key].sections.find(s => s.id === id);
  function store(key, id) { const d = (S.data[key] = S.data[key] || {}); return (d[id] = d[id] || { rows: null, fields: {} }); }
  function getRows(key, id) {
    const st = store(key, id), sd = secDef(key, id); if (!st.rows) st.rows = []; const r = st.rows;
    if (sd.rows) { while (r.length < sd.rows.length) r.push(Object.assign({}, sd.rows[r.length].init || {})); }
    else if (sd.kind === "table") { const init = sd.init || []; while (r.length < Math.max(sd.min || 0, init.length)) r.push(Object.assign({}, init[r.length] || {})); }
    return r;
  }
  function fieldsOf(key, id) {
    const sd = secDef(key, id), st = store(key, id), out = {};
    (sd.fields || []).forEach(f => { const v = st.fields[f.k]; out[f.k] = (v === undefined || v === "") ? (f.def !== undefined ? f.def : "") : v; });
    return out;
  }
  function makeCtx(key, id, i) {
    const sd = secDef(key, id), rows = sd.kind === "table" ? getRows(key, id) : [];
    const c = {
      rows, i, row: rows[i] || {}, def: (sd.rows && sd.rows[i]) || {}, defs: sd.rows || [],
      val: (t, s, ri, k) => { const r = getRows(t, s)[ri]; return r ? r[k] : undefined; },
      get: (t, s) => getRows(t, s), fields: (t, s) => fieldsOf(t, s),
      total: () => {
        let v = U.num(fieldsOf("padroes", "cfg").total); if (v > 0) return v;
        v = U.num(TOOLS.padroes.sections[0].fields[0].auto(c)); return v > 0 ? v : 0;
      }
    };
    return c;
  }
  const colLabel = (col, c) => (typeof col.l === "function" ? col.l(c) : col.l);
  const editable = sd => sd.columns.filter(c => c.t !== "calc" && c.t !== "st");
  function rowFilled(r, sd) {
    const cols = sd.trackCols ? sd.columns.filter(c => sd.trackCols.indexOf(c.k) > -1) : editable(sd);
    return cols.some(c => String(r[c.k] === undefined ? "" : r[c.k]).trim() !== "");
  }
  function toolPct(key) {
    const parts = [];
    TOOLS[key].sections.forEach(sd => {
      if (sd.kind !== "table" || sd.noTrack) return;
      const rows = getRows(key, sd.id), filled = rows.filter(r => rowFilled(r, sd)).length;
      parts.push(Math.min(1, filled / (sd.target || rows.length || 1)));
    });
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  }
  const overall = () => U.avg(window.TOOL_ORDER.map(toolPct));

  /* ---------- HTML das ferramentas ---------- */
  function cellHTML(key, sd, i, col, row, def, c) {
    const v = row[col.k] === undefined ? "" : row[col.k];
    const at = 'data-t="' + key + '" data-s="' + sd.id + '" data-i="' + i + '" data-k="' + col.k + '"';
    switch (col.t) {
      case "st": return '<td class="st">' + (def.group ? "<small>" + esc(def.group) + "</small>" : "") + esc(def.label || "") + (def.hint ? "<small>" + esc(def.hint) + "</small>" : "") + "</td>";
      case "calc": return '<td class="calc" ' + at + ' data-calc="1"' + (col.wrap ? ' style="white-space:normal;text-align:left"' : "") + ">" + esc(col.f(c) == null ? "" : col.f(c)) + "</td>";
      case "area": return '<td><textarea class="cell" rows="1" ' + at + ">" + esc(v) + "</textarea></td>";
      case "sel": return '<td><select class="cell" ' + at + '><option value=""></option>' + col.o.map(o => '<option value="' + esc(o) + '"' + (String(v) === String(o) ? " selected" : "") + ">" + esc(o) + "</option>").join("") + "</select></td>";
      case "date": return '<td><input class="cell" type="date" ' + at + ' value="' + esc(v) + '"></td>';
      case "num": return '<td><input class="cell" type="text" inputmode="decimal" ' + at + ' value="' + esc(v) + '"></td>';
      default: return '<td><input class="cell" type="text" ' + at + ' value="' + esc(v) + '"></td>';
    }
  }
  function sumHTML(key, sd) { return sd.sum ? sd.sum(makeCtx(key, sd.id, -1)) : ""; }
  function secHTML(key, sd) {
    let h = '<div class="sec" data-sec="' + sd.id + '">';
    if (sd.title) h += "<h3>" + esc(sd.title) + "</h3>";
    if (sd.kind === "html") return h + sd.render() + "</div>";
    if (sd.kind === "fields") {
      const f = fieldsOf(key, sd.id), c = makeCtx(key, sd.id, -1);
      h += '<div class="fields">' + sd.fields.map(fd => {
        const ph = fd.auto ? fd.auto(c) : "";
        return '<label>' + esc(fd.l) + '<input type="text" inputmode="decimal" data-f="' + key + "|" + sd.id + "|" + fd.k + '" value="' + esc(f[fd.k]) + '"' + (fd.auto ? ' data-auto="1" placeholder="' + esc(ph) + '"' : "") + "></label>";
      }).join("") + "</div></div>";
      return h;
    }
    const rows = getRows(key, sd.id), hc = makeCtx(key, sd.id, -1);
    h += '<div class="twrap"><table class="grid"><thead><tr>' + (sd.dyn ? '<th style="min-width:36px">#</th>' : "") +
      sd.columns.map(col => "<th" + (typeof col.l === "function" ? ' data-hl="' + col.k + '"' : "") + ' style="min-width:' + (col.w || (col.t === "area" ? 220 : 140)) + 'px">' + esc(colLabel(col, hc)) + "</th>").join("") + "</tr></thead><tbody>";
    rows.forEach((row, i) => {
      const c = makeCtx(key, sd.id, i), def = (sd.rows && sd.rows[i]) || {};
      h += "<tr>" + (sd.dyn ? '<td class="n">' + (i + 1) + "</td>" : "") + sd.columns.map(col => cellHTML(key, sd, i, col, row, def, c)).join("") + "</tr>";
    });
    h += "</tbody></table></div>";
    if (sd.sum) h += '<div data-sum="' + key + "|" + sd.id + '">' + sumHTML(key, sd) + "</div>";
    if (sd.dyn) h += '<button class="btn line small addrow" data-add="' + key + "|" + sd.id + '">+ Adicionar linha</button>';
    return h + "</div>";
  }
  function toolHTML(key) {
    const T = TOOLS[key];
    return '<div class="tool" data-tool="' + key + '"><div><h3 style="font-size:26px">' + T.num + " · " + esc(T.title) + '</h3><p class="intro">' + esc(T.intro) + "</p></div>" + T.sections.map(sd => secHTML(key, sd)).join("") + "</div>";
  }

  /* ---------- recálculo ao vivo (sem perder o foco) ---------- */
  function recalc(root) {
    $$("[data-calc]", root).forEach(td => {
      const key = td.dataset.t, sd = secDef(key, td.dataset.s), col = sd.columns.find(x => x.k === td.dataset.k);
      const v = col.f(makeCtx(key, sd.id, +td.dataset.i)); td.textContent = v == null ? "" : v;
    });
    $$("[data-sum]", root).forEach(d => { const p = d.dataset.sum.split("|"); d.innerHTML = sumHTML(p[0], secDef(p[0], p[1])); });
    $$("th[data-hl]", root).forEach(th => {
      const tool = th.closest("[data-tool]"), sec = th.closest("[data-sec]"); if (!tool || !sec) return;
      const sd = secDef(tool.dataset.tool, sec.dataset.sec), col = sd.columns.find(x => x.k === th.dataset.hl);
      th.textContent = colLabel(col, makeCtx(tool.dataset.tool, sd.id, -1));
    });
    $$("input[data-auto]", root).forEach(inp => {
      const p = inp.dataset.f.split("|"), fd = secDef(p[0], p[1]).fields.find(x => x.k === p[2]);
      inp.placeholder = fd.auto(makeCtx(p[0], p[1], -1));
    });
  }
  function grow(t) { t.style.height = "auto"; t.style.height = (t.scrollHeight + 2) + "px"; }
  const growAll = root => $$("textarea.cell", root).forEach(grow);

  /* ---------- slides ---------- */
  const foot = s => (s ? '<p class="foot">' + esc(s) + "</p>" : "");
  const eyebrow = s => (s ? '<div class="eyebrow">' + esc(s) + "</div>" : "");
  const rv = () => (PRINTING ? "" : " rv");
  const rvAttr = () => (PRINTING ? "" : " data-rv");
  function listHTML(l) { return l && l.length ? "<ul>" + l.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" : ""; }

  function slideHTML(sl) {
    const t = sl.type;
    if (t === "hero") {
      const cls = sl.dark === true ? " dark" : sl.dark === "pale" ? " pale" : "";
      let f = "";
      if (sl.form) f = '<div class="firstrun"><label>Nome da startup<input id="inpStartup" type="text" placeholder="Ex.: ISnano" value="' + esc(S.startup) + '"></label><button class="btn" data-go="next">Começar →</button></div><p class="foot" style="color:#8DBCEA">' + esc(CFG.mentor || "") + " · " + esc(CFG.programa || "") + "</p>";
      return '<section class="slide hero' + cls + '"><div class="inner">' + eyebrow(sl.eyebrow) + "<h1>" + esc(sl.title) + "</h1>" + (sl.lead ? '<p class="lead">' + esc(sl.lead) + "</p>" : "") + f + "</div></section>";
    }
    if (t === "frase" || t === "checkout") {
      const prev = t === "checkout" ? '<div class="card pale"><div class="step">SUA FRASE DO INÍCIO</div><p>' + esc(S.text.frase0 || "(você não escreveu uma frase no início)") + "</p></div>" : "";
      return '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + "</h2>" + (sl.lead ? '<p class="lead">' + esc(sl.lead) + "</p>" : "") +
        '<textarea class="ta" data-txt="' + sl.key + '" rows="4" placeholder="Escreva aqui…">' + esc(S.text[sl.key] || "") + "</textarea>" + prev + "</section>";
    }
    if (t === "cards") {
      const first = sl.id === "conceito", co = sl.callout ? '<div class="callout' + (first ? "" : rv()) + '"' + (first ? "" : rvAttr()) + ">" + sl.callout + "</div>" : "";
      return '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + "</h2>" + (first ? co : "") +
        '<div class="cards c' + (sl.cols || 3) + '">' + sl.cards.map(c => '<div class="card ' + (c.cls || "") + rv() + '"' + rvAttr() + ">" + (c.step ? '<div class="step">' + esc(c.step) + "</div>" : "") + "<h3>" + esc(c.h) + "</h3>" + (c.p ? "<p>" + esc(c.p) + "</p>" : "") + listHTML(c.ul) + "</div>").join("") + "</div>" +
        (first ? "" : co) + foot(sl.foot) + "</section>";
    }
    if (t === "compare") {
      const side = o => '<div class="card ' + (o.cls || "") + rv() + '"' + rvAttr() + "><h3>" + esc(o.h) + "</h3>" + listHTML(o.list) + (o.p ? "<p>" + esc(o.p) + "</p>" : "") + "</div>";
      return '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + '</h2><div class="cols2">' + side(sl.left) + side(sl.right) + "</div>" + foot(sl.foot) + "</section>";
    }
    if (t === "quiz") {
      return '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + '</h2><div class="quiz">' + sl.items.map(it =>
        '<div class="qrow"><div class="q">' + esc(it.q) + '</div><div class="a' + (PRINTING ? " on" : "") + '" data-rv="a" data-a="' + esc(it.a) + '">' + (PRINTING ? esc(it.a) : "?") + "</div></div>").join("") + '</div><p class="rv-hint">Use “Revelar” (ou a tecla →) para mostrar cada resposta.</p></section>';
    }
    if (t === "poll") {
      const cur = S.poll[sl.key];
      return '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + '</h2><div class="poll">' + sl.opts.map(o => '<button class="opt' + (cur === o.n ? " sel" : "") + '" data-poll="' + sl.key + "|" + o.n + '"><b>' + o.n + "</b><strong>" + esc(o.h) + "</strong>" + esc(o.p) + "</button>").join("") + "</div>" + foot(sl.foot) + "</section>";
    }
    if (t === "table") {
      return '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + "</h2>" + (sl.callout ? '<div class="callout">' + sl.callout + "</div>" : "") +
        '<table class="static"><thead><tr>' + sl.head.map(h => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>" + sl.rows.map(r => "<tr>" + r.map(c => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table>" + foot(sl.foot) + "</section>";
    }
    if (t === "grid") {
      const n = sl.head.length;
      let h = '<div class="grid-m" style="grid-template-columns:170px repeat(' + n + ',1fr)"><div></div>' + sl.head.map(x => '<div class="h">' + esc(x) + "</div>").join("");
      sl.rows.forEach(r => {
        h += '<div class="h l">' + esc(r[0]) + "</div>";
        r.slice(1).forEach(v => {
          if (typeof v === "number") h += '<div class="gm s' + Math.min(4, v - 1) + '">Prioridade ' + v + "</div>";
          else { const p = String(v).split("|"); h += '<div class="gm s' + (p[1] || 0) + '">' + esc(p[0]) + "</div>"; }
        });
      });
      return '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + "</h2>" + h + "</div>" + (sl.callout ? '<div class="callout">' + sl.callout + "</div>" : "") + foot(sl.foot) + "</section>";
    }
    if (t === "discuss") {
      const cls = sl.dark === "pale" ? " pale" : "";
      return '<section class="slide hero' + cls + '"><div class="inner">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + "</h2>" + sl.prompts.map((p, i) =>
        '<div class="' + rv().trim() + '"' + rvAttr() + '><label class="lead" style="display:block;margin-bottom:6px">' + esc(p) + '</label><textarea class="ta" rows="2" data-txt="d:' + sl.id + ":" + i + '" placeholder="Anote aqui…">' + esc(S.text["d:" + sl.id + ":" + i] || "") + "</textarea></div>").join("") + "</div></section>";
    }
    if (t === "tasks") {
      const ch = S.checks[sl.key] || [];
      return '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + '</h2><div class="tasks">' + sl.items.map((it, i) =>
        '<label class="task' + (ch[i] ? " done" : "") + '"><input type="checkbox" data-chk="' + sl.key + "|" + i + '"' + (ch[i] ? " checked" : "") + "><span>" + esc(it.t) +
        (it.tool && TOOLSLIDE[it.tool] ? '<small><a href="#/' + TOOLSLIDE[it.tool] + '">Abrir ferramenta ' + TOOLS[it.tool].num + " · " + esc(TOOLS[it.tool].title) + "</a></small>" : "") + "</span></label>").join("") + "</div></section>";
    }
    if (t === "tool") {
      return '<section class="slide"><div class="exhead">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + "</h2>" +
        (sl.minutes ? '<div class="timer" data-min="' + sl.minutes + '"><span>⏱</span><span class="t">' + String(sl.minutes).padStart(2, "0") + ':00</span><button data-tm="go">Iniciar</button><button data-tm="reset">Zerar</button></div>' : "") + "</div>" +
        '<div class="steps">' + sl.steps.map((s, i) => '<div class="stepc"><b>' + (i + 1) + "</b><span>" + esc(s) + "</span></div>").join("") + "</div>" + toolHTML(sl.tool) + "</section>";
    }
    if (t === "painel") return painelHTML(sl);
    return "";
  }

  function painelHTML(sl) {
    const pct = overall(), tot = n => (S.checks[n] || []).filter(Boolean).length;
    const dv = ["dever1", "dever2", "dever3"].map((k, i) => { const s = SLIDES.find(x => x.key === k); return "Dever " + (i + 1) + ": " + tot(k) + " de " + s.items.length; }).join(" · ");
    const mat = S.poll.maturidade;
    let h = '<section class="slide">' + eyebrow(sl.eyebrow) + "<h2>" + esc(sl.title) + (S.startup ? " · " + esc(S.startup) : "") + "</h2>" +
      '<div class="sumbox"><div><b>' + U.pct(pct) + "</b>frameworks preenchidos</div><div><b>" + (mat === undefined ? "-" : mat) + "</b>maturidade do ICP (0 a 3)</div><div style=\"align-self:center;font-size:16px\">" + dv + "</div></div>";
    [1, 2, 3].forEach(e => {
      h += "<h3>Encontro " + e + "</h3><div class=\"tools-grid\">" + window.TOOL_ORDER.filter(k => TOOLS[k].enc === e).map(k => {
        const p = toolPct(k);
        return '<a class="pcard" href="#/' + TOOLSLIDE[k] + '"><b>' + TOOLS[k].num + " · " + esc(TOOLS[k].title) + '</b><div class="pb"><i style="width:' + Math.round(p * 100) + '%"></i></div><span>' + U.pct(p) + " preenchido</span></a>";
      }).join("") + "</div>";
    });
    h += '<div class="cols2"><div class="card pale"><div class="step">FRASE DO INÍCIO</div><p>' + esc(S.text.frase0 || "-") + '</p></div><div class="card pale"><div class="step">FRASE DO FIM</div><p>' + esc(S.text.frase1 || "-") + "</p></div></div>" +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-act="xlsx">Baixar Excel</button><button class="btn line" data-act="json">Baixar backup</button><button class="btn line" data-act="send">Enviar ao mentor</button></div></section>';
    return h;
  }

  /* ---------- navegação ---------- */
  function slideProgress(sl) {
    if (sl.type === "tool") return toolPct(sl.tool);
    if (sl.type === "tasks") { const c = S.checks[sl.key] || []; return c.filter(Boolean).length / sl.items.length; }
    if (sl.type === "poll") return S.poll[sl.key] !== undefined ? 1 : 0;
    if (sl.type === "frase" || sl.type === "checkout") return (S.text[sl.key] || "").trim() ? 1 : 0;
    return S.seen[sl.id] ? 1 : 0;
  }
  function buildSidebar() {
    let h = "";
    SECTIONS.forEach(sec => {
      h += "<h4>" + esc(sec.label) + "</h4>";
      SLIDES.forEach((s, i) => { if (s.sec === sec.id) h += '<a href="#/' + s.id + '" data-id="' + s.id + '"><span class="dot"></span>' + esc(s.nav || s.title) + (s.type === "tool" ? '<span class="tag">' + TOOLS[s.tool].num + "</span>" : "") + "</a>"; });
    });
    $("#sidebar").innerHTML = h;
  }
  function refreshSidebar() {
    $$("#sidebar a").forEach(a => {
      const sl = SLIDES.find(s => s.id === a.dataset.id), p = slideProgress(sl);
      a.classList.toggle("on", sl === SLIDES[idx]); a.classList.toggle("done", p >= 1); a.classList.toggle("part", p > 0 && p < 1);
    });
    const p = overall(); $("#progBar").style.width = Math.round(p * 100) + "%"; $("#progTxt").textContent = U.pct(p);
  }
  function refreshNav() {
    const pend = $$("[data-rv]", $("#stage")).filter(e => !e.classList.contains("on")).length;
    $("#btnPrev").disabled = idx === 0;
    $("#btnNext").disabled = idx === SLIDES.length - 1 && !pend;
    $("#btnNext").textContent = pend ? "Revelar ▸" : "Próximo →";
    $("#slideCount").textContent = (idx + 1) + " de " + SLIDES.length;
  }
  function revealNext() {
    const el = $$("[data-rv]", $("#stage")).find(e => !e.classList.contains("on")); if (!el) return false;
    if (el.dataset.rv === "a") el.textContent = el.dataset.a;
    el.classList.add("on"); refreshNav(); return true;
  }
  function show(i, back) {
    clearInterval(timerInt); idx = Math.max(0, Math.min(SLIDES.length - 1, i));
    const sl = SLIDES[idx], stage = $("#stage");
    stage.innerHTML = slideHTML(sl); stage.scrollTop = 0;
    if (back) $$("[data-rv]", stage).forEach(e => { if (e.dataset.rv === "a") e.textContent = e.dataset.a; e.classList.add("on"); });
    growAll(stage); recalc(stage);
    S.seen[sl.id] = 1; S.last = sl.id; save();
    $("#notesBody").textContent = sl.notes || "Sem notas para este slide.";
    $("#startupName").textContent = S.startup;
    document.title = sl.title + " · ICP na prática";
    refreshSidebar(); refreshNav();
    const a = $('#sidebar a[data-id="' + sl.id + '"]'); if (a && a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
  }
  function idxOf(id) { return SLIDES.findIndex(s => s.id === id); }
  function go(i) { const t = SLIDES[Math.max(0, Math.min(SLIDES.length - 1, i))]; if (location.hash !== "#/" + t.id) location.hash = "#/" + t.id; else show(idx); }
  function route() {
    const id = (location.hash.match(/^#\/(.+)$/) || [])[1]; let i = idxOf(id);
    if (i < 0) i = idxOf(S.last) >= 0 ? idxOf(S.last) : 0;
    const back = i < idx; show(i, back);
    if (window.innerWidth < 1000) $("#sidebar").classList.add("closed");
  }
  const next = () => { if (!revealNext()) go(idx + 1); };
  const prev = () => go(idx - 1);

  /* ---------- exportações ---------- */
  function download(content, name, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || "application/octet-stream" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const slug = s => (s || "startup").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "startup";
  const stamp = () => new Date().toISOString().slice(0, 10);
  function toolAOA(key) {
    const T = TOOLS[key], out = [[T.num + " · " + T.title], [T.intro], []];
    T.sections.forEach(sd => {
      if (sd.kind === "fields") { out.push([sd.title || "Campos"]); const f = fieldsOf(key, sd.id); sd.fields.forEach(fd => out.push([fd.l, f[fd.k]])); out.push([]); return; }
      if (sd.kind !== "table") return;
      if (sd.title) out.push([sd.title]);
      const hc = makeCtx(key, sd.id, -1); out.push(sd.columns.map(c => colLabel(c, hc)));
      getRows(key, sd.id).forEach((r, i) => {
        if (sd.dyn && !rowFilled(r, sd) && !sd.init) return;
        const c = makeCtx(key, sd.id, i), def = (sd.rows && sd.rows[i]) || {};
        out.push(sd.columns.map(col => {
          if (col.t === "st") return (def.group ? def.group + " · " : "") + (def.label || "");
          if (col.t === "calc") return col.f(c);
          const v = r[col.k]; if (col.t === "num" && v !== undefined && v !== "" && !isNaN(U.num(v))) return U.num(v);
          return v === undefined ? "" : v;
        }));
      });
      out.push([]);
    });
    return out;
  }
  function exportXlsx() {
    if (!window.XLSX) { toast("A biblioteca de Excel não carregou (sem internet?). Use o backup .json."); return; }
    const wb = XLSX.utils.book_new(), res = [["ICP na prática · Mentoria"], ["Startup", S.startup], ["Mentor", CFG.mentor || ""], ["Exportado em", new Date().toLocaleString("pt-BR")], [], ["Ferramenta", "Preenchimento"]];
    window.TOOL_ORDER.forEach(k => res.push([TOOLS[k].num + " " + TOOLS[k].title, U.pct(toolPct(k))]));
    res.push([], ["Maturidade do ICP (0 a 3)", S.poll.maturidade === undefined ? "" : S.poll.maturidade], ["Frase do início", S.text.frase0 || ""], ["Frase do fim", S.text.frase1 || ""], [], ["Dever de casa", "Tarefa", "Feita"]);
    SLIDES.filter(s => s.type === "tasks").forEach((s, n) => s.items.forEach((it, i) => res.push(["Dever " + (n + 1), it.t, (S.checks[s.key] || [])[i] ? "Sim" : "Não"])));
    res.push([], ["Conversas", "Pergunta", "Anotação"]);
    SLIDES.filter(s => s.type === "discuss").forEach(s => s.prompts.forEach((p, i) => res.push([s.title, p, S.text["d:" + s.id + ":" + i] || ""])));
    const ws0 = XLSX.utils.aoa_to_sheet(res); ws0["!cols"] = [{ wch: 44 }, { wch: 70 }, { wch: 10 }]; XLSX.utils.book_append_sheet(wb, ws0, "Resumo");
    window.TOOL_ORDER.forEach(k => {
      const ws = XLSX.utils.aoa_to_sheet(toolAOA(k)); ws["!cols"] = TOOLS[k].sections.find(s => s.columns) ? TOOLS[k].sections.find(s => s.columns).columns.map(c => ({ wch: Math.round(Math.min(60, Math.max(12, (c.w || 150) / 6))) })) : [];
      XLSX.utils.book_append_sheet(wb, ws, (TOOLS[k].num + " " + TOOLS[k].title).replace(/[\\\/?*\[\]:]/g, "-").slice(0, 31));
    });
    XLSX.writeFile(wb, "ICP_" + slug(S.startup) + "_" + stamp() + ".xlsx"); toast("Excel gerado.");
  }
  const backupJSON = () => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state: S }, null, 1);
  function exportJSON() { download(backupJSON(), "ICP_" + slug(S.startup) + "_" + stamp() + ".json", "application/json"); toast("Backup baixado."); }
  function sendToMentor() {
    if (CFG.webhookUrl) {
      fetch(CFG.webhookUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ startup: S.startup, exportedAt: new Date().toISOString(), progress: Math.round(overall() * 100), state: S }) })
        .then(() => toast("Enviado ao mentor.")).catch(() => { toast("Falha no envio. Baixei o backup para você enviar."); exportJSON(); });
      return;
    }
    exportJSON();
    if (CFG.mentorEmail) { location.href = "mailto:" + CFG.mentorEmail + "?subject=" + encodeURIComponent("ICP - " + (S.startup || "startup")) + "&body=" + encodeURIComponent("Segue o backup do ICP em anexo (arquivo .json baixado agora)."); }
    else toast("Backup baixado: envie o arquivo .json ao mentor.");
  }
  function importJSON(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try { const o = JSON.parse(fr.result), st = o.state || o; if (!st.data) throw 0; S = Object.assign({ startup: "", data: {}, checks: {}, poll: {}, text: {}, seen: {}, last: "" }, st); save(); buildSidebar(); show(idx); toast("Backup importado."); }
      catch (e) { toast("Arquivo inválido."); }
    };
    fr.readAsText(file);
  }
  function printAll() {
    PRINTING = true; const stage = $("#stage"), keep = idx;
    stage.innerHTML = SLIDES.map(s => '<div class="printslide">' + slideHTML(s) + "</div>").join("");
    document.body.classList.add("print-all"); growAll(stage); recalc(stage);
    const done = () => { PRINTING = false; document.body.classList.remove("print-all"); window.removeEventListener("afterprint", done); show(keep); };
    window.addEventListener("afterprint", done); setTimeout(() => window.print(), 300);
  }
  function resetAll() {
    if (!confirm("Apagar tudo o que foi preenchido neste navegador? Exporte um backup antes, se quiser guardar.")) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    S = { startup: "", data: {}, checks: {}, poll: {}, text: {}, seen: {}, last: "" }; location.hash = "#/" + SLIDES[0].id; buildSidebar(); show(0); toast("Tudo limpo.");
  }
  function act(a) {
    $("#exportMenu").hidden = true;
    ({ xlsx: exportXlsx, json: exportJSON, send: sendToMentor, print: printAll, reset: resetAll, import: () => $("#fileImport").click() }[a] || (() => {}))();
  }

  /* ---------- temporizador ---------- */
  function timerClick(btn) {
    const tm = btn.closest(".timer"), out = $(".t", tm), total = +tm.dataset.min * 60;
    const fmt = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    if (btn.dataset.tm === "reset") { clearInterval(timerInt); out.textContent = fmt(total); $('[data-tm="go"]', tm).textContent = "Iniciar"; tm.dataset.left = ""; return; }
    if (timerInt && btn.textContent === "Pausar") { clearInterval(timerInt); timerInt = null; btn.textContent = "Continuar"; return; }
    let left = tm.dataset.left ? +tm.dataset.left : total; btn.textContent = "Pausar"; clearInterval(timerInt);
    timerInt = setInterval(() => {
      left--; tm.dataset.left = left; out.textContent = fmt(Math.max(0, left));
      if (left <= 0) { clearInterval(timerInt); timerInt = null; btn.textContent = "Iniciar"; tm.dataset.left = ""; toast("Tempo encerrado!"); }
    }, 1000);
  }

  /* ---------- eventos ---------- */
  const stage = $("#stage");
  function onEdit(e) {
    const el = e.target;
    if (el.dataset.t) {
      getRows(el.dataset.t, el.dataset.s)[+el.dataset.i][el.dataset.k] = el.value;
      if (el.tagName === "TEXTAREA") grow(el);
      recalc(stage);
    } else if (el.dataset.f) {
      const p = el.dataset.f.split("|"); store(p[0], p[1]).fields[p[2]] = el.value; recalc(stage);
    } else if (el.dataset.txt) S.text[el.dataset.txt] = el.value;
    else if (el.id === "inpStartup") { S.startup = el.value; $("#startupName").textContent = S.startup; }
    else if (el.dataset.chk) {
      const p = el.dataset.chk.split("|"); (S.checks[p[0]] = S.checks[p[0]] || [])[+p[1]] = el.checked; el.closest(".task").classList.toggle("done", el.checked);
    } else return;
    save(); refreshSidebar();
  }
  stage.addEventListener("input", onEdit);
  stage.addEventListener("change", onEdit);
  stage.addEventListener("click", e => {
    const t = e.target.closest("button, [data-rv=a], a");
    if (!t) return;
    if (t.dataset.poll) { const p = t.dataset.poll.split("|"); S.poll[p[0]] = +p[1]; $$(".opt", stage).forEach(o => o.classList.toggle("sel", o === t)); save(); refreshSidebar(); }
    else if (t.dataset.add) {
      const p = t.dataset.add.split("|"), sd = secDef(p[0], p[1]); getRows(p[0], p[1]).push({});
      const old = $('[data-tool="' + p[0] + '"] [data-sec="' + p[1] + '"]', stage), y = stage.scrollTop;
      old.outerHTML = secHTML(p[0], sd); growAll(stage); recalc(stage); stage.scrollTop = y; save();
    } else if (t.dataset.go) next();
    else if (t.dataset.tm) timerClick(t);
    else if (t.dataset.act) act(t.dataset.act);
    else if (t.dataset.rv === "a") { t.textContent = t.dataset.a; t.classList.add("on"); refreshNav(); }
  });
  $("#btnNext").addEventListener("click", next);
  $("#btnPrev").addEventListener("click", prev);
  $("#btnMenu").addEventListener("click", () => $("#sidebar").classList.toggle("closed"));
  $("#btnNotes").addEventListener("click", () => { const n = $("#notesPanel"); n.hidden = !n.hidden; });
  $("#notesClose").addEventListener("click", () => { $("#notesPanel").hidden = true; });
  $("#btnPanel").addEventListener("click", () => go(idxOf("painel")));
  $("#btnExport").addEventListener("click", e => { e.stopPropagation(); const m = $("#exportMenu"); m.hidden = !m.hidden; });
  $("#exportMenu").addEventListener("click", e => { const b = e.target.closest("button"); if (b) act(b.dataset.act); });
  document.addEventListener("click", e => { if (!e.target.closest(".menu")) $("#exportMenu").hidden = true; });
  $("#fileImport").addEventListener("change", e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; });
  $("#sidebar").addEventListener("click", () => { if (window.innerWidth < 1000) $("#sidebar").classList.add("closed"); });
  document.addEventListener("keydown", e => {
    const tg = e.target, typing = tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable);
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
    else if (e.key === "n" || e.key === "N") { const n = $("#notesPanel"); n.hidden = !n.hidden; }
  });
  window.addEventListener("hashchange", route);

  buildSidebar();
  if (window.innerWidth < 1000) $("#sidebar").classList.add("closed");
  route();
})();
