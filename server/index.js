import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { app } = await createApp({
  dataDir: process.env.VEL_DATA_DIR || path.join(project, '.vel-data'),
});
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: project,
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const express = (await import('express')).default;
  app.use(express.static(path.join(project, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(project, 'dist/index.html')));
}
const port = Number(process.env.PORT || 4310);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`VEL IDE ready: http://127.0.0.1:${port}`),
);
server.on('error', (e) => {
  console.error(
    e.code === 'EADDRINUSE' ? `Port ${port} is in use. Set PORT to another local port.` : e.message,
  );
  process.exit(1);
});
