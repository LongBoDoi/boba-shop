# Web deployment

Every push to `main` runs the [Deploy web workflow](https://github.com/LongBoDoi/boba-shop/actions/workflows/deploy.yml). After dependency installation, lint, typecheck, regression checks, and web export succeed, it publishes the game to [boba-shop.expo.app](https://boba-shop.expo.app) using EAS Hosting. Lint warnings fail the workflow.

Deployments run one at a time. GitHub keeps the latest pending run when several commits arrive during a deployment. Pushes to other branches do not deploy production.

To redeploy the current `main`, open the workflow's **Run workflow** button and choose `main`.

## Authentication

The workflow uses the repository Actions secret `EXPO_TOKEN`. This must be an [Expo personal access token](https://docs.expo.dev/accounts/programmatic-access/) for an account with access to the `@manhlong/boba-shop` project.

To replace or rotate it:

1. Create a token in [Expo account settings](https://expo.dev/accounts/manhlong/settings/access-tokens), with a recognizable name such as `boba-shop GitHub deploy`.
2. Save it as `EXPO_TOKEN` in the repository's [Actions secrets](https://github.com/LongBoDoi/boba-shop/settings/secrets/actions).
3. Run the deployment workflow and confirm it succeeds before revoking the old token.

Do not commit tokens to the repository. The workflow exposes this secret only to the deployment step.

## Local deployment

Log in to Expo, then run:

```sh
npx expo export --platform web
NODE_OPTIONS="--dns-result-order=ipv4first" npx eas-cli@latest deploy --prod
```

The EAS project ID and single-page web export are configured in `app.json`. This workflow deploys the web game; native store builds and OTA updates use separate EAS commands.
