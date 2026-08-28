// visualcursor.js
//
// Makes the agent's actions visible when running headed.
//
// Playwright drives the real mouse, but the pointer itself is invisible
// in a screenshot or a recording, so a watcher cannot tell what the
// agent actually touched. This installs a small overlay that draws:
//
//   - a cursor dot that follows every click position
//   - an expanding ripple at each click
//   - a brief outline around the element that was acted on
//
// The overlay is injected through addInitScript, so it survives every
// navigation and SPA route change without needing to be re-installed.
//
// It is purely decorative: pointer-events are disabled on every node it
// creates, it lives in its own container, and it never participates in
// hit-testing, so it cannot intercept a click meant for the page.
//
// Enable with VISUAL_CLICKS=true (default when not headless).
//
// ============================================================

const OVERLAY_SCRIPT = () => {

  // Guard against double installation on same-document navigations.
  if (window.__qaVisualCursorInstalled) return;
  window.__qaVisualCursorInstalled = true;

  const CURSOR_SIZE = 22;
  const RIPPLE_MS = 650;
  const OUTLINE_MS = 900;

  let root = null;
  let cursor = null;

  const ensureRoot = () => {
    if (root && root.isConnected) return root;
    if (!document.body) return null;

    root = document.createElement("div");
    root.id = "__qa-visual-cursor-root";
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "pointer-events:none",
      "overflow:visible",
    ].join(";");

    const style = document.createElement("style");
    style.textContent = `
      @keyframes __qaRipple {
        0%   { transform: translate(-50%, -50%) scale(0.25); opacity: 0.9; }
        100% { transform: translate(-50%, -50%) scale(1);    opacity: 0;   }
      }
      @keyframes __qaPulse {
        0%   { transform: translate(-50%, -50%) scale(1);   }
        50%  { transform: translate(-50%, -50%) scale(0.7); }
        100% { transform: translate(-50%, -50%) scale(1);   }
      }
      @keyframes __qaOutlineFade {
        0%   { opacity: 1; }
        70%  { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    root.appendChild(style);

    cursor = document.createElement("div");
    cursor.style.cssText = [
      "position:fixed",
      "left:-100px",
      "top:-100px",
      `width:${CURSOR_SIZE}px`,
      `height:${CURSOR_SIZE}px`,
      "margin:0",
      "border-radius:50%",
      "border:2px solid rgba(255,64,96,0.95)",
      "background:rgba(255,64,96,0.28)",
      "box-shadow:0 0 0 2px rgba(255,255,255,0.65), 0 2px 6px rgba(0,0,0,0.35)",
      "transform:translate(-50%, -50%)",
      "transition:left 90ms linear, top 90ms linear",
      "pointer-events:none",
    ].join(";");
    root.appendChild(cursor);

    document.documentElement.appendChild(root);
    return root;
  };

  const showClick = (x, y) => {
    if (!ensureRoot()) return;

    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    cursor.style.animation = `__qaPulse 260ms ease-out`;
    setTimeout(() => {
      if (cursor) cursor.style.animation = "";
    }, 280);

    const ripple = document.createElement("div");
    ripple.style.cssText = [
      "position:fixed",
      `left:${x}px`,
      `top:${y}px`,
      "width:64px",
      "height:64px",
      "border-radius:50%",
      "border:3px solid rgba(255,64,96,0.85)",
      "pointer-events:none",
      `animation:__qaRipple ${RIPPLE_MS}ms ease-out forwards`,
    ].join(";");
    root.appendChild(ripple);
    setTimeout(() => ripple.remove(), RIPPLE_MS + 60);
  };

  const outlineRect = (rect) => {
    if (!ensureRoot() || !rect || rect.width === 0) return;

    const box = document.createElement("div");
    box.style.cssText = [
      "position:fixed",
      `left:${rect.left - 3}px`,
      `top:${rect.top - 3}px`,
      `width:${rect.width + 6}px`,
      `height:${rect.height + 6}px`,
      "border:2px solid rgba(255,64,96,0.9)",
      "border-radius:4px",
      "background:rgba(255,64,96,0.10)",
      "pointer-events:none",
      `animation:__qaOutlineFade ${OUTLINE_MS}ms ease-out forwards`,
    ].join(";");
    root.appendChild(box);
    setTimeout(() => box.remove(), OUTLINE_MS + 60);
  };

  // Real user-style clicks dispatched by Playwright land here.
  document.addEventListener(
    "mousedown",
    (event) => showClick(event.clientX, event.clientY),
    true
  );

  // Called directly by the agent for actions that produce no mouse
  // event, such as selecting an <option> on a native <select>.
  window.__qaShowClick = showClick;

  window.__qaHighlight = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    outlineRect(rect);
    showClick(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return true;
  };

  // Highlight an arbitrary viewport-relative box, for elements that
  // have no data-agent-id (dropdown options, address suggestions).
  window.__qaShowBox = (x, y, w, h) => {
    outlineRect({ left: x, top: y, width: w, height: h });
    showClick(x + w / 2, y + h / 2);
  };
};


/**
 * Installs the overlay on every page and frame of a browser context.
 */
export async function installClickVisualizer(context) {
  await context.addInitScript(OVERLAY_SCRIPT);
}


/**
 * Highlights the element carrying a given data-agent-id.
 *
 * Safe to call at any time: it never throws, so a decorative failure
 * can never break a scenario.
 */
export async function highlightAgentElement(page, agentId) {
  if (!agentId) return;

  try {
    await page.evaluate(
      (id) => window.__qaHighlight?.(`[data-agent-id="${id}"]`),
      agentId
    );
  } catch {
    // Page navigating, or overlay not installed. Ignore.
  }
}


/**
 * Highlights whatever a locator resolves to.
 *
 * Used for elements that carry no data-agent-id, such as dropdown
 * options and address suggestions. Never throws.
 */
export async function highlightLocator(page, locator) {
  if (!locator) return;

  try {
    const box = await locator.boundingBox();
    if (!box) return;

    await page.evaluate(
      ({ x, y, w, h }) => window.__qaShowBox?.(x, y, w, h),
      { x: box.x, y: box.y, w: box.width, h: box.height }
    );
  } catch {
    // Decorative only.
  }
}
