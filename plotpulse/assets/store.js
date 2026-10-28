/*
 * PlotPulse data layer.
 * Two backends with the same API:
 *  - demo:     sample activity generated in the browser + this browser's own clicks (localStorage)
 *  - supabase: shared live database (when config.supabase.url and anonKey are set)
 *
 * Privacy: no names, phone numbers, IPs or locations are stored. Each browser gets a
 * random anonymous tag so the same person opening a plot twice counts once.
 */
(function () {
  const CFG = window.PLOTPULSE_CONFIG;
  const DAY = 86400000;
  const LS = {
    anon: "pp_anon",
    events: "pp_events_v1",
    status: "pp_status_v1",
    settings: "pp_settings_v1",
    seen: "pp_seen_v1",
    session: "pp_session_v1",
    src: "pp_src",
  };
  const EVENT_TYPES = ["page_view", "plot_view", "whatsapp_click", "tour_view", "map_view", "doc_view"];

  const ls = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  function anonId() {
    let id = ls.get(LS.anon, null);
    if (!id) {
      id = "a_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      ls.set(LS.anon, id);
    }
    return id;
  }

  // Source = which QR code / link brought the visitor (?src=hoarding-pakhowal-road)
  function currentSource() {
    const p = new URLSearchParams(location.search).get("src");
    if (p) {
      const clean = p.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
      try { sessionStorage.setItem(LS.src, clean); } catch (e) {}
      return clean;
    }
    try { return sessionStorage.getItem(LS.src) || "direct"; } catch (e) { return "direct"; }
  }

  // ---------- Demo backend ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Sample activity for the demo colony: 45 days of visitors, generated the same way on every load.
  function sampleEvents(plots) {
    const rnd = mulberry32(42);
    const now = Date.now();
    const sources = [
      ["hoarding-pakhowal-road", 30], ["hoarding-ferozepur-road", 14], ["brochure-site-office", 10],
      ["instagram", 22], ["whatsapp-share", 16], ["direct", 8],
    ];
    const pick = (list) => {
      const total = list.reduce((s, x) => s + x[1], 0);
      let r = rnd() * total;
      for (const x of list) { if ((r -= x[1]) <= 0) return x[0]; }
      return list[0][0];
    };
    // Rough buyer preferences for the sample: park-facing, corners, east-facing (vastu)
    // and bigger plots get more looks. Shops get steady interest. E.W.S. units are not shown.
    const appeal = plots.filter((p) => p.kind !== "ews").map((p) => {
      let a = 1;
      if (p.parkFacing) a *= 3.0;
      if (p.corner) a *= 1.9;
      if (p.facing === "East") a *= 1.45;
      if (p.facing === "North") a *= 1.2;
      if (p.kind === "plot" && p.gaj >= 145) a *= 1.4;
      if (p.kind === "shop") a *= 0.75;
      if (p.status === "allotted") a *= 0.35;
      return [p, a];
    });
    const hourW = [1,0,0,0,0,0,1,2,3,4,5,5,6,6,5,5,6,7,9,11,12,11,8,4];
    const events = [];
    const visitors = 640;
    for (let v = 0; v < visitors; v++) {
      const anon = "demo_" + v;
      const src = pick(sources);
      // more visitors recently (hoardings went up ~3 weeks ago)
      const daysAgo = Math.floor(Math.pow(rnd(), 1.25) * 45);
      const d = new Date(now - daysAgo * DAY);
      let hour = 0, r = rnd() * hourW.reduce((s, x) => s + x, 0);
      for (let h = 0; h < 24; h++) { if ((r -= hourW[h]) <= 0) { hour = h; break; } }
      d.setHours(hour, Math.floor(rnd() * 60), 0, 0);
      if (d.getTime() > now - 3600000) d.setTime(d.getTime() - DAY);
      let t = d.getTime();
      events.push({ t, type: "page_view", anon, src });
      const n = 1 + Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) {
        const p = pick(appeal.map(([pl, a]) => [pl, a]));
        t += 30000;
        events.push({ t, type: "plot_view", plot: p.no, anon, src });
        let pEnq = 0.035;
        if (p.no === "72" || p.no === "71") pEnq = 0.006;   // odd-shaped: lots of looks, few enquiries
        if (p.kind === "shop") pEnq = 0.05;
        if (p.parkFacing) pEnq = 0.06;
        if (p.status === "allotted") pEnq = 0;
        if (rnd() < pEnq) events.push({ t: t + 20000, type: "whatsapp_click", plot: p.no, anon, src });
      }
      if (rnd() < 0.45) events.push({ t: t + 5000, type: "tour_view", anon, src });
      if (rnd() < 0.2) events.push({ t: t + 8000, type: "map_view", anon, src });
    }
    return events;
  }

  function demoBackend(plots) {
    const sample = sampleEvents(plots);
    return {
      mode: "demo",
      async logEvent(e) {
        const all = ls.get(LS.events, []);
        all.push(e);
        ls.set(LS.events, all.slice(-5000));
      },
      async events(days) {
        const since = Date.now() - days * DAY;
        return sample.concat(ls.get(LS.events, [])).filter((e) => e.t >= since);
      },
      async demand(days) {
        return aggregateDemand(await this.events(days));
      },
      async statuses() { return ls.get(LS.status, {}); },
      async setStatus(no, status) {
        const s = ls.get(LS.status, {}); s[no] = status; ls.set(LS.status, s);
      },
      async settings() { return Object.assign({}, CFG.demand, ls.get(LS.settings, {})); },
      async saveSettings(v) { ls.set(LS.settings, v); },
      async signIn(email, password) {
        if (password !== CFG.demoPassword) throw new Error("Wrong password. In demo mode the password is set in colony/config.js.");
        ls.set(LS.session, { email, t: Date.now() });
      },
      async signOut() { ls.set(LS.session, null); },
      async session() { return ls.get(LS.session, null); },
    };
  }

  function aggregateDemand(events) {
    const viewers = {}, enquiries = {};
    for (const e of events) {
      if (!e.plot) continue;
      if (e.type === "plot_view") (viewers[e.plot] = viewers[e.plot] || new Set()).add(e.anon);
      if (e.type === "whatsapp_click") (enquiries[e.plot] = enquiries[e.plot] || new Set()).add(e.anon);
    }
    const out = {};
    for (const k of new Set([...Object.keys(viewers), ...Object.keys(enquiries)])) {
      out[k] = { viewers: viewers[k] ? viewers[k].size : 0, enquiries: enquiries[k] ? enquiries[k].size : 0 };
    }
    return out;
  }

  // ---------- Supabase backend ----------
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }

  async function supabaseBackend() {
    if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    const db = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey);
    const toMs = (r) => ({ t: Date.parse(r.created_at), type: r.type, plot: r.plot_no, anon: r.anon_id, src: r.source });
    return {
      mode: "live",
      async logEvent(e) {
        await db.from("events").insert({ type: e.type, plot_no: e.plot || null, anon_id: e.anon, source: e.src });
      },
      // Builder only (needs sign-in). Pages through all rows in the window.
      async events(days) {
        const since = new Date(Date.now() - days * DAY).toISOString();
        let rows = [], from = 0;
        for (;;) {
          const { data, error } = await db.from("events").select("created_at,type,plot_no,anon_id,source")
            .gte("created_at", since).order("created_at").range(from, from + 999);
          if (error) throw error;
          rows = rows.concat(data);
          if (data.length < 1000) break;
          from += 1000;
        }
        return rows.map(toMs);
      },
      // Public: only aggregated counts, never raw rows
      async demand(days) {
        const { data, error } = await db.rpc("plot_demand", { days });
        if (error) throw error;
        const out = {};
        for (const r of data) out[r.plot_no] = { viewers: r.viewers, enquiries: r.enquiries };
        return out;
      },
      async statuses() {
        const { data, error } = await db.from("plot_status").select("plot_no,status");
        if (error) throw error;
        const out = {}; for (const r of data) out[r.plot_no] = r.status; return out;
      },
      async setStatus(no, status) {
        const { error } = await db.from("plot_status").upsert({ plot_no: no, status, updated_at: new Date().toISOString() });
        if (error) throw error;
      },
      async settings() {
        const { data } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
        if (!data) return Object.assign({}, CFG.demand);
        return { windowDays: data.window_days, topPercent: data.top_percent, minToShow: data.min_to_show };
      },
      async saveSettings(v) {
        const { error } = await db.from("settings").upsert({ id: 1, window_days: v.windowDays, top_percent: v.topPercent, min_to_show: v.minToShow });
        if (error) throw error;
      },
      async signIn(email, password) {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      async signOut() { await db.auth.signOut(); },
      async session() { const { data } = await db.auth.getSession(); return data.session; },
    };
  }

  // ---------- Public API ----------
  const Store = {
    backend: null,
    plan: null,

    async init(basePath) {
      const res = await fetch((basePath || "") + "colony/plots.json", { cache: "no-cache" });
      this.plan = await res.json();
      const live = CFG.supabase && CFG.supabase.url && CFG.supabase.anonKey;
      this.backend = live ? await supabaseBackend() : demoBackend(this.plan.units);
      return this;
    },

    get mode() { return this.backend.mode; },

    // Every unit on the map (plots, shops, E.W.S.) with its current status.
    // E.W.S. units are always "reserved"; the builder can't allot them from the dashboard.
    async plots() {
      const st = await this.backend.statuses();
      return this.plan.units.map((p) => Object.assign({}, p, {
        status: p.kind === "ews" ? "reserved" : (st[p.no] || p.status || "available"),
      }));
    },

    // Logs an anonymous event. plot_view is counted once per plot per browser per day.
    track(type, plot) {
      if (!EVENT_TYPES.includes(type)) return;
      if (type === "plot_view" || type === "page_view") {
        const seen = ls.get(LS.seen, {});
        const key = type + ":" + (plot || "") + ":" + new Date().toDateString();
        if (seen[key]) return;
        seen[key] = 1; ls.set(LS.seen, seen);
      }
      const e = { t: Date.now(), type, plot: plot || null, anon: anonId(), src: currentSource() };
      this.backend.logEvent(e).catch(() => {});
    },

    // Returns { [plotNo]: { viewers, enquiries, hot } } for the public map
    async demand() {
      const s = await this.backend.settings();
      const d = await this.backend.demand(s.windowDays);
      const plots = await this.plots();
      const avail = plots.filter((p) => p.status === "available" && p.kind !== "ews")
        .map((p) => ({ no: p.no, v: (d[p.no] || {}).viewers || 0 }))
        .filter((x) => x.v > 0)
        .sort((a, b) => b.v - a.v);
      const hotCount = Math.max(1, Math.round(avail.length * (s.topPercent / 100)));
      const hot = new Set(avail.slice(0, hotCount).filter((x) => x.v >= s.minToShow).map((x) => x.no));
      const out = {};
      for (const p of plots) {
        const r = d[p.no] || { viewers: 0, enquiries: 0 };
        out[p.no] = { viewers: r.viewers, enquiries: r.enquiries, hot: hot.has(p.no) };
      }
      return { byPlot: out, settings: s };
    },

    aggregateDemand,
  };

  window.PlotPulseStore = Store;
})();
