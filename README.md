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