import { createServer } from 'vite';

const port = Number(process.argv[2]);
const server = await createServer({
  cacheDir: `node_modules/.vite-playwright-${port}`,
  optimizeDeps: { entries: ['index.html'] },
  server: { host: '127.0.0.1', port, strictPort: true, watch: null, hmr: false },
});
await server.listen();
