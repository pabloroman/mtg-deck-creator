import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from a repo subpath; Vercel/Netlify/local serve from root.
// Build for Pages with:  DEPLOY_TARGET=gh-pages npm run build
const base = process.env.DEPLOY_TARGET === 'gh-pages' ? '/mtg-deck-creator/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5180 },
  preview: { port: 5180 },
});
