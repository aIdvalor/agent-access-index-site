// Screenshots + replay loop for review. Writes to OUT (default /workspace/portfolio/ux-interactive-shots).
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { serve } from "./serve.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT || "/workspace/portfolio/ux-interactive-shots";
mkdirSync(OUT, { recursive: true });
const { url, close } = await serve(ROOT);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--hide-scrollbars"] });
const block = ctx => ctx.route("**/*", r => r.request().url().startsWith(url) ? r.continue() : r.abort());
async function page(opts) { const c = await b.newContext({ deviceScaleFactor: 2, ...opts }); await block(c); const p = await c.newPage(); await p.goto(url, { waitUntil: "networkidle" }); return [c, p]; }
const toReplay = p => p.evaluate(() => { document.getElementById("replay").scrollIntoView({ block: "start" }); });

let [c, p] = await page({ viewport: { width: 1440, height: 900 } });
await p.screenshot({ path: `${OUT}/index-v1-desktop-first.png` });
await p.click("#hero-go"); await p.waitForTimeout(7600);
await p.click("#rp-play"); await toReplay(p); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/index-v1-desktop-mid-replay.png` });
await p.click("#rp-play"); await p.waitForFunction(() => document.querySelector("#replay").dataset.dkState === "done", null, { timeout: 30000 });
await p.click("#st-btn");
await p.locator("#shelf").evaluate(el => el.scrollIntoView({ block: "start" }));
await p.addStyleTag({ content: ".inav{position:static}" });
const box = await p.evaluate(() => { const a = document.getElementById("shelf").getBoundingClientRect(), z = document.getElementById("d-shelf-raw").getBoundingClientRect(); return { y: a.top + scrollY - 12, h: z.bottom - a.top + 24 }; });
await p.screenshot({ path: `${OUT}/index-v1-desktop-shelf.png`, fullPage: true, clip: { x: 220, y: box.y, width: 1000, height: box.h } });
await c.close();

[c, p] = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await p.screenshot({ path: `${OUT}/index-v1-mobile-first.png` });
await p.click("#hero-go"); await p.waitForTimeout(8200);
await p.click("#rp-play"); await toReplay(p); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/index-v1-mobile-mid-replay.png` });
await p.click("#rp-play"); await p.waitForFunction(() => document.querySelector("#replay").dataset.dkState === "done", null, { timeout: 30000 });
await p.locator("#shelf").evaluate(el => el.scrollIntoView({ block: "start" }));
await p.screenshot({ path: `${OUT}/index-v1-mobile-shelf.png`, fullPage: false });
await c.close();

// Replay loop: one frame per replay step (deterministic), held for that step's timing, then ffmpeg -> MP4.
const R = JSON.parse((await import("node:fs")).readFileSync(join(ROOT, "shelf/replay-week2.json"), "utf8"));
const holds = [0.8, 0.9];  // idle first screen, question sent
R.steps.forEach(st => { holds.push(1.1); st.links.forEach(() => holds.push(0.4)); });
holds.push(2.5);           // final summary
const fdir = "/tmp/aai-frames"; mkdirSync(fdir, { recursive: true });
const vc = await b.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 }); await block(vc);
const vp = await vc.newPage(); await vp.goto(url, { waitUntil: "networkidle" });
await vp.addStyleTag({ content: ".inav{display:none}" });
await vp.evaluate(() => { const r = document.getElementById("replay"); window.scrollTo(0, r.getBoundingClientRect().top + scrollY - 16); });
const list = [];
for (let i = 0; i < holds.length; i++) {
  if (i > 0) await vp.click("#rp-step");
  await vp.mouse.move(0, 0);
  const f = `${fdir}/f${String(i).padStart(3, "0")}.png`;
  await vp.locator("#replay").screenshot({ path: f });
  list.push(`file '${f}'`, `duration ${holds[i]}`);
}
list.push(list[list.length - 2]);
(await import("node:fs")).writeFileSync(`${fdir}/list.txt`, list.join("\n") + "\n");
await vc.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${fdir}/list.txt`, "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2:color=white,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "22", "-movflags", "+faststart", "-an", `${OUT}/index-v1-replay-loop.mp4`]);
await b.close(); close();
console.log("shots written to", OUT, "· loop", holds.reduce((a, x) => a + x, 0).toFixed(1) + "s");
