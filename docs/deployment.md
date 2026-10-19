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
run **Build apps** by hand when a new file is actually wanted. The difference that matters to a
player: the installed *page* fetches the newest build every launch (`public/sw.js`), while an
installed *app* carries the game inside it and only changes when a new `.apk`/`.ipa` is installed.
There is no over-the-air update any more; the page is the thing that updates itself.
