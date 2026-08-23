# Deploying FLOX to GitHub Pages

FLOX can run as a static GitHub Pages application. Projects remain in each
visitor's browser, and JSON/SVG/PNG export works without a server.

## One-time repository setup

1. Publish the repository with `main` as its default branch.
2. Open **Settings > Pages** in GitHub.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push to `main` or run **Deploy GitHub Pages** manually from the Actions tab.

The workflow discovers the correct Pages base path, builds the Vite app, adds
the single-page-application fallback, and deploys `web/dist`.

## Optional Google Drive integration

Create a repository Actions variable named `VITE_GOOGLE_CLIENT_ID`. Register
the deployed Pages origin in the Google OAuth client's **Authorized JavaScript
origins**. The origin has no repository path, for example:

```text
https://your-github-name.github.io
```

The app remains fully usable for local editing and file export when the
variable is omitted.

## Custom domains

Configure the custom domain in GitHub Pages settings. The Pages configuration
step supplies the build with the correct base path, so no source-code change
is required.

## Verification

Pull requests and pushes to `main` run the type checker, web/server tests, and
production build. The deployment workflow runs a separate Pages build before
publishing. Direct application URLs are handled by the generated `404.html`
fallback.
