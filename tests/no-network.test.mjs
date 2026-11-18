// No-network guard: serve the site locally, drive every interaction, fail on ANY
// non-local request, CSP violation, or page error. Also checks click-to-play,
// keyboard control, aria-live and reduced motion. Run: npm test (in tests/).
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "./serve.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const { url, close } = await serve(ROOT);
const origin = new URL(url).origin;
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const external = [], errors = [], csp = [];
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };

async function session(opts, name, fn) {
  const ctx = await browser.newContext(opts);
  await ctx.route("**/*", route => {
    const u = route.request().url();
    if (u.startsWith(origin + "/") || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    external.push(`${name}: ${route.request().method()} ${u}`); return route.abort("blockedbyclient");
  });
  ctx.on("request", r => { const u = r.url(); if (!(u.startsWith(origin + "/") || u.startsWith("data:") || u.startsWith("blob:"))) external.push(`${name} (event): ${u}`); });
  ctx.on("websocket", ws => external.push(`${name} websocket: ${ws.url()}`));
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(`${name}: ${e.message}`));
  page.on("console", m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(`${name}: ${m.text()}`); });
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", e => console.error("Refused to (CSP) " + e.violatedDirective + " " + e.blockedURI)));
  await page.goto(url, { waitUntil: "networkidle" });
  await fn(page);
  await ctx.close();
}
const state = p => p.getAttribute("#replay", "data-dk-state");

async function everything(page, name) {
  // No autoplay: idle after 2 s, nothing announced, static result visible.
  await page.waitForTimeout(2000);
  ok(await state(page) === "idle", `${name}: replay must not autoplay`);
  ok((await page.textContent("#rp-live")) === "", `${name}: no announcement before Play`);
  ok(/Result:/.test(await page.textContent("#rp-sum")), `${name}: static result on first screen`);
  // Hero action plays the replay (click-to-play).
  await page.click("#hero-go");
  await page.waitForFunction(() => document.querySelector("#replay").dataset.dkState === "done", null, { timeout: 30000 });
  ok((await page.locator("#rp-chips li").count()) === 10, `${name}: 10 links landed`);
  ok(/Done\. Of 10 cited links, 5 to review sites/.test(await page.textContent("#rp-live")), `${name}: aria-live final summary`);
  // Buttons: reset, play, pause, resume, step.
  await page.click("#rp-reset"); ok(await state(page) === "idle", `${name}: reset`);
  await page.click("#rp-play"); await page.waitForTimeout(1500);
  await page.click("#rp-play"); ok(await state(page) === "paused", `${name}: pause`);
  const n = await page.locator("#rp-ans li").count(); await page.waitForTimeout(1500);
  ok((await page.locator("#rp-ans li").count()) === n, `${name}: paused means no progress`);
  await page.click("#rp-step"); ok((await page.locator("#rp-ans li, #rp-chips li").count()) > n, `${name}: next step`);
  // Keyboard: R reset, ArrowRight step, Space toggles (focus inside the replay).
  await page.focus("#rp-step"); await page.keyboard.press("r"); ok(await state(page) === "idle", `${name}: R resets`);
  await page.keyboard.press("ArrowRight"); ok(await state(page) === "paused", `${name}: → steps`);
  await page.focus("#rp-q").catch(() => {}); await page.locator("#replay").evaluate(el => el.querySelector(".rp-head").setAttribute("tabindex", "-1"));
  await page.focus(".rp-head"); await page.keyboard.press(" "); ok(await state(page) === "playing", `${name}: Space plays`);
  await page.keyboard.press("k"); ok(await state(page) === "paused", `${name}: K pauses`);
  // Every other control on the page.
  for (const b of await page.locator("#cst-chips button").all()) { await b.click(); }
  ok(/publish no AI-agent rules/.test(await page.textContent("#cst-out")), `${name}: store-type sentence`);
  await page.click("#st-btn"); ok(await page.isVisible("#st-rows"), `${name}: store breakdown opens`);
  for (const b of await page.locator(".rowbtn:visible").all()) { await b.click(); }
  for (const s of await page.locator("details summary").all()) { await s.click(); }
  for (const a of await page.locator('.inav a').all()) { await a.click(); }
  if (await page.isVisible("#fbtn")) await page.click("#fbtn");
  await page.waitForTimeout(300);
}

await session({ viewport: { width: 1440, height: 900 } }, "desktop", p => everything(p, "desktop"));
await session({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "mobile", p => everything(p, "mobile"));
await session({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" }, "reduced-motion", async page => {
  await page.click("#rp-play");
  ok(await state(page) === "done", "reduced motion: Play renders every step at once");
  ok((await page.locator("#rp-chips li").count()) === 10, "reduced motion: all links shown");
});
// CSP is present and limits connections to this origin.
await session({ viewport: { width: 800, height: 600 } }, "csp", async page => {
  const c = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', "content");
  ok(/connect-src 'self'/.test(c || ""), "CSP meta has connect-src 'self'");
  const blocked = await page.evaluate(() => fetch("https://example.com/").then(() => "fetched", () => "blocked"));
  ok(blocked === "blocked", "CSP blocks a cross-origin fetch");
  await page.waitForTimeout(500);
  ok(csp.some(x => /connect-src https:\/\/example\.com/.test(x)), "CSP violation was reported for the probe");
  csp.length = 0; external.length = 0; // the probe above is expected to be refused
});

await browser.close(); close();
if (external.length) console.error("NON-LOCAL REQUESTS:\n  " + external.join("\n  "));
if (csp.length) console.error("CSP VIOLATIONS:\n  " + csp.join("\n  "));
if (errors.length) console.error("PAGE ERRORS:\n  " + errors.join("\n  "));
assert.equal(external.length, 0, "no non-local requests");
assert.equal(csp.length, 0, "no CSP violations");
assert.equal(errors.length, 0, "no page errors");
console.log(`no-network: PASS · ${checks} checks · 0 non-local requests · 0 CSP violations · 0 page errors (desktop, mobile, reduced-motion)`);
