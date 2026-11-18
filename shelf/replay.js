/* Agent Shelf replay + "Check a store type". Page logic only; the player is demo-kit.js.
 * Reads shelf/replay-week2.json (same origin, static) and window.AAI (data.js).
 * No model, no third-party requests. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var KIND = { review: "Review site", brand: "Brand's own site", store: "Store", other: "Other site" };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; }); };

  /* ---------- Check a store type (Access aggregates only) ---------- */
  (function storeType() {
    var D = window.AAI, box = $("cst-chips"), out = $("cst-out");
    if (!D || !box) return;
    var T = D.totals, opts = [{ category: "All top retailers", all: true }].concat(D.categories);
    var day = new Date(D.run_date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    var pc = function (a, b) { return Math.round(100 * a / b) + "%"; };
    var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
    box.innerHTML = opts.map(function (c, i) {
      return '<button class="chip" type="button" aria-pressed="false" data-cst="' + i + '">' + esc(c.all ? c.category : cap(c.category)) + "</button>";
    }).join("");
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cst]"); if (!b) return;
      box.querySelectorAll("[data-cst]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var c = opts[+b.dataset.cst], d = c.all ? T : c, name = c.all ? "Across all " + T.n + " top US retailers" : cap(c.category) + " (" + c.n + " sites)";
      var ref = d.refused_suppressed ? "fewer than 5 refused, so the refusal rate is not compared" : d.refused + " of " + d.n + " (" + pc(d.refused, d.n) + ") refused our labeled agent";
      out.innerHTML = "<b>" + esc(name) + ":</b> " + d.no_rules + " of " + d.n + " (" + pc(d.no_rules, d.n) + ") publish no AI-agent rules, and " + ref + "." +
        (c.small_sample ? ' <span class="mut">Small sample; directional only.</span>' : "") +
        ' <span class="mut">Category totals only, checked ' + day + ". No site names.</span>";
    });
  })();

  /* ---------- Replay one shopping question ---------- */
  var root = $("replay");
  if (!root || !window.DemoKit) return;
  var R = null, P = null;
  var ans = $("rp-ans"), chips = $("rp-chips"), count = $("rp-count"), sum = $("rp-sum"), tally = $("rp-tally"), q = $("rp-qbox");

  function summary(links) {
    var n = { review: 0, brand: 0, store: 0, other: 0 };
    links.forEach(function (l) { n[l.kind] += 1; });
    var parts = [];
    if (n.review) parts.push(n.review + " to review sites");
    if (n.brand) parts.push(n.brand + " to brands\u2019 own sites");
    if (n.store) parts.push(n.store + " to store" + (n.store === 1 ? "" : "s"));
    if (n.other) parts.push(n.other + " elsewhere");
    var last = parts.pop();
    return { n: n, text: (parts.length ? parts.join(", ") + " and " + last : last) };
  }
  function drawTally(shown) {
    var s = summary(shown), tot = R.links.length;
    tally.innerHTML = ["review", "brand", "store", "other"].filter(function (k) { return s.n[k]; }).map(function (k) {
      return '<span class="k-' + k + '" style="width:' + (100 * s.n[k] / tot) + '%" title="' + KIND[k] + ": " + s.n[k] + '"></span>';
    }).join("");
    count.textContent = shown.length + " of " + tot;
  }
  function staticResult() {
    // Useful first screen: the recorded result, before any motion.
    var s = summary(R.links);
    ans.innerHTML = '<li class="rp-ph">Press <b>Play the answer</b> to watch it arrive line by line and each cited link land, labeled by site type.</li>';
    chips.innerHTML = "";
    drawTally(R.links);
    count.textContent = R.links.length + " links";
    sum.innerHTML = "<b>Result:</b> of " + R.links.length + " cited links, " + esc(s.text) + ".";
    q.classList.remove("on");
  }
  function chip(l) {
    var li = document.createElement("li");
    li.className = "rp-chip k-" + l.kind;
    li.innerHTML = '<span class="n">' + l.n + '</span><span class="sw" aria-hidden="true"></span>' + esc(l.label);
    return li;
  }
  function build(data) {
    R = data;
    $("rp-q").textContent = R.question;
    var steps = [{ ms: 0, label: "Question sent: " + R.question, act: "q" },
                 { ms: 1100, label: "Answer: " + R.intro, act: "intro" }];
    R.steps.forEach(function (st, li) {
      steps.push({ ms: 1500, label: st.text, act: "line", li: li });
      st.links.forEach(function (k) {
        var l = R.links[k];
        steps.push({ ms: 520, label: "Link " + l.n + " of " + R.links.length + ": " + l.label, act: "link", k: k });
      });
    });
    steps.push({ ms: 1300, label: "", act: "done" });
    var shown = [];
    P = DemoKit.player({
      steps: steps,
      live: $("rp-live"),
      reset: function () { shown = []; staticResult(); },
      render: function (i, s, o) {
        var anim = o.instant ? "" : " in";
        if (s.act === "q") { ans.innerHTML = ""; chips.innerHTML = ""; shown = []; drawTally(shown); sum.textContent = ""; q.classList.add("on"); }
        else if (s.act === "intro") { var p = document.createElement("li"); p.className = "rp-intro" + anim; p.textContent = R.intro; ans.appendChild(p); }
        else if (s.act === "line") { var li = document.createElement("li"); li.className = "rp-line" + anim; li.innerHTML = esc(R.steps[s.li].text) + ' <span class="refs" id="rp-r' + s.li + '"></span>'; ans.appendChild(li); }
        else if (s.act === "link") {
          var l = R.links[s.k], c = chip(l); if (!o.instant) c.classList.add("in");
          chips.appendChild(c); shown.push(l); drawTally(shown);
          var line = R.steps.findIndex(function (st) { return st.links.indexOf(s.k) >= 0; }), r = $("rp-r" + line);
          if (r) { var m = document.createElement("sup"); m.className = "k-" + l.kind; m.textContent = l.n; m.title = l.label; r.appendChild(m); }
        }
        else if (s.act === "done") { var t = summary(R.links); sum.innerHTML = "<b>Result:</b> of " + R.links.length + " cited links, " + esc(t.text) + "."; s.label = "Done. Of " + R.links.length + " cited links, " + t.text + "."; $("rp-live").textContent = s.label; }
      }
    });
    DemoKit.bind(P, { root: root, play: $("rp-play"), reset: $("rp-reset"), step: $("rp-step"), playLabel: "Play the answer", pauseLabel: "Pause", againLabel: "Play again" });
    staticResult();
    root.setAttribute("data-dk-state", "idle");
  }
  var go = $("hero-go");
  if (go) go.addEventListener("click", function (e) {
    if (!P) return;
    e.preventDefault();
    root.scrollIntoView({ behavior: P.reducedMotion() ? "auto" : "smooth", block: "start" });
    $("rp-play").focus({ preventScroll: true });
    P.reset(); P.play();
  });
  fetch("shelf/replay-week2.json", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(build).catch(function () {
    $("rp-sum").textContent = "The replay could not load. The weekly figures below do not depend on it.";
  });
})();
(function () {
  var b = document.getElementById("st-btn"), rows = document.getElementById("st-rows");
  if (!b || !rows) return;
  b.addEventListener("click", function () {
    var open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", open ? "true" : "false");
    rows.hidden = !open;
  });
})();
