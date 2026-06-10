# Hoseo LMS+

Chrome/Firefox extension. Runs only on `https://learn.hoseo.ac.kr/` to enhance the LMS dashboard.

## Github Workflow

Follow the rules defined in [github-flow](.agents/skills/github-flow/SKILL.md) skill. Execute work in units automatically, from branch creation to squash merge.

## Commands

```bash
npm run lint          # ESLint
npm test              # node --test (with jsdom)
npm run lint:firefox  # Firefox build then web-ext lint (build runs first)
npm run build         # Chrome build (dist/chrome/ + zip)
npm run build:firefox # Firefox build
npm run build:all     # Chrome + Firefox builds
```

Pre-commit check order: `lint → test → build`

## Architecture

No bundler or transpiler. Source JS is loaded directly into the extension.

Details: [`docs/architecture.md`](docs/architecture.md) (module dependencies, cache schema, matching policy, selector guide)

**Load order** (manifest.json content_scripts):
`lib/core.js` → `lib/parsers.js` → `lib/ui/elements.js` → `lib/ui/dates.js` → `lib/ui/tooltip.js` → `lib/ui/render.js` → `lib/ui/index.js` → `lib/data-service.js` → `lib/dashboard-controller.js` → `lib/sidebar.js` → `content.js`

- Each `lib/*.js` is an IIFE that registers a global (`HoseoLmsPlusCore`, etc.) + `module.exports` for testing
- `lib/types.js`: JSDoc `@typedef` only, no runtime code
- `content.js`: entry point. Runs on main page (`/` or `/index.php`) only, handles SPA navigation
- When modifying selectors, change `lib/core.js` `SELECTORS` object first, then parser/UI changes as secondary
- `scripts/build.js`: file copy + manifest transformation + zip. No transpilation

## Code Rules

- ES2022, `sourceType: 'script'` (not ESM)
- `no-var`, `prefer-const`, `eqeqeq` (always `===`), `no-undef` strictly enforced
- `_` prefix params allowed as unused
- `chrome` global allowed as read-only (extension API)
- Both browser and Node globals accessible (ESLint settings)

## Testing

- `node:test` + `node:assert/strict` + jsdom
- Test files: `test/*.test.js`
- Test fixtures: `test/fixtures/` (HTML samples)
- Load lib modules via `require()`. Set `global.Node` in JSDOM instance:
  ```js
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.Node = dom.window.Node;
  ```

## CI

`.github/workflows/ci.yml`: lint → test → lint:firefox (Node 22)

## Build Artifacts

Generated in `dist/`, included in `.gitignore`.
- `dist/chrome/`, `dist/firefox/` — independent copies
- Firefox includes `browser_specific_settings.gecko`, Chrome excludes it
- zip files: `dist/{target}/hoseo-lms-plus-{target}-v{version}.zip`
