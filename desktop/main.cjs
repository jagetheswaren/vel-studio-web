const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');
let server, window, origin;
const smoke = process.argv.includes('--smoke-test');
async function boot() {
  const project = path.resolve(__dirname, '..');
  const { createApp } = await import('../server/app.js');
  const express = (await import('express')).default;
  const { app: backend } = await createApp({
    dataDir: path.join(app.getPath('userData'), 'studio-data'),
  });
  backend.use(express.static(path.join(project, 'dist')));
  backend.get('/{*path}', (_req, res) => res.sendFile(path.join(project, 'dist/index.html')));
  server = backend.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Vel Studio',
        submenu: [
          { label: 'Reload studio', accelerator: 'CmdOrCtrl+R', click: () => window?.reload() },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { role: 'togglefullscreen' },
          { type: 'separator' },
          { role: 'toggleDevTools' },
        ],
      },
    ]),
  );
  window = new BrowserWindow({
    title: 'Vel Studio',
    width: 1600,
    height: 1000,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#101820',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin + '/')) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  if (!smoke) window.once('ready-to-show', () => window.show());
  await window.loadURL(origin);
  if (smoke) {
    let state;
    for (let attempt = 0; attempt < 100; attempt++) {
      state = await window.webContents.executeJavaScript(
        `({title:document.title,ready:!!document.querySelector('[aria-label="Vel Studio visual workspace"], [aria-label="Projects home"]'),layers:document.querySelectorAll('[data-node-id]').length})`,
      );
      if (state.ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    console.log('VEL_DESKTOP_SMOKE ' + JSON.stringify(state));
    if (!state?.ready) app.exit(1);
    else app.quit();
  }
}
app
  .whenReady()
  .then(boot)
  .catch((e) => {
    dialog.showErrorBox('Vel Studio could not start', e.message);
    app.quit();
  });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => server?.close());
