import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // three.js alone is ~700 kB; the pages are served from this computer, so size doesn't matter
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    // lvh.me points to 127.0.0.1; TikTok LIVE Studio rejects "localhost" links
    allowedHosts: ['lvh.me'],
  },
});
