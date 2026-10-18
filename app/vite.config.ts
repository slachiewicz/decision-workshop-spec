import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The same policy is served as a header by public/_headers (Cloudflare) and vercel.json.
// The meta copy enforces it wherever dist/ is served without those headers. It is added
// to production builds only: the dev server injects inline styles and scripts for HMR.
// frame-ancestors is header-only (browsers ignore it in a meta tag).
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
  "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

const cspMeta = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  plugins: [react(), cspMeta()],
  build: { outDir: 'dist', sourcemap: true },
});
