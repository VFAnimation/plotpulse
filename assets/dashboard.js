(async function () {
  const CFG = window.PLOTPULSE_CONFIG;
  const Store = window.PlotPulseStore;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Number(n).toLocaleString("en-IN");
  const DAY = 86400000;

  // Sequential ramps (one hue, light → dark)
  const HEAT = ["#f4ecd6", "#ecd38f", "#e2b23f", "#b98419", "#7d560c"];
  const HEAT_INK = ["#3b3010", "#3b3010", "#2b2208", "#ffffff", "#ffffff"];

  const C = CFG.colony;
  document.title = `Builder dashboard, ${C.name}`;
  for (const id of ["loginMark", "dashMark"]) $(id).textContent = C.builderShort;
  $("loginColony").textContent = C.name;
  $("dashColony").textContent = C.name;

  await Store.init("../");
  const demo = Store.mode === "demo";
  $("modeBadge").textContent = demo ? "Demo data" : "Live";
  $("modeBadge").className = "mode " + (demo ? "demo" : "live");
  $("loginHint").textContent = demo
    ? "Demo mode: use any email. The password is set in colony/config.js."
    : "Use the builder login created in Supabase.";

  // ---------- Auth ----------
  async function showApp() {
    $("loginView").hidden = true; $("appView").hidden = false;
    await refresh();
  }
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginError").textContent = "";
    $("loginBtn").disabled = true;
    try {
      await Store.backend.signIn($("email").value.trim(), $("password").value);
      await showApp();
    } catch (err) {
      $("loginError").textContent = err.message || "Couldn't sign in. Check the email and password.";
    } finally { $("loginBtn").disabled = false; }
  });
  $("signOut").addEventListener("click", async () => {
    await Store.backend.signOut();
    location.reload();
  });

  // ---------- Helpers ----------
  const tip = $("tooltip");
  function showTip(html, e) {
    if (!html) { tip.hidden = true; return; }
    tip.innerHTML = html; tip.hidden = false;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.max(8, e.clientY - tip.offsetHeight - 12);
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function bindTips(root) {
    root.querySelectorAll("[data-tip]").forEach((n) => {
      n.addEventListener("pointermove", (e) => showTip(n.dataset.tip, e));
      n.addEventListener("pointerleave", () => showTip(null));
    });
  }
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
  }
  const gajText = (g) => (Number.isInteger(g) ? g : Number(g).toFixed(1).replace(/\.0$/, ""));
  const name = (u) => (u.kind === "shop" ? `Shop ${u.no.replace(/^S/, "")}` : `Plot ${u.no}`);
  const kindLabel = (u) => (u.kind === "shop" ? "Shop" : "Plot");
  const prettySource = (s) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

  function hbars(el, rows, opts = {}) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    el.innerHTML = `<div class="hbars">${rows.map((r) => `
      <span class="hbar-label">${esc(r.label)}</span>
      <span class="hbar-track" data-tip="${esc(r.tip || "")}">
        <span class="hbar" style="width:${(r.value / max) * 100}%"></span>
        ${r.sub != null ? `<span class="hbar sub" style="width:${(r.sub / max) * 100}%"></span>` : ""}
      </span>
      <span class="hbar-val">${r.display}</span>`).join("")}</div>${opts.key || ""}`;
    bindTips(el);
  }

  // ---------- State ----------
  let allUnits = [], plots = [], events = [], prevEvents = [], perPlot = {}, selectedNo = null, heat = null;

  async function refresh() {
    const days = Number($("period").value);
    allUnits = await Store.plots();
    plots = allUnits.filter((u) => u.kind !== "ews");   // E.W.S. units are reserved, not for sale
    const all = await Store.backend.events(days * 2);
    const cut = Date.now() - days * DAY;
    events = all.filter((e) => e.t >= cut);
    prevEvents = all.filter((e) => e.t < cut);
    perPlot = Store.aggregateDemand(events);
    renderKpis(days);
    renderHeat();
    renderInsights();
    renderMarketing(days);
    renderInventory();
    renderPlotPanel();
    loadSettings();
  }
  $("period").addEventListener("change", refresh);

  // ---------- KPIs ----------
  function summary(evts) {
    const visitors = new Set(evts.map((e) => e.anon)).size;
    const views = evts.filter((e) => e.type === "plot_view").length;
    const enq = new Set(evts.filter((e) => e.type === "whatsapp_click").map((e) => e.anon + "|" + e.plot)).size;
    return { visitors, views, enq };
  }
  function change(now, before) {
    if (!before) return "";
    const pct = Math.round(((now - before) / before) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% vs previous period`;
  }
  function renderKpis(days) {
    const a = summary(events), b = summary(prevEvents);
    const avail = plots.filter((p) => p.status === "available").length;
    const rate = a.visitors ? ((a.enq / a.visitors) * 100).toFixed(1) : "0";
    const tiles = [
      [fmt(a.visitors), "Visitors", change(a.visitors, b.visitors)],
      [fmt(a.views), "Plot views", change(a.views, b.views)],
      [fmt(a.enq), "WhatsApp enquiries", change(a.enq, b.enq)],
      [rate + "%", "Visitors who enquired", "Enquiries per 100 visitors"],
      [`${avail}/${plots.length}`, "Plots and shops available", `${plots.length - avail} allotted`],
    ];
    $("kpis").innerHTML = tiles.map(([v, l, s]) => `<div class="kpi"><b>${v}</b><span>${l}</span><small>${s || "&nbsp;"}</small></div>`).join("");
  }

  // ---------- Demand heat map ----------
  // Quantile steps: plots are ranked by viewers and split into 5 equal groups,
  // so one very popular plot doesn't wash out the rest of the map.
  let quant = [];
  function stepFor(v) {
    if (!v) return 0;
    const below = quant.filter((x) => x < v).length;
    return Math.min(4, Math.floor((below / Math.max(1, quant.length)) * 5));
  }
  function renderHeat() {
    const max = Math.max(1, ...plots.map((p) => (perPlot[p.no] || {}).viewers || 0));
    quant = plots.map((p) => (perPlot[p.no] || {}).viewers || 0).filter((v) => v > 0).sort((a, b) => a - b);
    const wrap = $("heatPlan"); wrap.classList.add("heat");
    heat = window.PlotPlan.render(wrap, Store.plan, allUnits, {
      look: (p) => {
        if (p.kind === "ews") return {};
        const d = perPlot[p.no] || { viewers: 0, enquiries: 0 };
        const s = stepFor(d.viewers);
        return {
          cls: p.status === "allotted" ? "is-allotted" : "",
          fill: HEAT[s],
          label: `${name(p)}: ${d.viewers} people viewed, ${d.enquiries} enquiries`,
        };
      },
      onSelect: (p) => { selectedNo = p.no; heat.select(p.no); renderPlotPanel(); },
      onHover: (p, e) => {
        if (!p) return showTip(null);
        const d = perPlot[p.no] || { viewers: 0, enquiries: 0 };
        showTip(`<strong>${esc(name(p))}</strong><br>${d.viewers} people viewed<br>${d.enquiries} WhatsApp enquiries${p.status === "allotted" ? "<br>Allotted" : ""}`, e);
      },
    });
    // plot number colour follows the fill darkness
    plots.forEach((p) => {
      const g = wrap.querySelector(`.unit[data-no="${CSS.escape(p.no)}"]`);
      if (g) g.style.setProperty("--heat-ink", HEAT_INK[stepFor((perPlot[p.no] || {}).viewers || 0)]);
    });
    if (selectedNo) heat.select(selectedNo);
    $("rampLegend").innerHTML = `<span>Fewer people</span><span class="ramp">${HEAT.map((c) => `<i style="background:${c}"></i>`).join("")}</span><span>More people (max ${max})</span><span><span class="dash-key"></span>Allotted</span>`;
  }

  function renderPlotPanel() {
    const el = $("plotPanel");
    const p = plots.find((x) => x.no === selectedNo);
    if (!p) { el.innerHTML = `<p class="muted">Select a plot or shop on the map to see its numbers and change its status.</p>`; return; }
    const d = perPlot[p.no] || { viewers: 0, enquiries: 0 };
    const tags = [p.corner && "corner", p.parkFacing && "park-facing"].filter(Boolean).join(", ");
    el.innerHTML = `
      <div class="pp-title"><h3>${esc(name(p))}</h3></div>
      <p class="pp-facts">${gajText(p.gaj)} gaj (${fmt(p.sqft)} sq ft), ${esc(p.dims)}, ${esc(p.facing)} facing${tags ? ", " + tags : ""}</p>
      <div class="pp-stats">
        <div><b>${d.viewers}</b><span>people viewed</span></div>
        <div><b>${d.enquiries}</b><span>WhatsApp enquiries</span></div>
      </div>
      <div class="toggle-row" role="group" aria-label="Plot status">
        <button type="button" class="seg is-available" aria-pressed="${p.status === "available"}" data-set="available">Available</button>
        <button type="button" class="seg is-allotted" aria-pressed="${p.status === "allotted"}" data-set="allotted">Allotted</button>
      </div>`;
    el.querySelectorAll(".seg").forEach((b) => b.addEventListener("click", () => setStatus(p.no, b.dataset.set)));
  }

  async function setStatus(no, status) {
    const p = plots.find((x) => x.no === no);
    if (!p || p.status === status) return;
    const msg = status === "allotted"
      ? `Mark ${name(p).toLowerCase()} as allotted? It will show grey on the public page.`
      : `Mark ${name(p).toLowerCase()} as available again?`;
    if (!confirm(msg)) return;
    try {
      await Store.backend.setStatus(no, status);
      toast(status === "allotted" ? `${name(p)} marked as allotted` : `${name(p)} marked as available`);
      await refresh();
    } catch (e) { toast("Couldn't save. Check your connection and try again."); }
  }

  // ---------- What buyers want ----------
  function avgBy(keyFn, order, list) {
    const groups = {};
    for (const p of list || plots) {
      const k = keyFn(p);
      (groups[k] = groups[k] || { plots: 0, viewers: 0, enq: 0 });
      groups[k].plots++;
      groups[k].viewers += (perPlot[p.no] || {}).viewers || 0;
      groups[k].enq += (perPlot[p.no] || {}).enquiries || 0;
    }
    const keys = order ? order.filter((k) => groups[k]) : Object.keys(groups);
    return keys.map((k) => {
      const g = groups[k];
      const avg = g.viewers / g.plots;
      return { label: k, value: avg, display: avg.toFixed(1),
        tip: `${g.plots} units<br>${fmt(g.viewers)} people viewed in total<br>${fmt(g.enq)} enquiries` };
    });
  }
  function renderInsights() {
    const onlyPlots = plots.filter((p) => p.kind === "plot");
    const sizeKey = (p) => `About ${Math.round(p.gaj)} gaj`;
    const sizes = [...new Set(onlyPlots.map((p) => Math.round(p.gaj)))].sort((a, b) => a - b).map((s) => `About ${s} gaj`);
    hbars($("chSize"), avgBy(sizeKey, sizes, onlyPlots));
    hbars($("chFacing"), avgBy((p) => p.facing, ["East", "West", "North", "South"], onlyPlots));
    hbars($("chType"), avgBy((p) => (p.kind === "shop" ? "Shop" : p.parkFacing ? "Park-facing plot" : p.corner ? "Corner plot" : "Regular plot"),
      ["Park-facing plot", "Corner plot", "Regular plot", "Shop"]));

    const rows = plots.map((p) => ({ p, ...(perPlot[p.no] || { viewers: 0, enquiries: 0 }) }));
    const top = rows.slice().sort((a, b) => b.viewers - a.viewers).slice(0, 8);
    const statusCell = (p) => `<span class="status ${p.status}">${p.status === "allotted" ? "Allotted" : "Available"}</span>`;
    $("tblTop").innerHTML = `<thead><tr><th>Unit</th><th>Area</th><th>Facing</th><th class="num">Viewed</th><th class="num">Enquiries</th><th>Status</th></tr></thead><tbody>${
      top.map((r) => `<tr><td><strong>${esc(name(r.p))}</strong></td><td>${gajText(r.p.gaj)} gaj</td><td>${esc(r.p.facing)}</td><td class="num">${r.viewers}</td><td class="num">${r.enquiries}</td><td>${statusCell(r.p)}</td></tr>`).join("")}</tbody>`;

    const viewed = rows.filter((r) => r.p.status === "available" && r.viewers > 0).map((r) => r.viewers).sort((a, b) => a - b);
    const median = viewed.length ? viewed[Math.floor(viewed.length / 2)] : 0;
    const cold = rows.filter((r) => r.p.status === "available" && r.viewers >= Math.max(5, median))
      .sort((a, b) => a.enquiries / a.viewers - b.enquiries / b.viewers || b.viewers - a.viewers).slice(0, 6);
    $("tblCold").innerHTML = cold.length
      ? `<thead><tr><th>Unit</th><th>Area</th><th class="num">Viewed</th><th class="num">Enquiries</th><th class="num">Per 100 views</th></tr></thead><tbody>${
        cold.map((r) => `<tr><td><strong>${esc(name(r.p))}</strong></td><td>${gajText(r.p.gaj)} gaj</td><td class="num">${r.viewers}</td><td class="num">${r.enquiries}</td><td class="num">${((r.enquiries / r.viewers) * 100).toFixed(0)}</td></tr>`).join("")}</tbody>`
      : `<tbody><tr><td class="muted">Not enough visits yet. This fills in once plots get regular views.</td></tr></tbody>`;
  }

  // ---------- Marketing ----------
  function renderMarketing(days) {
    const bySrc = {};
    for (const e of events) {
      const s = e.src || "direct";
      (bySrc[s] = bySrc[s] || { v: new Set(), q: new Set() });
      bySrc[s].v.add(e.anon);
      if (e.type === "whatsapp_click") bySrc[s].q.add(e.anon + "|" + e.plot);
    }
    const srcRows = Object.entries(bySrc).map(([s, o]) => ({
      label: prettySource(s), value: o.v.size, sub: o.q.size,
      display: `${fmt(o.v.size)} <small>/ ${fmt(o.q.size)}</small>`,
      tip: `${prettySource(s)}<br>${fmt(o.v.size)} visitors<br>${fmt(o.q.size)} enquiries`,
    })).sort((a, b) => b.value - a.value);
    hbars($("chSource"), srcRows.length ? srcRows : [{ label: "No visits yet", value: 0, display: "0" }], {
      key: `<div class="chart-key"><span><i style="background:#4c7a63"></i>Visitors</span><span><i style="background:#e3b322"></i>Enquiries</span></div>`,
    });

    // Visitors per day
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const dayKeys = [];
    for (let i = days - 1; i >= 0; i--) dayKeys.push(new Date(start.getTime() - i * DAY));
    const perDay = dayKeys.map(() => new Set());
    for (const e of events) {
      const idx = Math.floor((e.t - dayKeys[0].getTime()) / DAY);
      if (idx >= 0 && idx < perDay.length) perDay[idx].add(e.anon);
    }
    const vals = perDay.map((s) => s.size);
    const max = Math.max(1, ...vals);
    const W = 600, H = 190, padL = 30, padB = 22, gap = days > 40 ? 1 : 2;
    const bw = (W - padL) / days;
    const nice = Math.ceil(max / 5) * 5;
    let svg = `<svg class="cols" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Visitors per day">`;
    for (const t of [0, nice / 2, nice]) {
      const y = H - padB - (t / nice) * (H - padB - 10);
      svg += `<line class="grid" x1="${padL}" x2="${W}" y1="${y}" y2="${y}"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end">${t}</text>`;
    }
    vals.forEach((v, i) => {
      const h = (v / nice) * (H - padB - 10);
      const x = padL + i * bw + gap / 2;
      const label = dayKeys[i].toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      svg += `<rect class="col" x="${x}" y="${H - padB - h}" width="${Math.max(1, bw - gap)}" height="${Math.max(0, h)}" rx="${bw > 8 ? 2 : 0}" data-tip="${label}: ${v} visitors"/>`;
    });
    [[0, "start"], [Math.floor(days / 2), "middle"], [days - 1, "end"]].forEach(([i, anchor]) => {
      const x = anchor === "start" ? padL + i * bw : anchor === "end" ? padL + (i + 1) * bw : padL + i * bw + bw / 2;
      svg += `<text x="${x}" y="${H - 5}" text-anchor="${anchor}">${dayKeys[i].toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</text>`;
    });
    $("chDaily").innerHTML = svg + "</svg>";
    bindTips($("chDaily"));

    // Busiest times: day of week × hour (distinct visitors per slot)
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const slots = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => new Set()));
    for (const e of events) {
      const d = new Date(e.t);
      slots[(d.getDay() + 6) % 7][d.getHours()].add(e.anon);
    }
    const smax = Math.max(1, ...slots.flat().map((s) => s.size));
    let html = `<div class="hours"><span></span>${Array.from({ length: 24 }, (_, h) => `<span class="hlabel">${h % 3 === 0 ? (h % 12 || 12) + (h < 12 ? "a" : "p") : ""}</span>`).join("")}`;
    slots.forEach((row, di) => {
      html += `<span class="dlabel">${dayNames[di]}</span>`;
      row.forEach((s, h) => {
        const a = s.size / smax;
        const bg = s.size ? `rgba(47, 90, 69, ${0.12 + a * 0.88})` : "";
        html += `<span class="cell" style="${bg ? "background:" + bg : ""}" data-tip="${dayNames[di]} ${String(h).padStart(2, "0")}:00 to ${String(h + 1).padStart(2, "0")}:00<br>${s.size} visitors"></span>`;
      });
    });
    $("chHours").innerHTML = html + "</div>";
    bindTips($("chHours"));
  }

  // ---------- Inventory ----------
  function renderInventory() {
    const q = $("invSearch").value.trim().toLowerCase();
    const f = $("invFilter").value;
    const rows = plots
      .filter((p) => (f === "all" || p.status === f || p.kind === f) && (!q || p.no.toLowerCase().replace(/^s/, "") === q.replace(/^(shop|plot|s)\s*/, "") || name(p).toLowerCase().includes(q)))
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.no.localeCompare(b.no, undefined, { numeric: true }));
    const avail = plots.filter((p) => p.status === "available").length;
    $("invSummary").textContent = `${avail} available, ${plots.length - avail} allotted`;
    $("tblInv").innerHTML = `<thead><tr><th>Unit</th><th>Area</th><th>Dimensions</th><th>Facing</th><th>Type</th><th class="num">Viewed</th><th class="num">Enquiries</th><th>Status</th><th></th></tr></thead><tbody>${
      rows.map((p) => {
        const d = perPlot[p.no] || { viewers: 0, enquiries: 0 };
        const type = [p.kind === "shop" && "Shop", p.corner && "Corner", p.parkFacing && "Park-facing"].filter(Boolean).join(", ") || "Regular";
        const next = p.status === "allotted" ? "available" : "allotted";
        return `<tr><td><strong>${esc(name(p))}</strong></td><td>${gajText(p.gaj)} gaj <span class="muted">(${fmt(p.sqft)} sq ft)</span></td><td>${esc(p.dims)}</td><td>${esc(p.facing)}</td><td>${type}</td>
          <td class="num">${d.viewers}</td><td class="num">${d.enquiries}</td>
          <td><span class="status ${p.status}">${p.status === "allotted" ? "Allotted" : "Available"}</span></td>
          <td><button class="allot-btn" type="button" data-no="${esc(p.no)}" data-set="${next}">${next === "allotted" ? "Mark allotted" : "Mark available"}</button></td></tr>`;
      }).join("")}</tbody>`;
  }
  $("invSearch").addEventListener("input", renderInventory);
  $("invFilter").addEventListener("change", renderInventory);
  $("tblInv").addEventListener("click", (e) => {
    const b = e.target.closest(".allot-btn"); if (b) setStatus(b.dataset.no, b.dataset.set);
  });

  // ---------- Settings ----------
  async function loadSettings() {
    const s = await Store.backend.settings();
    $("sWindow").value = s.windowDays; $("sTop").value = s.topPercent; $("sMin").value = s.minToShow;
  }
  $("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await Store.backend.saveSettings({ windowDays: +$("sWindow").value, topPercent: +$("sTop").value, minToShow: +$("sMin").value });
      $("settingsMsg").textContent = "Saved. The public page uses these from the next visit.";
    } catch (err) { $("settingsMsg").textContent = "Couldn't save settings. Try again."; }
  });

  // ---------- Start ----------
  if (await Store.backend.session()) await showApp();
  else $("loginView").hidden = false;
  setInterval(() => { if (!$("appView").hidden) refresh().catch(() => {}); }, 60000);
})();
