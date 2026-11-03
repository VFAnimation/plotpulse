/*
 * Pinch-zoom and drag for an SVG, by changing its viewBox.
 * One finger / mouse drag pans, two fingers pinch, mouse wheel zooms at the cursor.
 * A tap still reaches the plot under the finger; a drag doesn't count as a tap.
 */
(function () {
  function PanZoom(svg, opts) {
    const W = opts.width, H = opts.height;
    const minW = opts.minWidth || 160;       // most zoomed-in view width (SVG units)
    let vb = { x: 0, y: 0, w: W, h: H };
    let anim = null;

    const rect = () => svg.getBoundingClientRect();
    const aspect = () => { const r = rect(); return r.height ? r.height / r.width : H / W; };

    function fitBox() {
      const a = aspect(), pad = 0.03;
      let w = W * (1 + pad * 2), h = w * a;
      if (h < H * (1 + pad * 2)) { h = H * (1 + pad * 2); w = h / a; }
      return { x: W / 2 - w / 2, y: H / 2 - h / 2, w, h };
    }
    function clamp(b) {
      const fit = fitBox();
      const a = aspect();
      let w = Math.min(Math.max(b.w, minW), fit.w);
      const h = w * a;
      // keep the plan on screen: its centre can't wander more than a small margin past an edge
      const m = Math.max(40, w * 0.3);
      const cx = Math.min(Math.max(b.x + b.w / 2, Math.min(W / 2, w / 2 - m)), Math.max(W / 2, W - w / 2 + m));
      const cy = Math.min(Math.max(b.y + b.h / 2, Math.min(H / 2, h / 2 - m)), Math.max(H / 2, H - h / 2 + m));
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    }
    function apply(b) {
      vb = clamp(b);
      svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      if (opts.onChange) opts.onChange(vb.w / fitBox().w);
    }
    function toSvg(clientX, clientY) {
      const r = rect();
      return { x: vb.x + ((clientX - r.left) / r.width) * vb.w, y: vb.y + ((clientY - r.top) / r.height) * vb.h };
    }
    function zoomAt(factor, clientX, clientY) {
      const p = toSvg(clientX, clientY);
      const w = vb.w / factor, h = vb.h / factor;
      apply({ x: p.x - (p.x - vb.x) / factor, y: p.y - (p.y - vb.y) / factor, w, h });
    }
    function animateTo(target, ms) {
      cancelAnimationFrame(anim);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const a = aspect();
      // grow the target to the screen's shape so all of it is visible
      let w = target.w, h = target.h;
      if (h / w > a) w = h / a; else h = w * a;
      const end = clamp({ x: target.x + target.w / 2 - w / 2, y: target.y + target.h / 2 - h / 2, w, h });
      if (reduce || !ms) return apply(end);
      const start = Object.assign({}, vb), t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        apply({ x: start.x + (end.x - start.x) * e, y: start.y + (end.y - start.y) * e, w: start.w + (end.w - start.w) * e, h: start.h + (end.h - start.h) * e });
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    // ---------- gestures ----------
    const pts = new Map();
    let moved = false, startDist = 0, startVb = null, startMid = null, last = null;
    svg.style.touchAction = "none";

    svg.addEventListener("pointerdown", (e) => {
      cancelAnimationFrame(anim);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { moved = false; last = { x: e.clientX, y: e.clientY }; startMid = last; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        startDist = Math.hypot(a.x - b.x, a.y - b.y);
        startVb = Object.assign({}, vb);
        startMid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
        moved = true;
      }
    });
    svg.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = rect();
      if (pts.size === 1) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        if (!moved && Math.hypot(e.clientX - startMid.x, e.clientY - startMid.y) < 8) return;
        if (!moved) { moved = true; try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
        last = { x: e.clientX, y: e.clientY };
        apply({ x: vb.x - (dx / r.width) * vb.w, y: vb.y - (dy / r.height) * vb.h, w: vb.w, h: vb.h });
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const f = Math.hypot(a.x - b.x, a.y - b.y) / (startDist || 1);
        const w = startVb.w / f, h = startVb.h / f;
        const mx = ((a.x + b.x) / 2 - r.left) / r.width, my = ((a.y + b.y) / 2 - r.top) / r.height;
        apply({ x: startMid.x - mx * w, y: startMid.y - my * h, w, h });
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size === 1) { last = Object.assign({}, [...pts.values()][0]); }
    };
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    // a drag or pinch shouldn't also select the plot under the finger
    svg.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX, e.clientY);
    }, { passive: false });

    const ro = new ResizeObserver(() => {
      const c = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 };
      const w = vb.w, h = w * aspect();
      apply({ x: c.x - w / 2, y: c.y - h / 2, w, h });
    });
    ro.observe(svg);

    apply(fitBox());
    return {
      fit() { animateTo({ x: 0, y: 0, w: W, h: H }, 320); },
      zoom(f) { const r = rect(); zoomAt(f, r.left + r.width / 2, r.top + r.height / 2); },
      focus(box, pad) {
        const p = pad == null ? 0.12 : pad;
        animateTo({ x: box.x - box.w * p, y: box.y - box.h * p, w: box.w * (1 + p * 2), h: box.h * (1 + p * 2) }, 380);
      },
      destroy() { ro.disconnect(); cancelAnimationFrame(anim); },
    };
  }
  window.PanZoom = PanZoom;
})();
