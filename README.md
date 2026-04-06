# qa-visual-regression

Generic visual regression tool built with Playwright. Point it at any URL and it
will crawl internal links, pick a deterministic sample of pages, and screenshot them.
Run it twice (baseline → compare) to catch visual regressions.

## How it works

1. **Baseline** — visits `BASE_URL`, picks pages by seed, saves screenshots as reference
2. **Compare** — visits the same pages, compares against baseline, generates an HTML diff report

## Running with GitHub Actions

Go to **Actions → Visual Regression → Run workflow** and fill in:

| Input            | Required | Default | Description                                       |
|------------------|----------|---------|---------------------------------------------------|
| `base_url`       | ✅        | —       | The site to test, e.g. `https://example.com`      |
| `mode`           | ✅        | compare | `baseline` = save screenshots, `compare` = check  |
| `pages`          | —        | `6`     | Number of pages to screenshot (includes homepage) |
| `seed`           | —        | `42`    | Controls which pages are picked                   |
| `mask_selectors` | —        | —       | CSS selectors to mask, e.g. `.ad-banner,.clock`   |

Then:
1. ▶ Run workflow with `mode = baseline` and wait for it to finish
2. Deploy your changes
3. ▶ Run workflow with `mode = compare`
4. Download the `playwright-report` artifact to see diffs

## Running locally
```bash
npm install
npx playwright install chromium

# Generate baseline
BASE_URL="https://example.com" npx playwright test --update-snapshots

# Compare
BASE_URL="https://example.com" npx playwright test
```

## Key features

- **Deterministic sampling** — same seed always picks the same pages, results are reproducible
- **Overlay dismissal** — automatically closes cookie banners and popups before screenshotting
- **Dynamic masking** — mask elements like ads or live clocks via `MASK_SELECTORS` to avoid false positives
- **CI-safe** — uses viewport-only screenshots on CI runners to avoid memory crashes