/*! demo-kit.js v0.1.0 — tiny step player for static, click-to-play demos.
 * Canonical copy: /workspace/portfolio/demo-kit/demo-kit.js. Vendor (copy) it; no npm, no deps.
 * No business logic, no network, no timers until the visitor presses Play.
 *
 *   const p = DemoKit.player({
 *     steps: [{ms: 1200, label: "Question"}, {ms: 900, gate: true}, ...],
 *     render(i, step, {instant}) {},   // draw step i (called in order, never skipped)
 *     reset() {},                      // back to the first screen
 *     live: el,                        // optional aria-live region; gets step.label
 *     onState(state) {}                // "idle" | "playing" | "paused" | "gated" | "done"
 *   });
 *   DemoKit.bind(p, {root, play, reset, step});  // buttons + keyboard
 *
 * Keyboard (focus inside root): Space or K = play/pause, R = reset, → = next step.
 * prefers-reduced-motion: Play renders every remaining step at once (instant: true).
 * A step with gate:true stops the timer after rendering; only p.resume() (a human
 * action) moves past it. No timer ever crosses a gate.
 */
(function (g) {
  "use strict";
  var RM = g.matchMedia ? g.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  function player(o) {
    var steps = o.steps || [], i = -1, timer = null, state = "idle", speed = o.speed || 1;
    function set(s) { state = s; if (o.onState) o.onState(s); if (api._sync) api._sync(s); }
    function say(t) { if (o.live && t) o.live.textContent = t; }
    function clear() { if (timer) { g.clearTimeout(timer); timer = null; } }
    function draw(instant) {
      i += 1; var s = steps[i];
      o.render(i, s, { instant: !!instant });
      say(s.label);
      return s;
    }
    function tick() {
      timer = null;
      if (i >= steps.length - 1) return set("done");
      var s = draw(false);
      if (s.gate) return set("gated");
      if (i >= steps.length - 1) return set("done");
      timer = g.setTimeout(tick, Math.max(0, (steps[i + 1].ms || 1000) / speed));
    }
    var api = {
      get state() { return state; }, get index() { return i; }, get length() { return steps.length; },
      reducedMotion: function () { return !!RM.matches || !!o.instant; },
      play: function () {
        if (state === "playing" || state === "gated") return;
        if (state === "done") api.reset();
        if (api.reducedMotion()) {
          set("playing");
          while (i < steps.length - 1) { var s = draw(true); if (s.gate) return set("gated"); }
          return set("done");
        }
        set("playing");
        var first = i < 0;
        timer = g.setTimeout(tick, first ? 0 : Math.max(0, (steps[i + 1].ms || 1000) / speed));
      },
      pause: function () { if (state !== "playing") return; clear(); set("paused"); },
      toggle: function () { state === "playing" ? api.pause() : api.play(); },
      step: function () {
        clear();
        if (state === "gated") return;
        if (i >= steps.length - 1) return set("done");
        var s = draw(true);
        set(s.gate ? "gated" : i >= steps.length - 1 ? "done" : "paused");
      },
      resume: function () { if (state !== "gated") return; set("paused"); api.play(); },
      reset: function () { clear(); i = -1; if (o.reset) o.reset(); say(o.resetLabel || ""); set("idle"); },
      setSpeed: function (x) { speed = x > 0 ? x : 1; }
    };
    return api;
  }

  function bind(p, b) {
    b = b || {};
    var playLabel = b.playLabel || "Play", pauseLabel = b.pauseLabel || "Pause", againLabel = b.againLabel || "Play again";
    function sync(s) {
      if (b.play) {
        var playing = s === "playing";
        b.play.setAttribute("aria-pressed", playing ? "true" : "false");
        var t = b.play.querySelector("[data-dk-label]") || b.play;
        t.textContent = playing ? pauseLabel : s === "done" ? againLabel : s === "paused" ? "Resume" : playLabel;
        b.play.disabled = s === "gated";
      }
      if (b.root) b.root.setAttribute("data-dk-state", s);
      if (b.onState) b.onState(s);
    }
    if (b.play) b.play.addEventListener("click", function () { p.toggle(); });
    if (b.reset) b.reset.addEventListener("click", function () { p.reset(); });
    if (b.step) b.step.addEventListener("click", function () { p.step(); });
    if (b.root) b.root.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      var k = e.key;
      if ((k === " " && tag !== "button") || k === "k" || k === "K") { e.preventDefault(); p.toggle(); }
      else if (k === "r" || k === "R") { e.preventDefault(); p.reset(); }
      else if (k === "ArrowRight") { e.preventDefault(); p.step(); }
    });
    p._sync = sync;
    return sync;
  }

  g.DemoKit = { version: "0.1.0", player: player, bind: bind };
})(window);
