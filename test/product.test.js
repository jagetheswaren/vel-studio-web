import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
let root, server, base;
async function start() {
  const { app } = await createApp({ dataDir: root });
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
}
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'vel-product-'));
  await start();
});
after(async () => {
  await new Promise((r) => server.close(r));
  await fs.rm(root, { recursive: true, force: true });
});
async function api(route, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(base + route, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Vel-Client': 'local', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, ...(await r.json()) };
}
async function create(template = 'starter') {
  return api('/api/workspaces', {
    method: 'POST',
    body: { name: 'Project test', description: 'Persistent project', template },
  });
}
test('projects expose real metadata and reversible archival', async () => {
  const p = await create('game');
  assert.equal(p.template, 'game');
  assert.ok(p.createdAt);
  const list = await api('/api/projects'),
    found = list.projects.find((w) => w.id === p.id);
  assert.equal(found.fileCount, 2);
  assert.ok(found.totalBytes > 0);
  const renamed = await api(`/api/workspaces/${p.id}`, {
    method: 'PATCH',
    body: { name: 'Renamed', description: 'Updated', archived: true },
  });
  assert.equal(renamed.archived, true);
  assert.equal(renamed.name, 'Renamed');
  assert.equal(
    (await api(`/api/workspaces/${p.id}`, { method: 'PATCH', body: { archived: false } })).archived,
    false,
  );
  assert.equal((await create('unknown')).status, 400);
});
test('preferences merge partial editor settings and reject invalid values', async () => {
  const initial = await api('/api/preferences');
  assert.equal(initial.editor.fontSize, 14);
  const changed = await api('/api/preferences', {
    method: 'PATCH',
    body: { theme: 'light', autoSave: true, editor: { fontSize: 18 } },
  });
  assert.equal(changed.editor.tabSize, 2);
  assert.equal(changed.theme, 'light');
  assert.equal(changed.autoSave, true);
  for (const body of [
    { editor: { fontSize: 80 } },
    { autoSave: 'yes' },
    { editor: { tabSize: 3 } },
    { autoSaveDelay: 1 },
    { theme: 'neon' },
    { unknown: true },
  ])
    assert.equal((await api('/api/preferences', { method: 'PATCH', body })).status, 400);
});
test('session persists valid source location and invalidates archived or deleted projects', async () => {
  const p = await create();
  const saved = await api('/api/session', {
    method: 'PUT',
    body: { workspace: p.id, path: 'src/studio.vel', mode: 'Scene' },
  });
  assert.equal(saved.mode, 'Scene');
  assert.equal((await api('/api/session')).workspace, p.id);
  await api(`/api/workspaces/${p.id}`, { method: 'PATCH', body: { archived: true } });
  const r = await fetch(base + '/api/session');
  assert.equal(await r.json(), null);
  assert.equal(
    (
      await api('/api/session', {
        method: 'PUT',
        body: { workspace: p.id, path: '../secret', mode: 'Code' },
      })
    ).status,
    400,
  );
});
test('revision history stores prior content, restores it, and preserves overwritten newer content', async () => {
  const p = await create(),
    file = 'src/history.vel';
  const save = (content) =>
    api('/api/file', { method: 'PUT', body: { workspace: p.id, path: file, content } });
  await save('version A');
  await save('version B');
  await save('version C');
  await save('version C');
  const query = `workspace=${p.id}&path=${file}`,
    history = await api('/api/history?' + query);
  assert.equal(history.revisions.length, 2);
  assert.ok(history.revisions.every((r) => !('content' in r)));
  const oldest = history.revisions.at(-1);
  assert.equal(
    (await api('/api/history/revision?' + query + '&id=' + oldest.id)).content,
    'version A',
  );
  const restored = await api('/api/history/restore', {
    method: 'POST',
    body: { workspace: p.id, path: file, id: oldest.id },
  });
  assert.equal(restored.content, 'version A');
  assert.equal((await api('/api/file?' + query)).content, 'version A');
  const updated = await api('/api/history?' + query);
  assert.equal(
    (await api('/api/history/revision?' + query + '&id=' + updated.revisions[0].id)).content,
    'version C',
  );
  assert.equal((await api('/api/history?workspace=' + p.id + '&path=../secret')).status, 400);
});
test('concurrent saves serialize into valid files and cap revision retention at twenty', async () => {
  const p = await create(),
    file = 'src/concurrent.vel';
  await api('/api/file', { method: 'PUT', body: { workspace: p.id, path: file, content: '0' } });
  await Promise.all(
    Array.from({ length: 24 }, (_, i) =>
      api('/api/file', {
        method: 'PUT',
        body: { workspace: p.id, path: file, content: String(i + 1) },
      }),
    ),
  );
  const list = await api(`/api/history?workspace=${p.id}&path=${file}`);
  assert.equal(list.revisions.length, 20);
  const saved = await api(`/api/file?workspace=${p.id}&path=${file}`);
  assert.ok(/^\d+$/.test(saved.content));
});
test('launch taskboard capability supports CRUD, isolation and persistence across a restart', async () => {
  const p = await create('taskboard'),
    other = await create('taskboard');
  const files = await api('/api/files?workspace=' + p.id);
  assert.ok(files.files.some((f) => f.path === 'app/app.js'));
  assert.equal(
    (await api('/api/workspaces/' + p.id + '/launch', { method: 'POST', body: {} })).kind,
    'taskboard',
  );
  const response = await fetch(base + '/launch/' + p.id),
    html = await response.text();
  assert.match(html, /sandbox="allow-scripts allow-forms"/);
  const token = html.match(/&quot;token&quot;:&quot;([a-f0-9]+)&quot;/)?.[1];
  assert.ok(token);
  const endpoint = '/api/project-data/' + p.id + '/tasks',
    headers = { Authorization: 'Bearer ' + token, Origin: 'null' };
  assert.equal((await api(endpoint)).status, 401);
  const created = await api(endpoint, {
    method: 'POST',
    body: { title: 'Launch a real app' },
    headers,
  });
  assert.equal(created.status, 201);
  assert.equal(
    (
      await api(endpoint + '/' + created.task.id, {
        method: 'PATCH',
        body: { done: true },
        headers,
      })
    ).task.done,
    true,
  );
  assert.equal((await api('/api/project-data/' + other.id + '/tasks', { headers })).status, 401);
  const preflight = await fetch(base + endpoint, {
    method: 'OPTIONS',
    headers: { Origin: 'null', 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'null');
  assert.equal(preflight.status, 204);
  assert.equal(
    (await api(endpoint, { method: 'POST', body: { title: ' ' }, headers })).status,
    400,
  );
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      api(endpoint, { method: 'POST', body: { title: 'Concurrent ' + i }, headers }),
    ),
  );
  assert.equal((await api(endpoint, { headers })).tasks.length, 11);
  await new Promise((r) => server.close(r));
  await start();
  assert.equal((await api(endpoint, { headers })).status, 401);
  await api('/api/workspaces/' + p.id + '/launch', { method: 'POST', body: {} });
  const after = await (await fetch(base + '/launch/' + p.id)).text(),
    newToken = after.match(/&quot;token&quot;:&quot;([a-f0-9]+)&quot;/)[1],
    newHeaders = { Authorization: 'Bearer ' + newToken, Origin: 'null' };
  const tasks = await api(endpoint, { headers: newHeaders });
  assert.equal(tasks.tasks.length, 11);
  assert.equal(tasks.tasks.find((t) => t.id === created.task.id).done, true);
  assert.equal(
    (await api(endpoint + '/' + created.task.id, { method: 'DELETE', headers: newHeaders })).ok,
    true,
  );
  assert.equal((await api('/api/preferences')).theme, 'light');
});
test('studio launch rejects malformed source with an actionable error', async () => {
  const p = await create('blank');
  assert.equal(
    (await api(`/api/workspaces/${p.id}/launch`, { method: 'POST', body: {} })).kind,
    'studio',
  );
  await api('/api/file', {
    method: 'PUT',
    body: { workspace: p.id, path: 'src/studio.vel', content: '{}' },
  });
  assert.equal(
    (await api(`/api/workspaces/${p.id}/launch`, { method: 'POST', body: {} })).status,
    400,
  );
});
test('full-stack preview combines saved assets with the current unsaved buffer without writing it', async () => {
  const p = await create('taskboard');
  const before = await api(`/api/file?workspace=${p.id}&path=app/app.js`);
  const preview = await api(`/api/workspaces/${p.id}/preview`, {
    method: 'POST',
    body: { path: 'app/app.js', source: 'document.body.dataset.preview = "unsaved-buffer";' },
  });
  assert.equal(preview.status, 200);
  assert.match(preview.html, /unsaved-buffer/);
  assert.match(preview.html, /window.VEL_PROJECT/);
  assert.match(preview.html, /<style>/);
  assert.equal((await api(`/api/file?workspace=${p.id}&path=app/app.js`)).content, before.content);
});
