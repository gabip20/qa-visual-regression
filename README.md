# pw-visual-regression

Generic visual regression sampler using Playwright. Point it at any URL and it will
crawl internal links, pick a deterministic sample of pages, and screenshot them.
Run it twice (baseline → compare) to catch visual regressions.

## How it works

1. **Baseline job** — visits `BASE_URL`, picks pages by seed, saves screenshots as artifacts
2. **Compare job** — visits the same pages, compares against baseline screenshots, generates an HTML diff report

## Running in GitLab CI

Go to **CI/CD → Pipelines → Run pipeline** and set these variables:

| Variable         | Required | Default | Description                                      |
|------------------|----------|---------|--------------------------------------------------|
| `BASE_URL`       | ✅        | —       | The site to test, e.g. `https://example.com`     |
| `SEED`           | —        | `42`    | Controls which pages are picked                  |
| `PAGES`          | —        | `6`     | Number of pages to screenshot (includes homepage)|
| `MASK_SELECTORS` | —        | —       | CSS selectors to mask, e.g. `.ad-banner,.clock`  |

Then:
1. ▶ Run **`visual-baseline`** and wait for it to finish
2. Deploy your changes
3. ▶ Run **`visual-compare`**
4. Open the `playwright-report/` artifact to see diffs

## Running locally

```bash
npm install
npx playwright install chromium

# Generate baseline
BASE_URL="https://example.com" npm run test:update

# Compare
BASE_URL="https://example.com" npm test
```
