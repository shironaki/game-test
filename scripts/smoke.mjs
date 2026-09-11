// Headless smoke test: mounts the real built bundle in jsdom with a stubbed
// Canvas 2D context and reports any error that would blank the page.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawHtml = fs.readFileSync(path.join(__dirname, "../dist/index.html"), "utf8");
// jsdom cannot execute <script type="module">; the single-file build inlines
// the whole bundle, so convert it to a classic script before parsing.
const inlineMatch = rawHtml.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
if (!inlineMatch) throw new Error("Inlined bundle script not found in dist/index.html");
const bundleCode = inlineMatch[1];
// Module scripts defer until parsing finishes; emulate by stripping the inline
// script and evaluating it after the DOM is ready.
const html = rawHtml.replace(inlineMatch[0], "");

const errors = [];
const consoleErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (err) => errors.push("jsdomError: " + (err.stack || err.message)));
virtualConsole.on("error", (...args) => consoleErrors.push("console.error: " + args.join(" ")));

let frameCount = 0;

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  virtualConsole,
  pretendToBeVisual: true,
  beforeParse(window) {
    // rAF: run a limited number of frames manually after load.
    const rafCbs = new Map();
    let rafId = 0;
    window.requestAnimationFrame = (cb) => {
      rafId += 1;
      rafCbs.set(rafId, cb);
      return rafId;
    };
    window.cancelAnimationFrame = (id) => rafCbs.delete(id);
    window.__runFrames = (n) => {
      for (let i = 0; i < n; i += 1) {
        frameCount += 1;
        const cbs = [...rafCbs.values()];
        rafCbs.clear();
        const now = performanceNow();
        for (const cb of cbs) cb(now);
      }
    };
    let t = 0;
    function performanceNow() {
      t += 16.7;
      return t;
    }
    Object.defineProperty(window, "performance", { value: { now: performanceNow }, configurable: true });
    window.devicePixelRatio = 1;
    window.ResizeObserver = class {
      constructor(cb) { this.cb = cb; }
      observe() {
        // Fire once asynchronously like the real RO.
        Promise.resolve().then(() =>
          this.cb([{ contentRect: { width: 1180, height: 720 } }]),
        );
      }
      unobserve() {}
      disconnect() {}
    };

    // Stub 2D canvas context: every method is a no-op, props are writable.
    function makeGradient() {
      return { addColorStop() {} };
    }
    const ctx2d = new Proxy(
      {
        canvas: null,
        createLinearGradient: makeGradient,
        createRadialGradient: makeGradient,
        createPattern: () => ({}),
        measureText: () => ({ width: 10 }),
        getImageData: () => ({ data: [] }),
        setTransform() {},
        save() {},
        restore() {},
        scale() {},
        translate() {},
        rotate() {},
        clearRect() {},
        fillRect() {},
        strokeRect() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        fill() {},
        stroke() {},
        fillText() {},
      },
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          return undefined;
        },
        set() {
          return true;
        },
      },
    );
    window.HTMLCanvasElement.prototype.getContext = function getContext() {
      ctx2d.canvas = this;
      // simulate real layout size
      Object.defineProperty(this, "getBoundingClientRect", {
        value: () => ({ width: 1180, height: 720, top: 0, left: 0 }),
        configurable: true,
      });
      return ctx2d;
    };
  },
});

const { window } = dom;

window.addEventListener("error", (event) =>
  errors.push("window.error: " + (event.error?.stack || event.message)),
);

await new Promise((resolve) => {
  if (window.document.readyState === "complete") resolve();
  else window.addEventListener("load", resolve);
  setTimeout(resolve, 3000);
});
await new Promise((r) => setTimeout(r, 100));

// Now run the deferred inlined bundle.
try {
  window.eval(bundleCode);
} catch (err) {
  errors.push("bundle eval: " + (err.stack || err.message));
}
await new Promise((r) => setTimeout(r, 100));

window.__runFrames(120);
await new Promise((r) => setTimeout(r, 50));

// Simulate pressing "D" to start the game, run more frames.
const keydown = new window.KeyboardEvent("keydown", { code: "KeyD", bubbles: true });
window.dispatchEvent(keydown);
window.__runFrames(300);
await new Promise((r) => setTimeout(r, 50));

const root = window.document.getElementById("root");
const rootText = root ? root.textContent.replace(/\s+/g, " ").trim().slice(0, 300) : "<NO ROOT>";
const hasHeader = rootText.includes("BROWSER PROTOTYPE");
const hasCanvas = !!window.document.querySelector("canvas");

console.log("frames rendered:", frameCount);
console.log("canvas present:", hasCanvas);
console.log("header rendered:", hasHeader);
console.log("root text sample:", rootText.slice(0, 200));
console.log("errors:", errors.length, consoleErrors.length);
for (const e of errors) console.log("\n" + e + "\n");
for (const e of consoleErrors) console.log("\n" + e + "\n");

if (!hasHeader || !hasCanvas || errors.length || consoleErrors.length) {
  process.exit(1);
}
console.log("\nSMOKE TEST PASSED");
