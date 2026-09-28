/* Prototype Library viewer.
   Classic script (no modules) so index.html also works from file://.
   Everything the viewer shows is driven by window.PROTOTYPE_LIBRARY in
   catalog.js: title, storage key, defaults, viewport/page/theme order and
   labels, and the prototypes themselves. No collection-specific ids or
   labels are hardcoded below.

   State: { prototype, right, view, viewport, page, theme, zoom, ui }
   - view: "single" shows pane A; "compare" shows A and an independent B.
   - theme/page/viewport are shared *preferences*: each pane falls back
     independently when it lacks the preferred variant, while the
     preference itself is preserved.
   - Restored from query params, then localStorage, then catalog defaults. */

(function () {
  "use strict";

  var LIBRARY = window.PROTOTYPE_LIBRARY || {};
  var CATALOG = LIBRARY.prototypes || [];
  var VIEWPORTS = LIBRARY.viewports || [];
  var PAGES = LIBRARY.pages || [];
  var THEMES = LIBRARY.themes || [];
  var ZOOMS = ["fit", "full"];
  var ZOOM_LABELS = { fit: "Fit", full: "100%" };
  var UI_MODES = [
    { id: "dim", label: "Dim" },
    { id: "bright", label: "Bright" }
  ];
  var VIEW_MODES = [
    { id: "single", label: "Single" },
    { id: "compare", label: "Compare" }
  ];
  var DEFAULTS = LIBRARY.defaults || {};
  var LS_KEY = LIBRARY.storageKey || "prototype-library-viewer";

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("canvas");
  var stateMsg = $("stateMsg");
  var notice = $("notice");
  var srStatus = $("srStatus");
  var protoSelect = $("protoSelect");
  var protoSelectB = $("protoSelectB");
  var protoLabelA = $("protoLabelA");
  var compareSelector = $("compareSelector");
  var openOriginal = $("openOriginal");
  var metaNum = $("metaNum");
  var metaLabel = $("metaLabel");
  var metaDir = $("metaDir");
  var metaSrc = $("metaSrc");
  var metaSpec = $("metaSpec");

  var prefetchLinks = { prev: null, next: null, b: null };

  /* ---------- config helpers ---------- */

  function definitionById(defs, id) {
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].id === id) return defs[i];
    }
    return null;
  }

  function labelFor(defs, id) {
    var d = definitionById(defs, id);
    return d ? d.label : id;
  }

  function protoIndex(id) {
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].id === id) return i;
    }
    return -1;
  }

  /* Viewports the prototype actually has captures for, in config order. */
  function viewportsFor(proto) {
    return VIEWPORTS.filter(function (v) {
      return !!(proto.captures && proto.captures[v.id]);
    }).map(function (v) { return v.id; });
  }

  /* Pages that exist under a viewport, in config order. */
  function pagesFor(proto, viewport) {
    var caps = proto.captures && proto.captures[viewport];
    return PAGES.filter(function (p) { return !!(caps && caps[p.id]); })
      .map(function (p) { return p.id; });
  }

  /* Themes present on a page capture, in config order. */
  function themesFor(proto, viewport, page) {
    var caps = proto.captures && proto.captures[viewport];
    var cap = caps && caps[page];
    return THEMES.filter(function (t) { return !!(cap && cap[t.id]); })
      .map(function (t) { return t.id; });
  }

  /* Effective capture for proto/viewport/page + preferred theme.
     Returns { src, theme } or null when the page does not exist. */
  function resolve(proto, viewport, page, theme) {
    var caps = proto.captures && proto.captures[viewport];
    var cap = caps && caps[page];
    if (!cap) return null;
    if (cap[theme]) return { src: cap[theme], theme: theme };
    var avail = themesFor(proto, viewport, page);
    return avail.length ? { src: cap[avail[0]], theme: avail[0] } : null;
  }

  /* ---------- state ---------- */

  function validState(raw) {
    if (!raw || typeof raw !== "object") return null;
    var s = {};
    if (definitionById(CATALOG, raw.prototype)) s.prototype = raw.prototype;
    if (definitionById(CATALOG, raw.right)) s.right = raw.right;
    if (definitionById(VIEW_MODES, raw.view)) s.view = raw.view;
    if (definitionById(VIEWPORTS, raw.viewport)) s.viewport = raw.viewport;
    if (definitionById(PAGES, raw.page)) s.page = raw.page;
    if (definitionById(THEMES, raw.theme)) s.theme = raw.theme;
    if (ZOOMS.indexOf(raw.zoom) !== -1) s.zoom = raw.zoom;
    if (definitionById(UI_MODES, raw.ui)) s.ui = raw.ui;
    return s;
  }

  function defaults() {
    return {
      prototype: DEFAULTS.prototype || (CATALOG[0] && CATALOG[0].id),
      right: DEFAULTS.right ||
        (CATALOG[1] && CATALOG[1].id) || (CATALOG[0] && CATALOG[0].id),
      view: DEFAULTS.view || "single",
      viewport: DEFAULTS.viewport || (VIEWPORTS[0] && VIEWPORTS[0].id),
      page: DEFAULTS.page || (PAGES[0] && PAGES[0].id),
      theme: DEFAULTS.theme || (THEMES[0] && THEMES[0].id),
      zoom: DEFAULTS.zoom || ZOOMS[0],
      ui: DEFAULTS.ui || "dim"
    };
  }

  function loadState() {
    var s = defaults();
    try {
      var saved = validState(JSON.parse(localStorage.getItem(LS_KEY) || "null"));
      if (saved) for (var k in saved) s[k] = saved[k];
    } catch (e) { /* storage unavailable or corrupt — keep defaults */ }
    try {
      var q = new URLSearchParams(window.location.search);
      var fromUrl = validState({
        prototype: q.get("prototype"),
        right: q.get("right"),
        view: q.get("view"),
        viewport: q.get("viewport"),
        page: q.get("page"),
        theme: q.get("theme"),
        zoom: q.get("zoom"),
        ui: q.get("ui")
      });
      if (fromUrl) for (var k2 in fromUrl) s[k2] = fromUrl[k2];
    } catch (e) { /* ignore */ }
    return s;
  }

  var state = loadState();

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { }
    try {
      var q = new URLSearchParams();
      q.set("prototype", state.prototype);
      q.set("right", state.right);
      q.set("view", state.view);
      q.set("viewport", state.viewport);
      q.set("page", state.page);
      q.set("theme", state.theme);
      q.set("zoom", state.zoom);
      q.set("ui", state.ui);
      var url = window.location.pathname + "?" + q.toString();
      history.replaceState(null, "", url);
    } catch (e) { /* file:// or older browser — skip */ }
  }

  /* Resolve one pane against the shared preferences without mutating
     state: viewport falls back to first available, page falls back via the
     page definition's fallback (else first available), theme falls back to
     the first configured theme present. */
  function selectionFor(proto) {
    var vps = viewportsFor(proto);
    var vp = vps.indexOf(state.viewport) !== -1 ? state.viewport : vps[0];
    var pages = pagesFor(proto, vp);
    var pg = state.page;
    if (pages.indexOf(pg) === -1) {
      var def = definitionById(PAGES, pg);
      pg = (def && def.fallback && pages.indexOf(def.fallback) !== -1)
        ? def.fallback : pages[0];
    }
    return { viewport: vp, page: pg, result: resolve(proto, vp, pg, state.theme) };
  }

  var comparing = function () { return state.view === "compare"; };

  /* Normalize the shared preference so it is attainable by pane A (single)
     or by at least one pane (compare). */
  function normalizeState() {
    var a = definitionById(CATALOG, state.prototype);
    var b = comparing() ? definitionById(CATALOG, state.right) : null;
    var vpOk = viewportsFor(a).indexOf(state.viewport) !== -1 ||
      !!(b && viewportsFor(b).indexOf(state.viewport) !== -1);
    if (!vpOk) state.viewport = viewportsFor(a)[0];
    var selA = selectionFor(a);
    var availA = pagesFor(a, selA.viewport);
    var selB = b ? selectionFor(b) : null;
    var availB = selB ? pagesFor(b, selB.viewport) : [];
    if (availA.indexOf(state.page) === -1 && availB.indexOf(state.page) === -1) {
      var def = definitionById(PAGES, state.page);
      state.page = (def && def.fallback && availA.indexOf(def.fallback) !== -1)
        ? def.fallback : availA[0];
    }
  }

  /* ---------- panes ---------- */

  var panes = {
    A: { key: "A", side: "Left", el: $("paneA"), img: $("shot"),
         msg: $("paneMsgA"), caption: $("captionA"),
         currentSrc: null, sel: null, proto: null },
    B: { key: "B", side: "Right", el: $("paneB"), img: $("shotB"),
         msg: $("paneMsgB"), caption: $("captionB"),
         currentSrc: null, sel: null, proto: null }
  };

  function pad2(n) { return String(n).padStart(2, "0"); }

  function updateCaption(pane) {
    var dims = (pane.img.naturalWidth)
      ? " · " + pane.img.naturalWidth + " × " + pane.img.naturalHeight
      : " · — × —";
    pane.caption.textContent =
      pad2(pane.proto.number) + " — " + pane.proto.label + dims;
    pane.caption.href = pane.sel && pane.sel.result ? pane.sel.result.src : "#";
  }

  function bindPane(pane) {
    pane.img.addEventListener("load", function () {
      pane.el.classList.remove("loading", "error");
      pane.msg.hidden = true;
      updateCaption(pane);
      if (pane === panes.A) updateDims();
    });
    pane.img.addEventListener("error", function () {
      pane.el.classList.remove("loading");
      pane.el.classList.add("error");
      pane.msg.hidden = false;
      pane.msg.textContent = pane.side + " pane: could not load " +
        (pane.img.getAttribute("src") || "capture");
    });
  }

  function renderPane(pane, proto, sel) {
    pane.proto = proto;
    pane.sel = sel;
    var res = sel.result;
    if (!res) {
      pane.el.classList.remove("loading");
      pane.el.classList.add("error");
      pane.msg.hidden = false;
      pane.msg.textContent = pane.side + " pane: no " +
        labelFor(VIEWPORTS, sel.viewport) + " capture for " +
        labelFor(PAGES, sel.page) + ".";
      updateCaption(pane);
      return;
    }
    if (res.src !== pane.currentSrc) {
      pane.currentSrc = res.src;
      pane.el.classList.add("loading");
      pane.el.classList.remove("error");
      pane.msg.hidden = true;
      pane.msg.textContent = "";
      pane.img.src = res.src;
    } else {
      pane.el.classList.remove("loading", "error");
      pane.msg.hidden = true;
    }
    pane.img.alt = pane.side + ": " + proto.label + " — " +
      labelFor(PAGES, sel.page) + ", " + labelFor(THEMES, res.theme) + ", " +
      labelFor(VIEWPORTS, sel.viewport);
    updateCaption(pane);
  }

  /* ---------- rendering ---------- */

  function showError(text) {
    canvas.classList.remove("loading");
    canvas.classList.add("error");
    stateMsg.hidden = false;
    stateMsg.textContent = text;
  }

  function fallbackClauses() {
    var clauses = [];
    var active = comparing() ? [panes.A, panes.B] : [panes.A];
    active.forEach(function (pane) {
      var sel = pane.sel;
      if (!sel || !sel.result) return;
      var parts = [];
      if (sel.page !== state.page) {
        parts.push(labelFor(PAGES, state.page) + " unavailable — showing " +
          labelFor(PAGES, sel.page) + ".");
      }
      if (sel.result.theme !== state.theme) {
        parts.push(labelFor(THEMES, state.theme) + " unavailable — showing " +
          labelFor(THEMES, sel.result.theme) + ".");
      }
      if (sel.viewport !== state.viewport) {
        parts.push(labelFor(VIEWPORTS, state.viewport) + " unavailable — showing " +
          labelFor(VIEWPORTS, sel.viewport) + ".");
      }
      if (parts.length) {
        clauses.push(pane.key + " · " + pane.proto.label + ": " + parts.join(" "));
      }
    });
    return clauses;
  }

  function render() {
    var proto = definitionById(CATALOG, state.prototype);
    if (!proto) {
      showError("No prototype \u201c" + state.prototype + "\u201d in the catalog.");
      return;
    }
    normalizeState();
    var protoB = comparing() ? definitionById(CATALOG, state.right) : null;

    var selA = selectionFor(proto);
    renderPane(panes.A, proto, selA);
    var selB = null;
    if (comparing() && protoB) {
      selB = selectionFor(protoB);
      renderPane(panes.B, protoB, selB);
      panes.B.el.hidden = false;
    } else {
      panes.B.el.hidden = true;
    }

    /* segmented controls */
    var availA = pagesFor(proto, selA.viewport);
    var availB = selB ? pagesFor(protoB, selB.viewport) : [];
    var capA = (proto.captures[selA.viewport] || {})[selA.page] || {};
    var capB = (selB && protoB.captures[selB.viewport]) ?
      protoB.captures[selB.viewport][selB.page] || {} : {};

    document.querySelectorAll("#viewSeg button").forEach(function (b) {
      var v = b.getAttribute("data-view");
      b.setAttribute("aria-pressed", String(v === state.view));
      b.disabled = v === "compare" && CATALOG.length < 2;
    });
    document.querySelectorAll("#viewportSeg button").forEach(function (b) {
      var v = b.getAttribute("data-viewport");
      b.setAttribute("aria-pressed", String(v === state.viewport));
      var aHas = viewportsFor(proto).indexOf(v) !== -1;
      var bHas = selB && viewportsFor(protoB).indexOf(v) !== -1;
      b.disabled = !aHas && !bHas;
    });
    document.querySelectorAll("#pageSeg button").forEach(function (b) {
      var p = b.getAttribute("data-page");
      b.setAttribute("aria-pressed", String(p === state.page));
      b.disabled = availA.indexOf(p) === -1 && availB.indexOf(p) === -1;
    });
    document.querySelectorAll("#themeSeg button").forEach(function (b) {
      var t = b.getAttribute("data-theme");
      /* Single mode shows the effective theme; compare shows the shared
         preference so one pane's fallback never rewrites the control. */
      b.setAttribute("aria-pressed",
        String(t === (comparing() || !selA.result
          ? state.theme : selA.result.theme)));
      b.disabled = !capA[t] && !(capB && capB[t]);
    });
    document.querySelectorAll("#zoomSeg button").forEach(function (b) {
      b.setAttribute("aria-pressed",
        String(b.getAttribute("data-zoom") === state.zoom));
    });
    document.querySelectorAll("#uiSeg button").forEach(function (b) {
      b.setAttribute("aria-pressed",
        String(b.getAttribute("data-ui") === state.ui));
    });
    document.body.classList.toggle("viewer-dim", state.ui === "dim");

    /* selectors + compare chrome */
    protoSelect.value = state.prototype;
    protoSelectB.value = state.right;
    protoLabelA.hidden = !comparing();
    compareSelector.hidden = !comparing();
    $("rightKeys").hidden = !comparing();

    /* metadata strip — pane A, one-based position in the catalog */
    metaNum.textContent = pad2(protoIndex(state.prototype) + 1) +
      " / " + CATALOG.length;
    metaLabel.textContent = proto.label;
    metaDir.textContent = proto.direction;
    metaSrc.textContent = proto.source;
    updateDims();

    /* notice + live status */
    var clauses = fallbackClauses();
    if (clauses.length) {
      notice.hidden = false;
      notice.textContent = clauses.join(" ");
    } else {
      notice.hidden = true;
      notice.textContent = "";
    }
    var aStatus = proto.label + " — " + labelFor(PAGES, selA.page) + " — " +
      (selA.result ? labelFor(THEMES, selA.result.theme) : "—") + " — " +
      labelFor(VIEWPORTS, selA.viewport);
    srStatus.textContent = (comparing() && protoB)
      ? "A: " + aStatus + " | B: " + protoB.label + " — " +
        labelFor(PAGES, selB.page) + " — " +
        (selB.result ? labelFor(THEMES, selB.result.theme) : "—") +
        " — " + labelFor(VIEWPORTS, selB.viewport)
      : aStatus;

    /* open original (pane A) */
    openOriginal.href = selA.result ? selA.result.src : "#";
    openOriginal.textContent =
      comparing() ? "Open A original ↗" : "Open original ↗";

    /* zoom + view classes */
    canvas.classList.toggle("zoom-fit", state.zoom === "fit");
    canvas.classList.toggle("zoom-full", state.zoom === "full");
    canvas.classList.toggle("compare", comparing());

    persist();
    schedulePrefetch();
  }

  function updateDims() {
    var sel = panes.A.sel;
    if (!sel) return;
    var spec = labelFor(VIEWPORTS, sel.viewport) + " · " +
      labelFor(PAGES, sel.page) + " · " +
      (sel.result ? labelFor(THEMES, sel.result.theme) : "—");
    metaSpec.textContent = spec + " · " +
      (panes.A.img.naturalWidth
        ? panes.A.img.naturalWidth + " × " + panes.A.img.naturalHeight
        : "— × —");
  }

  /* ---------- prefetch (adjacent A + resolved B in compare) ---- */

  function ensurePrefetchLink(which) {
    if (!prefetchLinks[which]) {
      var l = document.createElement("link");
      l.rel = "prefetch";
      l.as = "image";
      document.head.appendChild(l);
      prefetchLinks[which] = l;
    }
    return prefetchLinks[which];
  }

  function schedulePrefetch() {
    var idle = window.requestIdleCallback ||
      function (cb) { return setTimeout(cb, 400); };
    idle(function () {
      var idx = protoIndex(state.prototype);
      ["prev", "next"].forEach(function (which, i) {
        var target = CATALOG[(idx + (i === 0 ? -1 : 1) + CATALOG.length) % CATALOG.length];
        var sel = selectionFor(target);
        ensurePrefetchLink(which).href = sel && sel.result ? sel.result.src : "";
      });
      var b = definitionById(CATALOG, state.right);
      var selB = comparing() && b ? selectionFor(b) : null;
      ensurePrefetchLink("b").href = selB && selB.result ? selB.result.src : "";
    });
  }

  /* ---------- mutations ---------- */

  function setPrototype(id) {
    if (!definitionById(CATALOG, id)) return;
    state.prototype = id;
    render();
  }

  function setRight(id) {
    if (!definitionById(CATALOG, id)) return;
    state.right = id;
    render();
  }

  function stepPrototype(delta) {
    if (!CATALOG.length) return;
    var idx = protoIndex(state.prototype);
    if (idx === -1) return;
    setPrototype(CATALOG[(idx + delta + CATALOG.length) % CATALOG.length].id);
  }

  function stepRight(delta) {
    if (!CATALOG.length) return;
    var idx = protoIndex(state.right);
    if (idx === -1) return;
    setRight(CATALOG[(idx + delta + CATALOG.length) % CATALOG.length].id);
  }

  function setView(view) {
    if (!definitionById(VIEW_MODES, view)) return;
    if (view === "compare" && CATALOG.length < 2) return;
    state.view = view;
    render();
  }

  function setViewport(viewport) {
    var proto = definitionById(CATALOG, state.prototype);
    if (!proto) return;
    if (viewportsFor(proto).indexOf(viewport) === -1) {
      var b = comparing() ? definitionById(CATALOG, state.right) : null;
      if (!b || viewportsFor(b).indexOf(viewport) === -1) return;
    }
    state.viewport = viewport;
    render();
  }

  function setPage(page) {
    var proto = definitionById(CATALOG, state.prototype);
    if (!proto) return;
    if (pagesFor(proto, selectionFor(proto).viewport).indexOf(page) === -1) {
      var b = comparing() ? definitionById(CATALOG, state.right) : null;
      if (!b || pagesFor(b, selectionFor(b).viewport).indexOf(page) === -1) return;
    }
    state.page = page;
    render();
  }

  function stepPage(delta) {
    var proto = definitionById(CATALOG, state.prototype);
    if (!proto) return;
    var avail = pagesFor(proto, selectionFor(proto).viewport);
    var b = comparing() ? definitionById(CATALOG, state.right) : null;
    if (b) {
      pagesFor(b, selectionFor(b).viewport).forEach(function (p) {
        if (avail.indexOf(p) === -1) avail.push(p);
      });
      avail = PAGES.map(function (p) { return p.id; })
        .filter(function (p) { return avail.indexOf(p) !== -1; });
    }
    if (!avail.length) return;
    var i = avail.indexOf(state.page);
    var next = avail[((i === -1 ? 0 : i) + delta + avail.length) % avail.length];
    setPage(next);
  }

  function setTheme(theme) {
    /* Preferred theme is stored even when a pane cannot show it. */
    if (!definitionById(THEMES, theme)) return;
    state.theme = theme;
    render();
  }

  function setZoom(zoom) {
    if (ZOOMS.indexOf(zoom) === -1) return;
    state.zoom = zoom;
    render();
  }

  function setUi(ui) {
    if (!definitionById(UI_MODES, ui)) return;
    state.ui = ui;
    render();
  }

  /* ---------- segmented control construction ---------- */

  function buildSeg(containerId, defs, attr, labelFn) {
    var c = $(containerId);
    defs.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-" + attr, d.id);
      b.setAttribute("aria-pressed", "false");
      b.textContent = labelFn ? labelFn(d) : d.label;
      c.appendChild(b);
    });
    return c;
  }

  function onSeg(containerId, attr, fn) {
    $(containerId).addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (b && !b.disabled) fn(b.getAttribute("data-" + attr));
    });
  }

  /* ---------- events ---------- */

  $("prevProto").addEventListener("click", function () { stepPrototype(-1); });
  $("nextProto").addEventListener("click", function () { stepPrototype(1); });
  protoSelect.addEventListener("change", function () {
    setPrototype(protoSelect.value);
  });
  protoSelectB.addEventListener("change", function () {
    setRight(protoSelectB.value);
  });
  onSeg("viewSeg", "view", setView);
  onSeg("viewportSeg", "viewport", setViewport);
  onSeg("pageSeg", "page", setPage);
  onSeg("themeSeg", "theme", setTheme);
  onSeg("zoomSeg", "zoom", setZoom);
  onSeg("uiSeg", "ui", setUi);

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (!e.shiftKey && t === protoSelect &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      stepPrototype(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (!e.shiftKey && t === protoSelectB &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      stepRight(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (t && typeof t.closest === "function" &&
        (t.closest("input, select, textarea, [contenteditable]") ||
        t.isContentEditable)) return;
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        (e.shiftKey && comparing() ? stepRight : stepPrototype)(-1); break;
      case "ArrowDown":
        e.preventDefault();
        (e.shiftKey && comparing() ? stepRight : stepPrototype)(1); break;
      case "ArrowLeft": e.preventDefault(); stepPage(-1); break;
      case "ArrowRight": e.preventDefault(); stepPage(1); break;
      case "[": if (comparing()) stepRight(-1); break;
      case "]": if (comparing()) stepRight(1); break;
      case "v": case "V":
        setView(comparing() ? "single" : "compare"); break;
      case "t": case "T":
        if (THEMES.length) {
          var i = THEMES.findIndex(function (d) { return d.id === state.theme; });
          setTheme(THEMES[(i + 1) % THEMES.length].id);
        }
        break;
      case "z": case "Z":
        setZoom(state.zoom === "fit" ? "full" : "fit"); break;
      case "c": case "C":
        setUi(state.ui === "dim" ? "bright" : "dim"); break;
      case "o": case "O":
        window.open(openOriginal.href, "_blank", "noopener"); break;
    }
  });

  /* ---------- init ---------- */

  if (LIBRARY.title) document.title = LIBRARY.title;

  if (!CATALOG.length || !VIEWPORTS.length || !PAGES.length || !THEMES.length) {
    showError("catalog.js is missing or defines no usable " +
      "prototypes/viewports/pages/themes.");
  } else {
    buildSeg("viewSeg", VIEW_MODES, "view");
    buildSeg("viewportSeg", VIEWPORTS, "viewport");
    buildSeg("pageSeg", PAGES, "page");
    buildSeg("themeSeg", THEMES, "theme");
    buildSeg("zoomSeg", ZOOMS.map(function (z) {
      return { id: z, label: ZOOM_LABELS[z] || z };
    }), "zoom");
    buildSeg("uiSeg", UI_MODES, "ui");

    CATALOG.forEach(function (p) {
      var label = pad2(p.number) + " — " + p.label;
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = label;
      protoSelect.appendChild(opt);
      var optB = document.createElement("option");
      optB.value = p.id;
      optB.textContent = label;
      protoSelectB.appendChild(optB);
    });

    bindPane(panes.A);
    bindPane(panes.B);

    render();
  }
})();
