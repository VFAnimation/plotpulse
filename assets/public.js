(async function () {
  const CFG = window.PLOTPULSE_CONFIG;
  const Store = window.PlotPulseStore;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Number(n).toLocaleString("en-IN");
  const gajText = (g) => (Number.isInteger(g) ? g : Number(g).toFixed(1).replace(/\.0$/, ""));
  const unitName = (u) => (u.kind === "shop" ? `Shop ${u.no.replace(/^S/, "")}` : `Plot ${u.no}`);
  const unitRef = (u) => (u.kind === "shop" ? `Shop No. ${u.no.replace(/^S/, "")}` : `Plot No. ${u.no}`);

  // ---------- Static content from config ----------
  const C = CFG.colony;
  document.title = `${C.name}, plots and shops`;
  $("brandMark").textContent = C.builderShort;
  $("brandName").textContent = C.name;
  $("heroTitle").textContent = C.name;
  $("heroLede").textContent = C.tagline;
  $("footName").textContent = C.name;
  $("footBuilder").textContent = `Developed by ${C.builder}`;
  $("credit").textContent = CFG.credit.name;
  $("credit").href = CFG.credit.url;

  const generalWa = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(`Hi, I'd like to know more about ${C.name}.`)}`;
  $("navCta").href = generalWa;
  $("footWa").href = generalWa;

  // Highlights around the hero model
  const ICONS = {
    road: '<path d="M8 3 5 21M16 3l3 18M12 4v3M12 10v4M12 17v3"/>',
    park: '<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V21M8.5 21h7"/>',
    community: '<path d="M4 10 12 4l8 6M6 9v11h12V9M10 20v-5h4v5"/>',
    shop: '<path d="M4 9h16l-1.5-5h-13zM5 9v11h14V9M9.5 20v-6h5v6"/>',
    parking: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
    stp: '<path d="M7 7a7 7 0 0 1 11 2M17 17A7 7 0 0 1 6 15M18 4v5h-5M6 20v-5h5"/>',
    gate: '<path d="M4 21V9a8 8 0 0 1 16 0v12M8 21v-9M12 21v-9M16 21v-9"/>',
  };
  const hl = (C.highlights || []).map((h) =>
    `<li><span class="hl-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[h.icon] || ICONS.road}</svg></span><span>${esc(h.text)}</span></li>`);
  const half = Math.ceil(hl.length / 2);
  $("hlLeft").innerHTML = hl.slice(0, half).join("");
  $("hlRight").innerHTML = hl.slice(half).join("");

  const L = CFG.location;
  $("address").textContent = L.address;
  $("nearby").innerHTML = L.nearby.map((n) => `<li><span>${esc(n.name)}</span><span>${esc(n.distance)}</span></li>`).join("");
  $("mapsLink").href = `https://www.google.com/maps/search/?api=1&query=${L.lat},${L.lng}`;
  $("mapsLink").addEventListener("click", () => Store.track("map_view"));

  $("rera").textContent = CFG.trust.rera;
  $("docs").innerHTML = CFG.trust.documents.map((d) =>
    `<li><a href="${esc(d.file)}" target="_blank" rel="noopener">
      <span class="doc-icon" aria-hidden="true">PDF</span>
      <span><strong>${esc(d.title)}</strong><small>Open the PDF</small></span></a></li>`).join("");
  $("docs").addEventListener("click", (e) => { if (e.target.closest("a")) Store.track("doc_view"); });

  // Load the map only when it scrolls near view (saves data on phones)
  const mapIO = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) {
      $("mapFrame").src = `https://maps.google.com/maps?q=${L.lat},${L.lng}&z=15&output=embed`;
      mapIO.disconnect();
    }
  }, { rootMargin: "300px" });
  mapIO.observe($("mapFrame"));

  // ---------- Data ----------
  await Store.init("");
  Store.track("page_view");
  let units = await Store.plots();
  let demand = await Store.demand();
  const S = demand.settings;
  const sale = () => units.filter((u) => u.kind !== "ews");

  const isHot = (u) => u.status === "available" && demand.byPlot[u.no] && demand.byPlot[u.no].hot;
  const stateOf = (u) => (u.status === "allotted" ? "allotted" : isHot(u) ? "demand" : "available");
  const look = (u) => {
    if (u.kind === "ews") return { cls: "" };
    const st = stateOf(u);
    const stText = { available: "available", demand: "available, in demand", allotted: "allotted" }[st];
    return {
      cls: st === "allotted" ? "is-allotted" : st === "demand" ? "is-demand" : "",
      badge: st === "demand" && u.kind === "plot" ? "🔥" : null,
      label: `${unitName(u)}, ${gajText(u.gaj)} gaj, ${u.facing} facing, ${stText}`,
    };
  };

  // ---------- Hero ----------
  function renderHero() {
    const avail = sale().filter((u) => u.status === "available");
    const plotsLeft = avail.filter((u) => u.kind === "plot").length;
    const shopsLeft = avail.filter((u) => u.kind === "shop").length;
    $("liveText").textContent = `${plotsLeft} plots and ${shopsLeft} shops available now`;
    if (CFG.heroImage) {
      $("heroRender").src = CFG.heroImage; $("heroRender").hidden = false; $("heroModel").hidden = true;
    } else {
      window.PlotPlan.render($("heroModel"), Store.plan, units, { static: true, look });
    }
  }
  function renderSizes() {
    const plots = sale().filter((u) => u.kind === "plot");
    const shops = sale().filter((u) => u.kind === "shop");
    const g = plots.map((u) => u.gaj);
    const rows = [
      ["Plot sizes", `${Math.round(Math.min(...g))} to ${Math.round(Math.max(...g))} gaj`],
      ["Plots", String(plots.length)],
      ["Shops", `${shops.length}, ${gajText(shops[0] ? shops[0].gaj : 0)} gaj each`],
    ];
    $("sizes").innerHTML = rows.map(([k, v], i) => `${i ? '<span class="sep" aria-hidden="true"></span>' : ""}<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }

  function renderCounts() {
    const s = sale();
    const avail = s.filter((u) => u.status === "available").length;
    const hot = s.filter(isHot).length;
    $("counts").innerHTML =
      `<div class="count"><b>${avail}</b><span>of ${s.length} available</span></div>` +
      (hot ? `<div class="count demand"><b>${hot}</b><span>in demand this week</span></div>` : "");
  }

  // ---------- Filters ----------
  const filters = { kind: "all", size: "all", facing: "all", corner: false, park: false, availableOnly: false };
  const sizeKey = (u) => String(Math.round(u.gaj));
  const plotSizes = [...new Set(sale().filter((u) => u.kind === "plot").map(sizeKey))].sort((a, b) => a - b);
  const facings = ["East", "West", "North", "South"].filter((f) => sale().some((u) => u.facing === f));
  $("filters").innerHTML = `
    <span class="seg-group" role="group" aria-label="Show">
      <button type="button" data-kind="all" aria-pressed="true">All</button>
      <button type="button" data-kind="plot" aria-pressed="false">Plots</button>
      <button type="button" data-kind="shop" aria-pressed="false">Shops</button>
    </span>
    <select class="filter-select" id="fSize" aria-label="Plot size">
      <option value="all">Any size</option>
      ${plotSizes.map((s) => `<option value="${s}">About ${s} gaj</option>`).join("")}
    </select>
    <select class="filter-select" id="fFacing" aria-label="Facing">
      <option value="all">Any facing</option>
      ${facings.map((f) => `<option value="${f}">${f} facing</option>`).join("")}
    </select>
    <button class="chip" type="button" aria-pressed="false" data-f="corner">Corner</button>
    <button class="chip" type="button" aria-pressed="false" data-f="park">Park-facing</button>
    <button class="chip" type="button" aria-pressed="false" data-f="availableOnly">Available only</button>`;
  $("fSize").addEventListener("change", (e) => { filters.size = e.target.value; applyFilters(); });
  $("fFacing").addEventListener("change", (e) => { filters.facing = e.target.value; applyFilters(); });
  $("filters").addEventListener("click", (e) => {
    const k = e.target.closest("[data-kind]");
    if (k) {
      filters.kind = k.dataset.kind;
      $("filters").querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", b === k));
      applyFilters(); return;
    }
    const b = e.target.closest(".chip"); if (!b) return;
    filters[b.dataset.f] = !filters[b.dataset.f];
    b.setAttribute("aria-pressed", filters[b.dataset.f]);
    applyFilters();
  });
  const matches = (u) =>
    (filters.kind === "all" || u.kind === filters.kind) &&
    (filters.size === "all" || (u.kind === "plot" && sizeKey(u) === filters.size)) &&
    (filters.facing === "all" || u.facing === filters.facing) &&
    (!filters.corner || u.corner) && (!filters.park || u.parkFacing) &&
    (!filters.availableOnly || u.status === "available");
  const anyFilter = () => filters.kind !== "all" || filters.size !== "all" || filters.facing !== "all" || filters.corner || filters.park || filters.availableOnly;
  function applyFilters() { plan.dim(anyFilter() ? matches : null); }

  // ---------- Plan ----------
  let plan, selected = null;
  function drawPlan() {
    plan = window.PlotPlan.render($("plan"), Store.plan, units, { look, onSelect: openUnit });
    applyFilters();
    if (selected) plan.select(selected.no);
  }

  // Zoom: phones start zoomed in so plots are big enough to tap; scroll to pan.
  const sc = $("planScroll");
  const ZOOMS = [1, 1.5, 2, 2.6, 3.4, 4.4];
  let zi = window.matchMedia("(max-width: 560px)").matches ? 3 : window.matchMedia("(max-width: 920px)").matches ? 1 : 0;
  function setZoom(next, keepCentre = true) {
    const cx = (sc.scrollLeft + sc.clientWidth / 2) / sc.scrollWidth;
    const cy = (sc.scrollTop + sc.clientHeight / 2) / sc.scrollHeight;
    zi = Math.max(0, Math.min(ZOOMS.length - 1, next));
    $("plan").style.setProperty("--zoom", ZOOMS[zi]);
    // keep the visible plan no taller than the screen allows when zoomed
    sc.style.maxHeight = zi ? Math.round(window.innerHeight * 0.7) + "px" : "";
    if (keepCentre) {
      sc.scrollLeft = cx * sc.scrollWidth - sc.clientWidth / 2;
      sc.scrollTop = cy * sc.scrollHeight - sc.clientHeight / 2;
    }
    $("zoomOut").disabled = zi === 0;
    $("zoomIn").disabled = zi === ZOOMS.length - 1;
  }
  $("zoomIn").addEventListener("click", () => setZoom(zi + 1));
  $("zoomOut").addEventListener("click", () => setZoom(zi - 1));

  drawPlan();
  renderHero();
  renderSizes();
  renderCounts();
  setZoom(zi, false);
  // start phones looking at the middle of the colony
  sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * 0.42;
  sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * 0.4;

  // ---------- Plot details ----------
  const waIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1 0-.3-.1-.5-.2z"/></svg>`;

  function waLink(u) {
    const msg = CFG.whatsappMessage.replace("{unit}", unitRef(u)).replace("{plot}", unitRef(u)).replace("{colony}", C.name);
    return `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(msg)}`;
  }

  function openUnit(u) {
    selected = u;
    plan.select(u.no);
    Store.track("plot_view", u.no);
    const d = demand.byPlot[u.no] || { viewers: 0 };
    const st = stateOf(u);
    const pill = { available: "Available", demand: "Available, in demand", allotted: "Allotted" }[st];
    const tags = [u.corner && "Corner", u.parkFacing && "Park-facing", u.kind === "shop" && "On the main road"].filter(Boolean);
    const word = u.kind === "shop" ? "shop" : "plot";

    let interest = "";
    if (u.status === "available" && d.viewers >= S.minToShow) {
      interest = `<p class="interest${st === "demand" ? "" : " calm"}"><span aria-hidden="true">${st === "demand" ? "🔥" : "👁"}</span><span><strong>${d.viewers} people</strong> viewed this ${word} in the last ${S.windowDays} days</span></p>`;
    }

    const action = u.status === "available"
      ? `<a class="btn btn-wa" id="waBtn" href="${waLink(u)}" target="_blank" rel="noopener">${waIcon}Ask the price on WhatsApp</a>
         <p class="price-note">The builder replies with the price and a time for a site visit.</p>`
      : `<p class="allotted-note">This ${word} has been allotted. Similar ones may still be available.</p>
         <button class="btn btn-ghost" type="button" id="similarBtn">Show available ${u.kind === "shop" ? "shops" : "plots of this size"}</button>`;

    $("sheetBody").innerHTML = `
      <button class="sheet-close" type="button" id="sheetClose" aria-label="Close details">×</button>
      <div class="plot-head">
        <h3>${esc(unitName(u))}</h3>
        <span class="status-pill ${st}">${pill}</span>
      </div>
      <div class="facts">
        <div class="fact wide"><span>Area</span><b>${gajText(u.gaj)} gaj</b><small>${fmt(u.sqft)} sq ft</small></div>
        <div class="fact"><span>Size</span><b>${esc(u.dims.replace(" ft", ""))}</b><small>feet</small></div>
        <div class="fact"><span>Facing</span><b>${esc(u.facing)}</b><small>${u.kind === "shop" ? "main road" : "road side"}</small></div>
      </div>
      ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>` : ""}
      ${interest}
      ${action}`;
    $("sheetEmpty").hidden = true;
    $("sheetBody").hidden = false;
    $("sheet").classList.add("is-open");

    $("sheetClose").addEventListener("click", closeSheet);
    const wa = $("waBtn");
    if (wa) wa.addEventListener("click", () => Store.track("whatsapp_click", u.no));
    const sim = $("similarBtn");
    if (sim) sim.addEventListener("click", () => {
      filters.kind = u.kind; filters.availableOnly = true;
      filters.size = u.kind === "plot" ? sizeKey(u) : "all";
      $("fSize").value = filters.size;
      $("filters").querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.kind === u.kind));
      document.querySelector('[data-f="availableOnly"]').setAttribute("aria-pressed", "true");
      applyFilters(); closeSheet();
    });
  }

  function closeSheet() {
    $("sheet").classList.remove("is-open");
    selected = null;
    plan.select(null);
    $("sheetBody").hidden = true; $("sheetEmpty").hidden = false;
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && selected) closeSheet(); });

  // ---------- 360 tour (Pannellum, loaded only when started) ----------
  const T = CFG.tour;
  let viewer = null;
  const chips = $("sceneChips");
  $("tourCoverImg").src = T.scenes[T.first].image;
  chips.innerHTML = Object.entries(T.scenes).map(([id, s]) =>
    `<button class="chip" type="button" data-scene="${id}" aria-pressed="${id === T.first}">${esc(s.title)}</button>`).join("");

  function loadAsset(tag, attrs) {
    return new Promise((res, rej) => {
      const n = document.createElement(tag);
      Object.assign(n, attrs); n.onload = res; n.onerror = rej;
      document.head.appendChild(n);
    });
  }
  function hotspot(div, args) {
    div.classList.add("pp-hot");
    const s = document.createElement("span"); s.textContent = args; div.appendChild(s);
  }
  async function startTour(sceneId) {
    if (viewer) { viewer.loadScene(sceneId); return; }
    $("tourStart").textContent = "Loading the tour";
    await Promise.all([
      loadAsset("link", { rel: "stylesheet", href: "assets/vendor/pannellum/pannellum.css" }),
      loadAsset("script", { src: "assets/vendor/pannellum/pannellum.js" }),
    ]);
    const scenes = {};
    for (const [id, s] of Object.entries(T.scenes)) {
      scenes[id] = {
        title: s.title, type: "equirectangular", panorama: s.image, hfov: 100,
        hotSpots: s.hotspots.map((h) => ({ pitch: h.pitch, yaw: h.yaw, type: "scene", sceneId: h.to, cssClass: "pp-hot-base", createTooltipFunc: hotspot, createTooltipArgs: h.text })),
      };
    }
    $("pano").hidden = false;
    viewer = window.pannellum.viewer("pano", {
      default: { firstScene: sceneId, autoLoad: true, sceneFadeDuration: 600, showControls: true, compass: false },
      scenes,
    });
    viewer.on("scenechange", (id) => {
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.scene === id));
    });
    $("tourCover").remove();
    Store.track("tour_view");
  }
  $("tourStart").addEventListener("click", () => startTour(T.first).catch(() => { $("tourStart").textContent = "The tour didn't load. Tap to try again."; }));
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === b));
    startTour(b.dataset.scene).catch(() => {});
  });

  // ---------- Keep demand fresh while the page is open ----------
  setInterval(async () => {
    try {
      units = await Store.plots();
      demand = await Store.demand();
      drawPlan(); renderCounts();
    } catch (e) { /* offline: keep showing the last data */ }
  }, 60000);
})();
