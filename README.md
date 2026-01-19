# bar-chart-race — GitHub Pages + webOS 3.9 compatible build

This project uses modern JS in `script.js`. webOS 3.9's WebKit doesn't support ES6 modules and newer JS features, so we transpile to ES5 and include a UMD D3 build for compatibility.

Quick setup (locally) — creates `dist/script.es5.js`:

```bash
npm install
npm run build
```

What the build does:

- Uses Babel to transpile `script.js` to ES5 and inject necessary polyfills (via `core-js`) based on usage.
- Output: `dist/script.es5.js` which `index.html` loads.

Deploy to GitHub Pages:

1. Build: `npm run build` and commit the generated `dist/script.es5.js` (or add a CI step to build on deploy).
2. Push to `main` (or a `gh-pages` branch) and enable GitHub Pages in repo settings to serve the site.

Notes:

- `index.html` loads `d3.v5.min.js` (UMD ES5 build) which is compatible with older WebKit.
- If your TV cannot access CDNs, download `d3.v5.min.js` and include it in the repo and reference it locally.
