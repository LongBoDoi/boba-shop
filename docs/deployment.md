# Web deployment

The game is a web game, and this is how it ships. Every push to `main` runs the
[Deploy web workflow](https://github.com/LongBoDoi/boba-shop/actions/workflows/deploy.yml): after
`npm ci`, the typecheck, the regression checks and the Vite build succeed, it publishes `dist/` to
[boba-shop.expo.app](https://boba-shop.expo.app) on EAS Hosting.

**That link is the only one.** `eas deploy --prod` publishes to the production alias; a deploy
without `--prod` would leave the build on a URL of its own, and `--alias <name>` would add a named
one (there was a `boba-shop--phaser.expo.app` while the rebuild was a preview; it is gone). The
shop has one address because an installed page is pinned to the address it was installed from, and
a second link is a second game to keep in step. The one URL that does appear beside it is the
current deployment's own `boba-shop--<id>.expo.app`, which is how EAS Hosting rolls back; nothing
links to it.

Deployments run one at a time. GitHub keeps the latest pending run when several commits arrive
during a deployment. Pushes to other branches do not deploy. To redeploy the current `main`, open
the workflow's **Run workflow** button and choose `main`.

## What the host does with caching, and why the page works around it

Measured against the live site rather than assumed, because two of these are the opposite of what
you would guess:

| What | `Cache-Control` |
| --- | --- |
| `/` (`index.html`) | **none at all** |
| `/assets/*` | `public, max-age=3600` |
| `/update.json` | `public, max-age=3600` |
| `/sw.js` | `public, max-age=3600` |

Two consequences, and both have bitten:

- **No header on the page is worse than a short one.** With nothing to go on a browser invents a
  lifetime — a tenth of the file's age — so a page deployed yesterday is held for hours and a
  launch inside them never asks the server whether a new game exists.
- **A path the deployment has not got is answered with `index.html`, at status 200**, not with a
  404. Each deploy is its own set of files, so the previous build's hashed assets are simply not
  there, and a stale page asking for one is handed the page instead. The browser will not run HTML
  as a module, and the shop is a white screen.

**None of this is configurable.** EAS Hosting exposes headers only to API routes, through the
`Response` a route returns; a static deploy has no route and no config file, so the defaults above
are the defaults. The hour on `/assets/` is harmless — those names carry a hash of their contents —
and the hour on `/update.json` is what `isWhole` exists to survive.

So the work-arounds live in the client, and they are described where they are implemented: see
"A deploy must not be able to break an installed page" in `CLAUDE.md` for `public/sw.js`, the
inline repair in `index.html`, and the matching guard in `src/updates/live.ts`.
`tools/check-web-cache.cjs` holds the lot against a fake host.

**After a deploy, the thing to check is not that the site is new — it is that the site is
consistent.** `curl -s https://boba-shop.expo.app/ | grep -o 'assets/index-[^"]*'` names the bundle
the page asks for, and that name has to come back as JavaScript:

```sh
curl -sI https://boba-shop.expo.app/assets/index-<hash>.js | grep -i content-type
```

`application/javascript` is a whole deploy. `text/html` is the fallback, which means the page and
the files it names are from different deployments — wait for the hour and check again before
believing anything else is wrong.

## What `app.json` is now

`app.json` is **not** an app config — the game has no Expo app any more. It is only the identity of
the hosting project this is published to (`@manhlong/boba-shop`, project
`a7ab235c-52a1-459c-a82e-cca1e4c3cf36`), which is what `eas deploy` reads to know where a build
goes. Nothing in the game imports it, and `npx expo` is not installed. The phone apps are
configured in `capacitor.config.ts`.

## Authentication

The workflow uses the repository Actions secret `EXPO_TOKEN`. This must be an
[Expo personal access token](https://docs.expo.dev/accounts/programmatic-access/) for an account
with access to the `@manhlong/boba-shop` project.

To replace or rotate it:

1. Create a token in [Expo account settings](https://expo.dev/accounts/manhlong/settings/access-tokens),
   with a recognizable name such as `boba-shop GitHub deploy`.
2. Save it as `EXPO_TOKEN` in the repository's
   [Actions secrets](https://github.com/LongBoDoi/boba-shop/settings/secrets/actions).
3. Run the deployment workflow and confirm it succeeds before revoking the old token.

Do not commit tokens to the repository. The workflow exposes this secret only to the deploy step.

## Local deployment

Log in to Expo (`npx eas-cli@latest login`), then:

```sh
npx vite build
NODE_OPTIONS="--dns-result-order=ipv4first" npx eas-cli@latest deploy --prod
```

`eas-cli` uses `node-fetch` over an IPv6 path some networks reset; that `NODE_OPTIONS` is what
gets past `read ECONNRESET` on every request.

## The phone apps

The apps are the same web build in a Capacitor shell and are **not** published by this workflow —
run **Build apps** by hand when a new file is actually wanted.

Every deploy also publishes `dist/update.json`: the build id, the native shell it expects and every
file with its size. That is what an installed app reads on launch to find out whether this deploy
is something it has not got, and then which files it has to fetch. So a push to `main` reaches the
installed apps as well, as an offer on their next launch — see "Updating itself" in `CLAUDE.md`.

A new **file** is only needed when the native shell changes, which `tools/check-updates.cjs` will
not let you do quietly: bump `NATIVE_VERSION`, re-record the fingerprint, and run **Build apps**
before the next deploy, or installed apps will be told there is a version they cannot have while no
file exists to give them.
