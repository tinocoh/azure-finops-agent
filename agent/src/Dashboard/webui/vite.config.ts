import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output goes to the .NET app's wwwroot so the SPA is served SAME-ORIGIN
// (cookies + CSRF/Origin checks of /api/chat and the OAuth flow work without CORS).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../wwwroot',
    emptyOutDir: true,
  },
  server: {
    // Local dev convenience: proxy API + auth to the running .NET backend.
    proxy: {
      '/api': 'http://localhost:5180',
      '/auth': 'http://localhost:5180',
    },
  },
});
