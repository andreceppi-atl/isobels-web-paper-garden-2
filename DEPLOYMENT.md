# Isobel's Web deployment

The game has two separately deployed pieces:

1. `client/` is the Vite browser game.
2. `multiplayer/` is the Cloudflare Worker and Durable Object that keep the shared room alive.

The music files live in `client/public/music/` and are copied into the client build automatically.

## 1. Publish the source to GitHub

Create an empty **private** GitHub repository named `isobels-web-paper-garden`. Do not add a README, `.gitignore`, or license in GitHub because this checkout already has commits.

Then run:

```bash
cd /Users/lilwall-e/Documents/Codex/2026-09-20/lets/work/webspun-revamp
git remote add origin https://github.com/YOUR-GITHUB-NAME/isobels-web-paper-garden.git
git push -u origin main
```

If you use GitHub's SSH URLs, replace the `git remote add` line with:

```bash
git remote add origin git@github.com:YOUR-GITHUB-NAME/isobels-web-paper-garden.git
```

## 2. Deploy the multiplayer worker

The currently deployed production worker is:

```text
https://isobels-web-paper-garden-multiplayer.andre-ceppi.workers.dev
```

To redeploy it from this checkout:

```bash
cd multiplayer
npm ci
npx wrangler login
npm run deploy
```

Wrangler prints the deployed URL. Turn it into the game WebSocket address by using `wss://`, adding `/ws`, and selecting the room:

```text
wss://YOUR-WORKER.workers.dev/ws?room=paper-garden
```

Test the deployed room with:

```bash
npm run smoke -- 'wss://YOUR-WORKER.workers.dev/ws?room=production-smoke'
```

## 3. Deploy the browser game on Vercel

In Vercel:

1. Choose **Add New → Project** and import the GitHub repository.
2. Set **Root Directory** to `client`.
3. Select the **Vite** framework preset.
4. Use `npm run build` as the build command.
5. Use `dist` as the output directory.
6. Add the environment variable below for Production, Preview, and Development:

```text
VITE_SERVER_URL=wss://YOUR-WORKER.workers.dev/ws?room=paper-garden
```

7. Press **Deploy**.

The committed client has the current production worker as a fallback, but the Vercel environment variable makes it easy to move the frontend to a different Cloudflare account later without editing code.

### Approve the exact Vercel address

After the first frontend deploy, copy its production origin, for example `https://isobels-web-paper-garden.vercel.app`. Do not include a trailing slash or path.

Add it to `multiplayer/wrangler.jsonc` at the top level:

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://isobels-web-paper-garden.vercel.app"
}
```

For more than one approved production domain, separate exact origins with commas. Then deploy the worker again:

```bash
cd multiplayer
npm run deploy
```

Only exact configured origins are accepted. Vercel's changing preview URLs are intentionally not approved by a wildcard; add a stable preview origin explicitly if multiplayer previews are required.

## 4. Future updates

Frontend changes deploy automatically through Vercel after:

```bash
git add -A
git commit -m "Describe the update"
git push
```

Changes under `multiplayer/` must also be deployed to Cloudflare:

```bash
cd multiplayer
npm run deploy
```

## Quick checks after a deployment

- Open the game in two separate browser windows.
- Confirm both spiders appear and movement updates in both windows.
- Make a handshake and send a chat message.
- Press **Listen** and confirm music plays.
- Confirm the Thread meter increases while listening.
- Place a strand and refresh; the strand should still be present.
