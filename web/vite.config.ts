import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development Vite serves the UI on :5173 and forwards /api to the Plak server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4747' },
  },
});
