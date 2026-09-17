# Trap Adventure 2 Browser Prototype

## GitHub Pages

This is a Vite + React application and must be built before it can be served. Opening the repository files directly through GitHub Pages causes a white screen because GitHub Pages cannot compile `src/main.tsx`.

1. Push this repository, including `.github/workflows/deploy-pages.yml`, to the `main` branch.
2. In the repository, open **Settings -> Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Open the **Actions** tab and wait for **Deploy GitHub Pages** to complete.
5. Open the URL shown in the successful deployment.

The workflow builds `dist` automatically and deploys the ready-to-run version. Every new push to `main` updates the game.

## Local launch

```bash
npm install
npm run dev
```

## White screen troubleshooting

If the page opens blank, check these in order:

1. **Unbuilt sources.** This repo ships TypeScript/JSX sources. Open the deployed Pages URL (built `dist`), not the raw repository files.
2. **Pages source.** In **Settings -> Pages**, **Build and deployment** must be **GitHub Actions**, and the **Deploy GitHub Pages** workflow must be green.
3. **JavaScript disabled.** The game needs JavaScript; with it off you will see an explanatory message instead of a blank page.
4. **Old browser.** The game needs Canvas 2D, `requestAnimationFrame`, and (optionally) `ResizeObserver`. Anything from the last ~5 years works; older browsers get a fallback message instead of a white screen.
5. **Still blank?** Open DevTools Console, copy the red error text, and check it against `npm run smoke` locally — the smoke test mounts the real built bundle and reports any error that would blank the page.