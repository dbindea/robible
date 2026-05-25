[![Netlify Status](https://api.netlify.com/api/v1/badges/6b686e6f-af60-40b2-ad0d-9226c5ba76e9/deploy-status)](https://app.netlify.com/sites/robible/deploys)

# robible.com

Biblia în limba Româna

[ES] Este proyecto se puede encontrar en la siguiente dirección web [robible.com](https://robible.com)

[RO] Acest proiect se poate gasi pe site-ul [robible.com](https://robible.com)

[EN] This project can be found at the following web address [robible.com](https://robible.com)

![image](https://user-images.githubusercontent.com/1469428/168670916-e580fc29-9727-43db-8895-036eadec4d27.png)

## Get started

Are you interested in contributing?

Download the project and install the dependencies...

```bash
cd robible
npm install
```

...then start Vite:

```bash
npm run dev
```

Navigate to [localhost:5173](http://localhost:5173). You should see your app running. Edit a component file in `src` and save it to see the page update.

The dev server is configured with `--host 0.0.0.0` so it can be tested from other devices on the same network.

## Building and running in production mode

To create an optimised version of the app:

```bash
npm run build
```

You can preview the newly built app with:

```bash
npm run preview
```

## PWA and SEO checks

Production registers `public/sw.js`, links `public/site.webmanifest`, and precaches the shell plus `public/data/**` for offline reading after the first successful load. Test installability from the deployed HTTPS site:

1. Android Chrome: open `https://robible.com`, wait for the page to finish loading, then use the browser menu or install prompt.
2. iOS Safari: open `https://robible.com`, use Share, then Add to Home Screen.
3. Offline: load the site once, enable airplane mode, reopen it, and confirm the selected Bible data still loads.
4. SEO preview: share a verse URL like `https://robible.com/verse/vdc/0/1/1`. Netlify serves real OG/Twitter meta tags for that URL, then redirects human visitors back into the SPA.

For social preview debugging, inspect the initial HTML for `/verse/...`, then refresh the cache in Facebook Sharing Debugger. WhatsApp may cache previews, so test with a new verse URL or wait for its cache to expire.

Thank you!
