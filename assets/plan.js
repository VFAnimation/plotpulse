/*
 * Draws the colony master plan as SVG. Used by the public page (map + hero model)
 * and the builder dashboard (demand heat map).
 *
 * colony/plots.json holds the layout: boundary, roads, blocks, park, amenities and
 * every unit (plot / shop / ews). A unit is a rectangle (x, y, w, h) or a polygon
 * ("points": "x1,y1 x2,y2 ..."), so angled plots in other colonies can be traced too.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  let uid = 0;
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const text = (parent, str, attrs) => { const t = el("text", attrs, parent); t.textContent = str; return t; };

  function box(u) {
    if (u.points) {
      const p = u.points.trim().split(/\s+/).map((s) => s.split(",").map(Number));
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    return { x: u.x, y: u.y, w: u.w, h: u.h };
  }

  function render(container, plan, units, opts) {
    opts = opts || {};
    const id = "pp" + ++uid;
    container.innerHTML = "";
    const [vx, vy, vw, vh] = plan.viewBox;
    const svg = el("svg", {
      viewBox: `${vx} ${vy} ${vw} ${vh}`, class: "plan-svg" + (opts.static ? " is-static" : ""),
      role: opts.static ? "img" : "group",
      "aria-label": opts.static ? "Model of the colony layout" : "Colony master plan. Select a plot or shop for details.",
    }, container);

    // ---------- defs ----------
    const defs = el("defs", {}, svg);
    const sh = el("filter", { id: id + "sh", x: "-10%", y: "-10%", width: "120%", height: "130%" }, defs);
    el("feDropShadow", { dx: 0, dy: 5, stdDeviation: 5, "flood-color": "#5b4a2b", "flood-opacity": 0.18 }, sh);
    const hatch = el("pattern", { id: id + "hatch", width: 10, height: 10, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    el("rect", { width: 10, height: 10, class: "hatch-bg" }, hatch);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 10, class: "hatch-line" }, hatch);
    const park = el("pattern", { id: id + "grass", width: 16, height: 16, patternUnits: "userSpaceOnUse" }, defs);
    el("rect", { width: 16, height: 16, class: "grass-bg" }, park);
    el("circle", { cx: 4, cy: 5, r: 1.3, class: "grass-dot" }, park);
    el("circle", { cx: 12, cy: 12, r: 1.1, class: "grass-dot" }, park);
    const tree = el("g", { id: id + "tree" }, defs);
    // fills are inline: CSS rules don't reach inside <use> copies in every browser
    el("circle", { cx: 2, cy: 3, r: 13, fill: "#5b4a2b", "fill-opacity": 0.14 }, tree);
    el("circle", { cx: 0, cy: 0, r: 12, fill: "#6f9a55" }, tree);
    el("circle", { cx: -3.5, cy: -3.5, r: 5.5, fill: "#8fb873" }, tree);

    // ---------- ground ----------
    el("rect", { x: vx, y: vy, width: vw, height: vh, class: "land" }, svg);
    if (plan.mainRoad) {
      el("polygon", { points: plan.mainRoad, class: "road-main" }, svg);
      const [a, b, c, d] = plan.mainRoad.split(" ").map((s) => s.split(",").map(Number));
      const midL = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2], midR = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
      el("line", { x1: midL[0], y1: midL[1], x2: midR[0], y2: midR[1], class: "road-centre" }, svg);
    }
    if (plan.boundary) el("polygon", { points: plan.boundary, class: "site" }, svg);

    // internal road centre lines are implied; road labels
    for (const l of plan.labels || []) {
      text(svg, l.text, { x: l.x, y: l.y, class: "road-label", "text-anchor": "middle", "dominant-baseline": "middle",
        transform: l.rotate ? `rotate(${l.rotate} ${l.x} ${l.y})` : null });
    }
    if (plan.mainRoadLabel) {
      const l = plan.mainRoadLabel;
      text(svg, l.text, { x: l.x, y: l.y, class: "road-label road-label-main", "text-anchor": "middle", "dominant-baseline": "middle",
        transform: l.rotate ? `rotate(${l.rotate} ${l.x} ${l.y})` : null });
    }

    // blocks the plots sit on
    for (const b of plan.blocks || []) {
      el("rect", { x: b.x - 4, y: b.y - 4, width: b.w + 8, height: b.h + 8, rx: b.rx || 6, class: "block", filter: `url(#${id}sh)` }, svg);
    }

    // park and amenities
    for (const f of plan.features || []) {
      if (f.kind === "park") {
        el("polygon", { points: f.points, class: "park", fill: `url(#${id}grass)` }, svg);
        const t = text(svg, f.label || "Park", { x: f.labelX, y: f.labelY, class: "park-label", "text-anchor": "middle" });
        if (f.sub) text(svg, f.sub, { x: f.labelX, y: f.labelY + 36, class: "park-sub", "text-anchor": "middle" });
        void t;
      } else if (f.kind === "amenity") {
        const r = el("rect", { x: f.x + 2, y: f.y + 2, width: f.w - 4, height: f.h - 4, rx: 5, class: "amenity amenity-" + f.style }, svg);
        if (f.style === "parking") r.setAttribute("fill", `url(#${id}hatch)`);
        const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
        const vertical = f.h > f.w * 1.6 && f.style === "utility";
        const t = text(svg, f.label, { x: cx, y: f.label2 ? cy - 13 : cy + 1, class: "amenity-label", "text-anchor": "middle", "dominant-baseline": "middle",
          transform: vertical ? `rotate(-90 ${cx} ${cy})` : null });
        if (f.label2) text(svg, f.label2, { x: cx, y: cy + 15, class: "amenity-label", "text-anchor": "middle", "dominant-baseline": "middle" });
        void t;
      }
    }

    for (const t of plan.trees || []) el("use", { href: `#${id}tree`, x: t[0], y: t[1] }, svg);

    // gate
    if (plan.gate) {
      const g = el("g", { class: "gate", transform: `translate(${plan.gate.x} ${plan.gate.y})` }, svg);
      el("rect", { x: -74, y: -9, width: 14, height: 18, rx: 3 }, g);
      el("rect", { x: 60, y: -9, width: 14, height: 18, rx: 3 }, g);
      el("path", { d: "M -67 -9 Q 0 -44 67 -9", class: "gate-arch" }, g);
      if (!opts.static) text(g, "ENTRY", { x: 0, y: 36, class: "gate-label", "text-anchor": "middle" });
    }

    // compass: arrow points to North
    if (plan.compass && !opts.static) {
      const rot = { N: 0, E: -90, S: 180, W: 90 }[plan.compass.up] || 0;
      const g = el("g", { class: "compass", transform: `translate(${plan.compass.x} ${plan.compass.y}) scale(1.3)` }, svg);
      el("circle", { r: 40, class: "compass-ring" }, g);
      const a = el("g", { transform: `rotate(${rot})` }, g);
      el("path", { d: "M0 -30 L9 4 L0 -2 L-9 4 Z", class: "compass-n" }, a);
      el("path", { d: "M0 30 L9 -4 L0 2 L-9 -4 Z", class: "compass-s" }, a);
      const rad = (rot - 90) * Math.PI / 180;
      text(g, "N", { x: Math.cos(rad) * 54, y: Math.sin(rad) * 54 + 1, class: "compass-label", "text-anchor": "middle", "dominant-baseline": "middle" });
    }

    // ---------- units ----------
    const nodes = {};
    for (const u of units) {
      const look = opts.look ? opts.look(u) : {};
      const interactive = !opts.static && u.kind !== "ews";
      const g = el("g", {
        class: `unit unit-${u.kind} ${look.cls || ""}`,
        "data-no": u.no,
        tabindex: interactive ? 0 : null,
        role: interactive ? "button" : null,
        "aria-label": interactive ? (look.label || `${u.kind === "shop" ? "Shop" : "Plot"} ${u.no}`) : null,
        "aria-hidden": interactive ? null : "true",
      }, svg);
      const b = box(u);
      const inset = u.kind === "shop" ? 2 : 3;
      const style = look.fill ? `fill:${look.fill}` : null;
      const shape = u.points
        ? el("polygon", { points: u.points, class: "unit-shape", style }, g)
        : el("rect", { x: b.x + inset, y: b.y + inset, width: b.w - inset * 2, height: b.h - inset * 2, rx: u.kind === "shop" ? 2.5 : 5, class: "unit-shape", style }, g);
      if (u.kind === "ews") shape.setAttribute("fill", `url(#${id}hatch)`);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const fs = u.kind === "shop" ? Math.min(17, b.w * 0.55) : Math.min(34, b.w * 0.42, b.h * 0.34);
      const label = u.no;
      if (u.kind === "shop") {
        text(g, label, { x: cx, y: cy, class: "unit-no", "text-anchor": "middle", "dominant-baseline": "central",
          style: `font-size:${fs}px${look.ink ? ";fill:" + look.ink : ""}`, transform: `rotate(-90 ${cx} ${cy})` });
      } else {
        text(g, label, { x: cx, y: cy - (look.badge ? fs * 0.35 : u.kind === "ews" ? 14 : 0), class: "unit-no", "text-anchor": "middle", "dominant-baseline": "central",
          style: `font-size:${fs}px${look.ink ? ";fill:" + look.ink : ""}` });
        if (look.badge && b.h > 60) text(g, look.badge, { x: cx, y: cy + fs * 0.75, class: "unit-badge", "text-anchor": "middle", "dominant-baseline": "central", style: `font-size:${Math.min(18, fs * 0.62)}px` });
      }
      if (interactive) {
        const select = () => opts.onSelect && opts.onSelect(u);
        g.addEventListener("click", select);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
        if (opts.onHover) {
          g.addEventListener("pointerenter", (e) => opts.onHover(u, e));
          g.addEventListener("pointermove", (e) => opts.onHover(u, e));
          g.addEventListener("pointerleave", () => opts.onHover(null));
        }
      }
      nodes[u.no] = { g, u };
    }

    // EWS strip caption
    const ews = units.filter((u) => u.kind === "ews");
    if (ews.length && !opts.static) {
      const bs = ews.map(box);
      const x0 = Math.min(...bs.map((b) => b.x)), x1 = Math.max(...bs.map((b) => b.x + b.w));
      const y1 = Math.max(...bs.map((b) => b.y + b.h));
      const t = text(svg, "E.W.S. (RESERVED)", { x: (x0 + x1) / 2, y: y1 - 16, class: "ews-label", "text-anchor": "middle" });
      void t;
    }

    return {
      svg,
      select(no) {
        for (const k in nodes) nodes[k].g.classList.toggle("is-selected", k === no);
        if (no && nodes[no]) nodes[no].g.parentNode.appendChild(nodes[no].g); // bring to front for the outline
      },
      dim(matchFn) {
        for (const k in nodes) {
          const u = nodes[k].u;
          if (u.kind === "ews") continue;
          nodes[k].g.classList.toggle("is-dimmed", !!matchFn && !matchFn(u));
        }
      },
      node(no) { return nodes[no] && nodes[no].g; },
    };
  }

  window.PlotPlan = { render };
})();
