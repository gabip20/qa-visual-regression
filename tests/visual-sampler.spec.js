const { test, expect } = require("@playwright/test");

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function isGoodInternalUrl(url, origin) {
  if (!url || !url.startsWith(origin)) return false;
  if (url.includes("#")) return false;

  const lower = url.toLowerCase();

  const badContains = [
    "logout", "login", "signin", "signup",
    "wp-admin", "wp-login", "/admin",
    "/user/login", "/user/logout",
  ];
  if (badContains.some((x) => lower.includes(x))) return false;

  const badExt = [".pdf", ".jpg", ".png", ".webp", ".svg", ".zip", ".mp4"];
  if (badExt.some((ext) => lower.includes(ext))) return false;

  return true;
}

async function tryDismissOverlays(page) {
  const candidates = [
    'button:has-text("Allow all")',
    'button:has-text("Allow All")',
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("Agree")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
    'button:has-text("Close")',
    'button:has-text("Dismiss")',
    '[aria-label*="accept" i]',
    '[aria-label*="agree" i]',
    '[aria-label*="close" i]',
    '[id*="accept" i]',
    '[class*="accept" i]',
  ];

  // Two passes to handle stacked overlays (e.g. cookie banner + newsletter popup)
  for (let pass = 0; pass < 2; pass++) {
    for (const sel of candidates) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(600); // wait for banner animation to finish
      }
    }
  }
}

function safeScreenshotName(url, origin) {
  const raw =
    url.replace(origin, "").replace(/\/$/, "").replace(/[^\w]+/g, "_").slice(0, 80) || "home";
  const hash = Buffer.from(url).toString("base64").slice(0, 8);
  return `${raw}_${hash}`;
}

// Full page screenshots can crash the browser on CI runners with limited memory.
// Viewport-only screenshots are used in CI, full page locally.
const isCI = !!process.env.CI;

test("visual regression sampler (generic)", async ({ page }) => {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing BASE_URL. Example: BASE_URL="https://example.com"');
  }

  const seed = Number(process.env.SEED || 42);
  const pagesToPick = Number(process.env.PAGES || 6);

  const maskSelectors = (process.env.MASK_SELECTORS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await page.addStyleTag({
    content: `
      * { transition: none !important; animation: none !important; caret-color: transparent !important; }
      html { scroll-behavior: auto !important; }
    `,
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await tryDismissOverlays(page);

  const origin = new URL(baseUrl).origin;

  const menuLoc = page.locator("nav a[href], header a[href]");
  const allLoc = page.locator("a[href]");

  const getHrefs = async (loc) =>
    loc.evaluateAll((els) =>
      Array.from(
        new Set(
          els
            .map((a) => a.getAttribute("href"))
            .filter(Boolean)
            .map((h) => h.trim())
        )
      )
    );

  const hrefs = [
    ...(await getHrefs(menuLoc).catch(() => [])),
    ...(await getHrefs(allLoc).catch(() => [])),
  ];

  const urls = Array.from(
    new Set(
      hrefs
        .map((h) => normalizeUrl(h, baseUrl))
        .filter((u) => isGoodInternalUrl(u, origin))
    )
  );

  if (!urls.length) {
    throw new Error("No internal links found. Try a different BASE_URL.");
  }

  // Deterministic random — pick from discovered URLs (homepage handled separately)
  const rng = mulberry32(seed);
  const pool = [...urls];
  const picked = [];
  while (picked.length < Math.min(pagesToPick - 1, pool.length)) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }

  // Always include the homepage first
  const pagesToVisit = [baseUrl, ...picked];

  for (const url of pagesToVisit) {
    // networkidle with fallback for busy pages
    await page
      .goto(url, { waitUntil: "networkidle", timeout: 15000 })
      .catch(() => page.goto(url, { waitUntil: "domcontentloaded" }));

    await tryDismissOverlays(page);
    await page.waitForTimeout(400);

    const masks = maskSelectors.map((s) => page.locator(s));
    const safeName = safeScreenshotName(url, origin);

    await expect(page).toHaveScreenshot(`${safeName}.png`, {
      fullPage: !isCI,  // full page locally, viewport only in CI to avoid memory crashes
      animations: "disabled",
      caret: "hide",
      mask: masks.length ? masks : undefined,
      timeout: 30000,   // extra time for slow CI runners
      // If you get tiny pixel diffs (fonts), loosen:
      // maxDiffPixelRatio: 0.01,
    });
  }
});