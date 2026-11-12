// The scoreboard. Plain JavaScript, no build. Everything shown comes from data/board.json; a plugin's judges
// load from one of sixteen detail files when its scorecard opens. Text from entrants and agents is only ever
// set as text, never as HTML.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const PAGE = 100;
  // The static <title> is short because IMD names the site after it; the tab gets the full name here.
  const TITLE = "IMD judged the Hermes plugin hackathon";
  document.title = TITLE;
  const ICON = {
    gh: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    play: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 3.5 L12.5 8 L5.5 12.5 Z"/></svg>',
    moon: '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 9.8A5.8 5.8 0 0 1 6.2 2.5 5.8 5.8 0 1 0 13.5 9.8Z"/></svg>',
    sun: '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M3.2 12.8l1.1-1.1M11.7 4.3l1.1-1.1"/></svg>',
    close: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>',
  };
  const CRITERIA = [["useful", "Useful"], ["reliable", "Reliable"], ["polish", "Polish"], ["creative", "Creative"], ["beyond", "Beyond a prompt"]];
  const ROUND = { 1: "First read", 2: "Second read", 3: "Ran it inside Hermes" };
  const JUDGE = { claude: "Claude", codex: "Codex" };
  const num = (n) => n.toLocaleString("en-US");
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "th");

  /** An element with text children only: nothing here is ever parsed as HTML. */
  function h(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "icon") node.innerHTML = ICON[v];
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid);
    return node;
  }
  const out = (href, props, ...kids) => h("a", { href, target: "_blank", rel: "noopener", ...props }, ...kids);
  const face = (author, size) => h("img", { class: "face", src: `https://github.com/${encodeURIComponent(author || "ghost")}.png?size=96`, alt: "", width: size, height: size, loading: "lazy", decoding: "async" });

  const state = { board: null, rows: [], q: "", tag: "", shown: PAGE, tagLabel: {} };
  const board = $("#board"), after = $("#after"), count = $("#count"), sheet = $("#sheet"), input = $("#q");

  // ── day and night ──────────────────────────────────────────────────────────
  const themeBtn = $("#theme");
  function paintTheme() {
    const dark = document.documentElement.dataset.theme === "dark";
    themeBtn.innerHTML = dark ? ICON.sun : ICON.moon;
    themeBtn.setAttribute("aria-label", dark ? "Switch to day" : "Switch to night");
  }
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* private window */ }
    paintTheme();
  });
  paintTheme();

  // ── loading ────────────────────────────────────────────────────────────────
  async function getJson(url, ms = 20000) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), ms);
    try {
      const res = await fetch(url, { signal: stop.signal });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
  function skeleton() {
    board.replaceChildren(...Array.from({ length: 10 }, () => h("li", { class: "skel", "aria-hidden": "true" })));
    after.replaceChildren();
    count.textContent = "";
  }
  async function load() {
    skeleton();
    try {
      state.board = await getJson("./data/board.json");
    } catch {
      board.replaceChildren();
      after.replaceChildren(h("p", { class: "empty" }, "The results didn't load. Check your connection and try again.", h("button", { class: "btn", type: "button", onclick: load }, "Try again")));
      return;
    }
    start();
  }

  function start() {
    const b = state.board, c = b.counts;
    state.rows = b.rows;
    for (const r of state.rows) r.hay = `${r.name} ${r.author || ""} ${r.does}`.toLowerCase();
    for (const t of b.tags) state.tagLabel[t.id] = t.label;
    $("#lede").textContent = `All ${num(c.plugins)} plugins entered, ranked by IMD's AI agents. Unofficial: this is the swarm's judging, not Nous Research's.`;
    const steps = [
      ["Every plugin read once.", ` ${num(c.read)} agents read ten plugins each and scored them on usefulness, reliability, polish, creativity and whether a prompt could do the same.`],
      [`The top ${num(c.reread)} read again`, " by a second agent."],
      [`The best ${num(c.ran)} run inside real Hermes.`, ` ${num(c.ran_agents)} agents installed them, ran Nous's catalog check and their tests, called their tools, and ranked what they ran.`],
      [`${num(c.finalists)} finalists ranked.`, ` ${num(c.final_agents)} agents each ranked all ${num(c.finalists)}. The average rank decides the places.`],
    ];
    $("#steps").replaceChildren(...steps.map(([lead, rest]) => h("li", {}, h("span", {}, h("b", {}, lead), rest))));
    const j = b.judges || {}, pct = (x) => `${(x * 100).toFixed(1)}%`;
    $("#curve").textContent = (j.codex && j.claude ? `Codex agents gave 27 or more of 30 to ${pct(j.codex.share_27_up)} of what they read, Claude agents to ${pct(j.claude.share_27_up)}, so each model is graded on its own curve. ` : "")
      + "Score is out of 100: under 50 for a plugin that was read, 50 to 75 for one run inside Hermes, 75 to 100 for a finalist, by its final ranking.";
    $("#howlinks").replaceChildren(out(b.goal_url, {}, "The judging on IMD's explorer"), out(b.plan_url, {}, "The plan and the data"));
    $("#disclosure").textContent = b.disclosure;

    const params = new URLSearchParams(location.search);
    state.q = params.get("q") || "";
    state.tag = state.tagLabel[params.get("tag")] ? params.get("tag") : "";
    input.value = state.q;
    paintTags();
    paint();
    route();
  }

  // ── the list ───────────────────────────────────────────────────────────────
  function paintTags() {
    const all = h("button", { class: "tag", type: "button", "aria-pressed": String(!state.tag), onclick: () => pick("") }, "All");
    const rest = state.board.tags.map((t) => h("button", { class: "tag", type: "button", "aria-pressed": String(state.tag === t.id), onclick: () => pick(state.tag === t.id ? "" : t.id) }, t.label, h("span", {}, num(t.count))));
    $("#tags").replaceChildren(all, ...rest);
  }
  function pick(tag) {
    state.tag = tag;
    state.shown = PAGE;
    paintTags();
    paint();
    $("#tags").querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function matches() {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return state.rows.filter((r) => (!state.tag || r.tags.includes(state.tag)) && words.every((w) => r.hay.includes(w)));
  }
  function row(r) {
    const tags = r.tags.flatMap((t, i) => [i ? ", " : null, h("button", { type: "button", onclick: () => pick(t) }, state.tagLabel[t])]);
    const links = [out(`https://github.com/NousResearch/hermes-agent/pull/${r.pr}`, { icon: "gh", "aria-label": `Pull request for ${r.name}`, title: "Pull request" })];
    if (r.demo) links.push(out(r.demo, { icon: "x", "aria-label": `Demo post for ${r.name} on X`, title: "Demo post on X" }));
    if (r.video) links.push(out(r.video, { icon: "play", "aria-label": `Demo video for ${r.name}`, title: "Demo video" }));
    return h("li", { class: `row${r.rank && r.rank <= 10 ? " top" : ""}${r.rank && r.rank <= 5 ? " win" : ""}` },
      h("span", { class: "rank" }, r.rank ? String(r.rank) : ""),
      face(r.author, 40),
      h("div", { class: "who" },
        h("span", {}, h("a", { class: "name", href: `#/p/${encodeURIComponent(r.slug)}` }, r.name), h("span", { class: "by" }, r.author || "")),
        h("p", { class: "does" }, r.does)),
      h("div", { class: "rtags" }, tags),
      h("div", { class: "links" }, links),
      h("span", { class: "score" }, r.score == null ? "" : r.score.toFixed(1)));
  }
  function paint() {
    const found = matches(), total = state.rows.length, plain = !state.q && !state.tag;
    const kids = [];
    for (const r of found.slice(0, state.shown)) {
      if (plain && r.rank === 1) kids.push(h("li", { class: "divide" }, "Top five"));
      if (plain && r.rank === 6) kids.push(h("li", { class: "divide" }, "Runners-up"));
      if (plain && r.rank === 11) kids.push(h("li", { class: "divide" }, "The rest of the field"));
      kids.push(row(r));
    }
    board.replaceChildren(...kids);
    count.textContent = plain ? `${num(total)} plugins` : `${num(found.length)} of ${num(total)} plugins${state.tag ? ` in ${state.tagLabel[state.tag]}` : ""}`;
    const left = found.length - state.shown;
    if (!found.length) {
      after.replaceChildren(h("p", { class: "empty" }, state.q ? `Nothing matches “${state.q}”${state.tag ? ` in ${state.tagLabel[state.tag]}` : ""}.` : "Nothing here.",
        h("button", { class: "btn", type: "button", onclick: () => { state.q = ""; input.value = ""; state.tag = ""; paintTags(); paint(); input.focus(); } }, "Show every plugin")));
    } else if (left > 0) {
      const more = h("button", { class: "btn", type: "button", onclick: () => { state.shown += PAGE; paint(); } }, `Show ${num(Math.min(PAGE, left))} more`);
      after.replaceChildren(more);
    } else {
      after.replaceChildren();
    }
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.tag) params.set("tag", state.tag);
    const search = params.toString();
    history.replaceState(history.state, "", location.pathname + (search ? `?${search}` : "") + location.hash);
  }
  input.addEventListener("input", () => { state.q = input.value.trim(); state.shown = PAGE; paint(); });

  // ── the scorecard ──────────────────────────────────────────────────────────
  const shards = new Map();
  const detail = (r) => {
    const n = r.pr % 16;
    if (!shards.has(n)) shards.set(n, getJson(`./data/details-${n}.json`).catch((e) => { shards.delete(n); throw e; }));
    return shards.get(n).then((part) => part[r.slug]);
  };
  function route() {
    const m = location.hash.match(/^#\/p\/(.+)$/);
    const r = m && state.rows.find((x) => x.slug === decodeURIComponent(m[1]));
    if (r) open(r);
    else if (sheet.open) sheet.close();
  }
  window.addEventListener("hashchange", route);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
  sheet.addEventListener("close", () => {
    if (location.hash.startsWith("#/p/")) history.replaceState(history.state, "", location.pathname + location.search);
    document.title = TITLE;
  });

  function head(r) {
    const c = state.board.counts;
    const stage = { final: "the final", ran: "round 3", read: "the reads", none: "no round" }[r.tier];
    const stats = r.rank
      ? [h("div", {}, h("b", {}, String(r.rank)), h("span", {}, `of ${num(c.ranked)}`)), h("div", {}, h("b", {}, r.score.toFixed(1)), h("span", {}, "of 100")), h("div", {}, h("b", {}, stage === "the final" ? "Finalist" : stage === "round 3" ? "Round 3" : "Read"), h("span", {}, stage === "the final" ? `ranked by ${c.final_agents} agents` : stage === "round 3" ? "run inside Hermes" : "by the swarm"))]
      : [h("div", {}, h("b", {}, "Not read"), h("span", {}, "no agent could open it"))];
    const text = r.rank ? `${r.name} ranked ${r.rank} of ${num(c.ranked)} in the IMD swarm's judging of the Hermes plugin hackathon` : "";
    const here = location.origin + location.pathname + `#/p/${encodeURIComponent(r.slug)}`;
    return [
      h("div", { class: "sheet-top" }, face(r.author, 48),
        h("div", { class: "sheet-title" }, h("h2", { id: "sheet-name", tabindex: "-1" }, r.name), h("p", {}, r.author ? `by ${r.author}` : "")),
        h("button", { class: "icon-btn close", type: "button", icon: "close", "aria-label": "Close", onclick: () => sheet.close() })),
      h("div", { class: "standing" }, stats),
      h("p", { class: "does" }, r.does),
      h("div", { class: "acts" },
        out(`https://github.com/NousResearch/hermes-agent/pull/${r.pr}`, { class: "btn" }, h("span", { icon: "gh" }), "Pull request"),
        r.demo && out(r.demo, { class: "btn" }, h("span", { icon: "x" }), "Demo post"),
        r.video && out(r.video, { class: "btn" }, h("span", { icon: "play" }), "Demo video"),
        out(r.repo, { class: "btn" }, "Code"),
        r.rank && out(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(here)}`, { class: "btn solid" }, "Share on X")),
    ];
  }
  function judges(d) {
    const kids = [];
    const scored = d.reads.filter((x) => x.total != null);
    if (d.final) {
      const f = d.final;
      kids.push(h("h3", {}, "The final"),
        h("p", { class: "fine" }, `Mean rank ${f.mean_rank.toFixed(2)}. Ranked first by ${f.firsts} of the agents, and between ${ordinal(f.best)} and ${ordinal(f.worst)} by all of them.`),
        h("div", { class: "why" }, (f.why || []).slice(0, 2).map((w) => h("p", {}, w))));
    }
    if (scored.length) {
      kids.push(h("h3", {}, `Scores from ${scored.length === 1 ? "its agent" : `its ${scored.length} agents`}`),
        h("div", { class: "bars" }, CRITERIA.map(([k, label]) => {
          const avg = scored.reduce((s, x) => s + x[k], 0) / scored.length;
          return h("div", { class: "barrow" }, h("span", {}, label), h("div", { class: "track" }, h("i", { style: `width:${(avg / 5) * 100}%` })), h("b", {}, avg.toFixed(1)));
        })));
    }
    kids.push(h("h3", {}, "What each agent said"));
    for (const x of d.reads) {
      const ran = [["Catalog check", x.validate], ["Inside Hermes", x.inside], ["Tests", x.tests]].filter(([, v]) => v);
      kids.push(h("div", { class: "judge" },
        h("div", { class: "judge-top" }, h("b", {}, JUDGE[x.judge] || "Agent"), h("span", {}, ROUND[x.round] || ""), h("span", {}, x.total != null ? `${x.total} of 30` : "Could not read it"), x.record && out(x.record, {}, "Record")),
        x.blocked && h("p", {}, x.blocked),
        x.best && h("p", {}, h("b", {}, "Best: "), x.best),
        x.worst && h("p", {}, h("b", {}, "Worst: "), x.worst),
        ran.length ? h("details", {}, h("summary", {}, "What it ran"), ran.map(([label, v]) => h("p", {}, h("b", {}, `${label}: `), v))) : null));
    }
    return kids;
  }
  async function open(r) {
    const box = $("#sheet-in");
    box.replaceChildren(...head(r), h("p", { class: "fine", id: "sheet-wait" }, "Loading what the agents said…"));
    document.title = `${r.name} · ${TITLE}`;
    if (!sheet.open) sheet.showModal();
    box.scrollTop = 0;
    $("#sheet-name").focus({ preventScroll: true }); // the card's name takes focus, so a reader starts at its top
    try {
      const d = await detail(r);
      if (!location.hash.endsWith(encodeURIComponent(r.slug))) return; // another card was opened meanwhile
      $("#sheet-wait")?.remove();
      box.append(...judges(d));
    } catch {
      const wait = $("#sheet-wait");
      if (wait) wait.replaceChildren("The agents' notes didn't load. ", h("button", { class: "btn", type: "button", onclick: () => open(r) }, "Try again"));
    }
  }

  load();
})();
