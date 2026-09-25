/* Western Tally — Prototype Library viewer.
   Classic script (no modules) so index.html also works from file://.
   State: { prototype, page, theme, zoom }
   - theme is a *preference*: on prototypes without a dark capture the light
     image is shown temporarily while the preference is kept.
   - Restored from query params, then localStorage, then defaults. */

(function () {
  "use strict";

  var CATALOG = window.PROTOTYPE_CATALOG || [];
  var PAGES = ["home", "map", "entry", "map-full"];
  var PAGE_LABEL = { home: "Home", map: "Map", entry: "Entry", "map-full": "Full map" };
  var THEMES = ["light", "dark"];
  var ZOOMS = ["fit", "full"];
  var DEFAULTS = { prototype: "p00", page: "home", theme: "light", zoom: "fit" };
  var LS_KEY = "western-tally-viewer";

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

  function protoById(id) {
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].id === id) return CATALOG[i];
    }
    return null;
  }

  function protoIndex(id) {
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].id === id) return i;
    }
    return -1;
  }

  function pagesFor(proto) {
    return PAGES.filter(function (p) { return !!proto.captures.desktop[p]; });
  }

  /* Effective capture for a proto/page + preferred theme.
     Returns { src, theme } or null if the page does not exist. */
  function resolve(proto, page, theme) {
    var cap = proto.captures.desktop[page];
    if (!cap) return null;
    if (cap[theme]) return { src: cap[theme], theme: theme };
    if (cap.light) return { src: cap.light, theme: "light" };
    return { src: cap.dark, theme: "dark" };
  }

  /* ---------- state ---------- */

  function validState(raw) {
    if (!raw || typeof raw !== "object") return null;
    var s = {};
    if (protoById(raw.prototype)) s.prototype = raw.prototype;
    if (PAGES.indexOf(raw.page) !== -1) s.page = raw.page;
    if (THEMES.indexOf(raw.theme) !== -1) s.theme = raw.theme;
    if (ZOOMS.indexOf(raw.zoom) !== -1) s.zoom = raw.zoom;
    return s;
  }

  function loadState() {
    var s = {
      prototype: DEFAULTS.prototype,
      page: DEFAULTS.page,
      theme: DEFAULTS.theme,
      zoom: DEFAULTS.zoom
    };
    try {
      var saved = validState(JSON.parse(localStorage.getItem(LS_KEY) || "null"));
      if (saved) for (var k in saved) s[k] = saved[k];
    } catch (e) { /* storage unavailable or corrupt — keep defaults */ }
    try {
      var q = new URLSearchParams(window.location.search);
      var fromUrl = validState({
        prototype: q.get("prototype"),
        page: q.get("page"),
        theme: q.get("theme"),
        zoom: q.get("zoom")
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
      q.set("page", state.page);
      q.set("theme", state.theme);
      q.set("zoom", state.zoom);
      var url = window.location.pathname + "?" + q.toString();
      history.replaceState(null, "", url);
    } catch (e) { /* file:// or older browser — skip */ }
  }

  /* Normalize state against the chosen prototype: page must exist. */
  function normalize() {
    var proto = protoById(state.prototype);
    var avail = pagesFor(proto);
    if (avail.indexOf(state.page) === -1) {
      state.page = avail.indexOf("map") !== -1 ? "map" : avail[0];
    }
  }

  /* ---------- rendering ---------- */

  var currentSrc = null;

  function setLoading() {
    canvas.classList.add("loading");
    canvas.classList.remove("error");
    stateMsg.hidden = false;
    stateMsg.textContent = "Loading\u2026";
  }

  function render() {
    normalize();
    var proto = protoById(state.prototype);
    var avail = pagesFor(proto);
    var res = resolve(proto, state.page, state.theme);

    /* image */
    if (res.src !== currentSrc) {
      currentSrc = res.src;
      setLoading();
      img.src = res.src;
    } else {
      canvas.classList.remove("loading", "error");
      stateMsg.hidden = true;
    }
    img.alt = proto.label + " — " + PAGE_LABEL[state.page] + " page, " +
      res.theme + " theme, desktop capture";

    /* segmented controls */
    var pageBtns = document.querySelectorAll("#pageSeg button");
    pageBtns.forEach(function (b) {
      var p = b.getAttribute("data-page");
      b.setAttribute("aria-pressed", String(p === state.page));
      b.disabled = avail.indexOf(p) === -1;
    });
    var themeBtns = document.querySelectorAll("#themeSeg button");
    themeBtns.forEach(function (b) {
      var t = b.getAttribute("data-theme");
      b.setAttribute("aria-pressed", String(t === res.theme));
      b.disabled = !proto.captures.desktop[state.page][t];
    });
    var zoomBtns = document.querySelectorAll("#zoomSeg button");
    zoomBtns.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-zoom") === state.zoom));
    });

    /* select */
    protoSelect.value = state.prototype;

    /* metadata strip */
    metaNum.textContent = String(proto.number).padStart(2, "0") + " / 14";
    metaLabel.textContent = proto.label;
    metaDir.textContent = proto.direction;
    metaSrc.textContent = proto.source;
    updateDims();

    /* notice + live status */
    if (res.theme !== state.theme) {
      notice.hidden = false;
      notice.textContent = (state.theme === "dark" ? "Dark" : "Light") +
        " unavailable — showing the " + res.theme + " capture";
    } else {
      notice.hidden = true;
      notice.textContent = "";
    }
    srStatus.textContent = proto.label + " — " + PAGE_LABEL[state.page] +
      " — " + res.theme + " — desktop";

    /* open original */
    openOriginal.href = res.src;

    /* zoom */
    canvas.classList.toggle("zoom-fit", state.zoom === "fit");
    canvas.classList.toggle("zoom-full", state.zoom === "full");

    persist();
    schedulePrefetch();
  }

  function updateDims() {
    if (img.naturalWidth) {
      metaSpec.textContent = "Desktop · " + PAGE_LABEL[state.page] + " · " +
        capitalize(effectiveTheme()) + " · " + img.naturalWidth + " × " + img.naturalHeight;
    } else {
      metaSpec.textContent = "Desktop · " + PAGE_LABEL[state.page] + " · " +
        capitalize(effectiveTheme()) + " · — × —";
    }
  }

  function effectiveTheme() {
    var proto = protoById(state.prototype);
    var res = resolve(proto, state.page, state.theme);
    return res ? res.theme : state.theme;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  img.addEventListener("load", function () {
    canvas.classList.remove("loading", "error");
    stateMsg.hidden = true;
    updateDims();
  });

  img.addEventListener("error", function () {
    canvas.classList.remove("loading");
    canvas.classList.add("error");
    stateMsg.hidden = false;
    stateMsg.textContent = "Could not load " + (img.getAttribute("src") || "capture") +
      " — expected file is missing.";
  });

  /* ---------- prefetch (prev/next prototype, same page+resolved theme) ---- */

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
    var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 400); };
    idle(function () {
      var idx = protoIndex(state.prototype);
      ["prev", "next"].forEach(function (which, i) {
        var target = CATALOG[(idx + (i === 0 ? -1 : 1) + CATALOG.length) % CATALOG.length];
        var avail = pagesFor(target);
        var page = avail.indexOf(state.page) !== -1 ? state.page :
          (avail.indexOf("map") !== -1 ? "map" : avail[0]);
        var res = resolve(target, page, state.theme);
        ensurePrefetchLink(which).href = res ? res.src : "";
      });
    });
  }

  /* ---------- mutations ---------- */

  function setPrototype(id) {
    if (!protoById(id)) return;
    state.prototype = id;
    render();
  }

  function stepPrototype(delta) {
    var idx = protoIndex(state.prototype);
    var next = CATALOG[(idx + delta + CATALOG.length) % CATALOG.length];
    setPrototype(next.id);
  }

  function setPage(page) {
    var proto = protoById(state.prototype);
    if (pagesFor(proto).indexOf(page) === -1) return;
    state.page = page;
    render();
  }

  function stepPage(delta) {
    var avail = pagesFor(protoById(state.prototype));
    var i = avail.indexOf(state.page);
    var next = avail[(i + delta + avail.length) % avail.length];
    setPage(next);
  }

  function setTheme(theme) {
    /* Preferred theme is stored even when the current page cannot show it. */
    if (THEMES.indexOf(theme) === -1) return;
    state.theme = theme;
    render();
  }

  function setZoom(zoom) {
    if (ZOOMS.indexOf(zoom) === -1) return;
    state.zoom = zoom;
    render();
  }

  /* ---------- events ---------- */

  $("prevProto").addEventListener("click", function () { stepPrototype(-1); });
  $("nextProto").addEventListener("click", function () { stepPrototype(1); });
  protoSelect.addEventListener("change", function () { setPrototype(protoSelect.value); });

  document.querySelectorAll("#pageSeg button").forEach(function (b) {
    b.addEventListener("click", function () { setPage(b.getAttribute("data-page")); });
  });
  document.querySelectorAll("#themeSeg button").forEach(function (b) {
    b.addEventListener("click", function () { setTheme(b.getAttribute("data-theme")); });
  });
  document.querySelectorAll("#zoomSeg button").forEach(function (b) {
    b.addEventListener("click", function () { setZoom(b.getAttribute("data-zoom")); });
  });

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t && typeof t.closest === "function" &&
        (t.closest("input, select, textarea, [contenteditable]") ||
        t.isContentEditable)) return;
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); stepPrototype(-1); break;
      case "ArrowDown": e.preventDefault(); stepPrototype(1); break;
      case "ArrowLeft": e.preventDefault(); stepPage(-1); break;
      case "ArrowRight": e.preventDefault(); stepPage(1); break;
      case "t": case "T":
        setTheme(state.theme === "light" ? "dark" : "light"); break;
      case "z": case "Z":
        setZoom(state.zoom === "fit" ? "full" : "fit"); break;
      case "o": case "O":
        window.open(openOriginal.href, "_blank", "noopener"); break;
    }
  });

  /* ---------- init ---------- */

  CATALOG.forEach(function (p) {
    var opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = String(p.number).padStart(2, "0") + " — " + p.label;
    protoSelect.appendChild(opt);
  });

  render();
})();
