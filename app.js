/* Prototype Library viewer.
   Classic script (no modules) so index.html also works from file://.
   Everything the viewer shows is driven by window.PROTOTYPE_LIBRARY in
   catalog.js: title, storage key, defaults, viewport/page/theme order and
   labels, and the prototypes themselves. No collection-specific ids or
   labels are hardcoded below.

   State: { prototype, viewport, page, theme, zoom, ui }
   - theme is a *preference*: when a capture lacks the preferred theme the
     first available theme is shown while the preference is kept.
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
  var DEFAULTS = LIBRARY.defaults || {};
  var LS_KEY = LIBRARY.storageKey || "prototype-library-viewer";

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("canvas");
  var img = $("shot");
  var stateMsg = $("stateMsg");
  var notice = $("notice");
  var srStatus = $("srStatus");
  var protoSelect = $("protoSelect");
  var openOriginal = $("openOriginal");
  var metaNum = $("metaNum");
  var metaLabel = $("metaLabel");
  var metaDir = $("metaDir");
  var metaSrc = $("metaSrc");
  var metaSpec = $("metaSpec");

  var prefetchLinks = { prev: null, next: null };

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
      q.set("viewport", state.viewport);
      q.set("page", state.page);
      q.set("theme", state.theme);
      q.set("zoom", state.zoom);
      q.set("ui", state.ui);
      var url = window.location.pathname + "?" + q.toString();
      history.replaceState(null, "", url);
    } catch (e) { /* file:// or older browser — skip */ }
  }

  /* Normalize a {prototype, viewport, page} triple against the catalog.
     Used for live state and for resolving prefetch targets. */
  function normalize(proto, viewport, page) {
    var vps = viewportsFor(proto);
    var vp = vps.indexOf(viewport) !== -1 ? viewport : vps[0];
    var avail = pagesFor(proto, vp);
    var pg = page;
    if (avail.indexOf(pg) === -1) {
      var def = definitionById(PAGES, pg);
      pg = (def && def.fallback && avail.indexOf(def.fallback) !== -1)
        ? def.fallback : avail[0];
    }
    return { viewport: vp, page: pg };
  }

  function normalizeState() {
    var proto = definitionById(CATALOG, state.prototype);
    var n = normalize(proto, state.viewport, state.page);
    state.viewport = n.viewport;
    state.page = n.page;
  }

  /* ---------- rendering ---------- */

  var currentSrc = null;

  function setLoading() {
    canvas.classList.add("loading");
    canvas.classList.remove("error");
    stateMsg.hidden = true;
    stateMsg.textContent = "";
  }

  function showError(text) {
    canvas.classList.remove("loading");
    canvas.classList.add("error");
    stateMsg.hidden = false;
    stateMsg.textContent = text;
  }

  function render() {
    var proto = definitionById(CATALOG, state.prototype);
    if (!proto) {
      showError("No prototype \u201c" + state.prototype + "\u201d in the catalog.");
      return;
    }
    normalizeState();
    var availPages = pagesFor(proto, state.viewport);
    var res = resolve(proto, state.viewport, state.page, state.theme);
    if (!res) {
      showError("No " + labelFor(VIEWPORTS, state.viewport) + " capture for " +
        labelFor(PAGES, state.page) + ".");
      return;
    }

    /* image */
    if (res.src !== currentSrc) {
      currentSrc = res.src;
      setLoading();
      img.src = res.src;
    } else {
      canvas.classList.remove("loading", "error");
      stateMsg.hidden = true;
    }
    img.alt = proto.label + " — " + labelFor(PAGES, state.page) + " page, " +
      labelFor(THEMES, res.theme) + " theme, " +
      labelFor(VIEWPORTS, state.viewport) + " capture";

    /* segmented controls */
    document.querySelectorAll("#viewportSeg button").forEach(function (b) {
      var v = b.getAttribute("data-viewport");
      b.setAttribute("aria-pressed", String(v === state.viewport));
      b.disabled = !(proto.captures && proto.captures[v]);
    });
    document.querySelectorAll("#pageSeg button").forEach(function (b) {
      var p = b.getAttribute("data-page");
      b.setAttribute("aria-pressed", String(p === state.page));
      b.disabled = availPages.indexOf(p) === -1;
    });
    var cap = proto.captures[state.viewport][state.page];
    document.querySelectorAll("#themeSeg button").forEach(function (b) {
      var t = b.getAttribute("data-theme");
      b.setAttribute("aria-pressed", String(t === res.theme));
      b.disabled = !cap[t];
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

    /* select */
    protoSelect.value = state.prototype;

    /* metadata strip — one-based position in the catalog */
    metaNum.textContent = String(protoIndex(state.prototype) + 1).padStart(2, "0") +
      " / " + CATALOG.length;
    metaLabel.textContent = proto.label;
    metaDir.textContent = proto.direction;
    metaSrc.textContent = proto.source;
    updateDims();

    /* notice + live status */
    if (res.theme !== state.theme) {
      notice.hidden = false;
      notice.textContent = labelFor(THEMES, state.theme) +
        " unavailable — showing the " +
        labelFor(THEMES, res.theme).toLowerCase() + " capture";
    } else {
      notice.hidden = true;
      notice.textContent = "";
    }
    srStatus.textContent = proto.label + " — " + labelFor(PAGES, state.page) +
      " — " + labelFor(THEMES, res.theme) + " — " +
      labelFor(VIEWPORTS, state.viewport);

    /* open original */
    openOriginal.href = res.src;

    /* zoom */
    canvas.classList.toggle("zoom-fit", state.zoom === "fit");
    canvas.classList.toggle("zoom-full", state.zoom === "full");

    persist();
    schedulePrefetch();
  }

  function protoIndex(id) {
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].id === id) return i;
    }
    return -1;
  }

  function updateDims() {
    var spec = labelFor(VIEWPORTS, state.viewport) + " · " +
      labelFor(PAGES, state.page) + " · " + labelFor(THEMES, effectiveTheme());
    metaSpec.textContent = spec + " · " +
      (img.naturalWidth ? img.naturalWidth + " × " + img.naturalHeight : "— × —");
  }

  function effectiveTheme() {
    var proto = definitionById(CATALOG, state.prototype);
    var res = proto && resolve(proto, state.viewport, state.page, state.theme);
    return res ? res.theme : state.theme;
  }

  img.addEventListener("load", function () {
    canvas.classList.remove("loading", "error");
    stateMsg.hidden = true;
    updateDims();
  });

  img.addEventListener("error", function () {
    showError("Could not load " + (img.getAttribute("src") || "capture") +
      " — expected file is missing.");
  });

  /* ---------- prefetch (adjacent prototypes, same resolved selection) ---- */

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
        var n = normalize(target, state.viewport, state.page);
        var res = resolve(target, n.viewport, n.page, state.theme);
        ensurePrefetchLink(which).href = res ? res.src : "";
      });
    });
  }

  /* ---------- mutations ---------- */

  function setPrototype(id) {
    if (!definitionById(CATALOG, id)) return;
    state.prototype = id;
    render();
  }

  function stepPrototype(delta) {
    if (!CATALOG.length) return;
    var idx = protoIndex(state.prototype);
    if (idx === -1) return;
    var next = CATALOG[(idx + delta + CATALOG.length) % CATALOG.length];
    setPrototype(next.id);
  }

  function setViewport(viewport) {
    var proto = definitionById(CATALOG, state.prototype);
    if (!proto || viewportsFor(proto).indexOf(viewport) === -1) return;
    state.viewport = viewport;
    render();
  }

  function setPage(page) {
    var proto = definitionById(CATALOG, state.prototype);
    if (!proto || pagesFor(proto, state.viewport).indexOf(page) === -1) return;
    state.page = page;
    render();
  }

  function stepPage(delta) {
    var proto = definitionById(CATALOG, state.prototype);
    if (!proto) return;
    var avail = pagesFor(proto, state.viewport);
    if (!avail.length) return;
    var i = avail.indexOf(state.page);
    if (i === -1) return;
    setPage(avail[(i + delta + avail.length) % avail.length]);
  }

  function setTheme(theme) {
    /* Preferred theme is stored even when the current capture cannot show it. */
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
  onSeg("viewportSeg", "viewport", setViewport);
  onSeg("pageSeg", "page", setPage);
  onSeg("themeSeg", "theme", setTheme);
  onSeg("zoomSeg", "zoom", setZoom);
  onSeg("uiSeg", "ui", setUi);

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t === protoSelect && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      stepPrototype(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (t && typeof t.closest === "function" &&
        (t.closest("input, select, textarea, [contenteditable]") ||
        t.isContentEditable)) return;
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); stepPrototype(-1); break;
      case "ArrowDown": e.preventDefault(); stepPrototype(1); break;
      case "ArrowLeft": e.preventDefault(); stepPage(-1); break;
      case "ArrowRight": e.preventDefault(); stepPage(1); break;
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
    buildSeg("viewportSeg", VIEWPORTS, "viewport");
    buildSeg("pageSeg", PAGES, "page");
    buildSeg("themeSeg", THEMES, "theme");
    buildSeg("zoomSeg", ZOOMS.map(function (z) {
      return { id: z, label: ZOOM_LABELS[z] || z };
    }), "zoom");
    buildSeg("uiSeg", UI_MODES, "ui");

    CATALOG.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = String(p.number).padStart(2, "0") + " — " + p.label;
      protoSelect.appendChild(opt);
    });

    render();
  }
})();
