import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { safeFile, listFiles } from './store.js';
import { parseStudio } from '../shared/studio.js';
import { compileStudio } from './studio.js';
import { projectTemplates } from './project-template.js';
export const preferenceDefaults = {
  theme: 'dark',
  editor: { fontSize: 14, tabSize: 2, wordWrap: true, minimap: false },
  autoSave: false,
  autoSaveDelay: 1500,
  reduceMotion: false,
  restoreSession: true,
};
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function normalizePreferences(old, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch))
    throw fail('Preferences must be an object.');
  const allowed = Object.keys(preferenceDefaults);
  for (const key of Object.keys(patch))
    if (!allowed.includes(key)) throw fail('Unknown preference: ' + key);
  if (
    patch.editor !== undefined &&
    (!patch.editor || typeof patch.editor !== 'object' || Array.isArray(patch.editor))
  )
    throw fail('Editor preferences must be an object.');
  const p = {
    ...structuredClone(preferenceDefaults),
    ...old,
    ...patch,
    editor: { ...preferenceDefaults.editor, ...old?.editor, ...patch.editor },
  };
  if (!['dark', 'light'].includes(p.theme)) throw fail('Theme must be dark or light.');
  for (const k of ['autoSave', 'reduceMotion', 'restoreSession'])
    if (typeof p[k] !== 'boolean') throw fail(k + ' must be true or false.');
  if (!Number.isInteger(p.autoSaveDelay) || p.autoSaveDelay < 500 || p.autoSaveDelay > 30000)
    throw fail('Autosave delay must be 500–30000 ms.');
  for (const k of Object.keys(p.editor))
    if (!['fontSize', 'tabSize', 'wordWrap', 'minimap'].includes(k))
      throw fail('Unknown editor preference: ' + k);
  if (!Number.isInteger(p.editor.fontSize) || p.editor.fontSize < 11 || p.editor.fontSize > 24)
    throw fail('Editor font size must be 11–24.');
  if (![2, 4, 8].includes(p.editor.tabSize)) throw fail('Tab size must be 2, 4 or 8.');
  if (typeof p.editor.wordWrap !== 'boolean' || typeof p.editor.minimap !== 'boolean')
    throw fail('Word wrap and minimap must be true or false.');
  return p;
}
export function installProductRoutes(
  app,
  { store, rootFor, getWorkspaces, setWorkspaces, revisions, touchWorkspace },
) {
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const launches = new Map(),
    tokens = new Map(),
    taskQueues = new Map();
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  const tokenFor = (id) => {
    if (!tokens.has(id)) tokens.set(id, crypto.randomBytes(32).toString('hex'));
    return tokens.get(id);
  };
  const taskName = (id) => 'tasks-' + crypto.createHash('sha256').update(id).digest('hex');
  async function mutateTasks(id, fn) {
    const prev = taskQueues.get(id) || Promise.resolve();
    const op = prev
      .catch(() => {})
      .then(async () => {
        const tasks = await store.read(taskName(id), []);
        const result = fn(tasks);
        await store.write(taskName(id), tasks);
        await touchWorkspace(id);
        return result;
      });
    taskQueues.set(id, op);
    try {
      return await op;
    } finally {
      if (taskQueues.get(id) === op) taskQueues.delete(id);
    }
  }
  app.get('/api/project-templates', (_req, res) => res.json({ templates: projectTemplates }));
  app.get(
    '/api/projects',
    wrap(async (_req, res) => {
      const projects = await Promise.all(
        getWorkspaces().map(async (p) => {
          const files = await listFiles(await rootFor(p.id));
          return {
            ...p,
            fileCount: files.length,
            totalBytes: files.reduce((n, f) => n + f.size, 0),
          };
        }),
      );
      res.json({ projects, activeId: projects.find((p) => !p.archived)?.id || null });
    }),
  );
  app.patch(
    '/api/workspaces/:id',
    wrap(async (req, res) => {
      await rootFor(req.params.id);
      const old = getWorkspaces().find((p) => p.id === req.params.id),
        patch = req.body;
      if (Object.keys(patch).some((k) => !['name', 'description', 'archived'].includes(k)))
        throw fail('Use name, description or archived to update a project.');
      if (
        patch.name !== undefined &&
        (typeof patch.name !== 'string' || !patch.name.trim() || patch.name.length > 60)
      )
        throw fail('Project name must be 1–60 characters.');
      if (
        patch.description !== undefined &&
        (typeof patch.description !== 'string' || patch.description.length > 500)
      )
        throw fail('Description must be text under 500 characters.');
      if (patch.archived !== undefined && typeof patch.archived !== 'boolean')
        throw fail('archived must be true or false.');
      const next = {
        ...old,
        ...patch,
        ...(patch.name ? { name: patch.name.trim() } : {}),
        updatedAt: new Date().toISOString(),
      };
      await setWorkspaces(getWorkspaces().map((p) => (p.id === next.id ? next : p)));
      res.json(next);
    }),
  );
  app.get(
    '/api/preferences',
    wrap(async (_req, res) =>
      res.json(normalizePreferences(await store.read('preferences', preferenceDefaults), {})),
    ),
  );
  app.patch(
    '/api/preferences',
    wrap(async (req, res) => {
      const p = normalizePreferences(await store.read('preferences', preferenceDefaults), req.body);
      await store.write('preferences', p);
      res.json(p);
    }),
  );
  app.get(
    '/api/session',
    wrap(async (_req, res) => {
      const s = await store.read('session', null);
      if (!s || !getWorkspaces().some((p) => p.id === s.workspace && !p.archived))
        return res.json(null);
      try {
        await safeFile(await rootFor(s.workspace), s.path);
      } catch {
        return res.json(null);
      }
      res.json(s);
    }),
  );
  app.put(
    '/api/session',
    wrap(async (req, res) => {
      const { workspace, path: p, mode } = req.body;
      if (!['Code', 'Design', 'Scene', 'Animate'].includes(mode))
        throw fail('Unknown editor mode.');
      await safeFile(await rootFor(workspace), p);
      const s = { workspace, path: p, mode };
      await store.write('session', s);
      res.json(s);
    }),
  );
  app.get(
    '/api/history',
    wrap(async (req, res) => {
      const entries = await revisions.list(req.query.workspace, req.query.path);
      res.json({ revisions: entries.map(({ content, ...metadata }) => metadata) });
    }),
  );
  app.get(
    '/api/history/revision',
    wrap(async (req, res) => {
      const r = (await revisions.list(req.query.workspace, req.query.path)).find(
        (r) => r.id === req.query.id,
      );
      if (!r) throw fail('Revision not found.', 404);
      res.json({ content: r.content });
    }),
  );
  app.post(
    '/api/history/restore',
    wrap(async (req, res) => {
      const content = await revisions.restore(req.body.workspace, req.body.path, req.body.id);
      await touchWorkspace(req.body.workspace);
      res.json({ ok: true, content });
    }),
  );
  async function launchDocument(id, p, origin, overrides = {}) {
    const root = await rootFor(id),
      project = getWorkspaces().find((p) => p.id === id);
    let html, kind;
    if (project.template === 'taskboard') {
      const read = async (p) => {
        if (Object.hasOwn(overrides, p)) return overrides[p];
        const file = await safeFile(root, p);
        if ((await fs.stat(file)).size > 500000) throw fail('A launch source file exceeds 500 KB.');
        return fs.readFile(file, 'utf8');
      };
      const [index, css, js] = await Promise.all([
        read('app/index.html'),
        read('app/styles.css'),
        read('app/app.js'),
      ]);
      if (!index.includes('<!--VEL_STYLE-->') || !index.includes('<!--VEL_SCRIPT-->'))
        throw fail(
          'Keep the VEL_STYLE and VEL_SCRIPT markers in app/index.html so Launch can embed CSS and JavaScript.',
        );
      const config = JSON.stringify({
        api: origin + '/api/project-data/' + id + '/tasks',
        token: tokenFor(id),
      }).replace(/</g, '\\u003c');
      html = index
        .replace(
          '<!--VEL_STYLE-->',
          '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>',
        )
        .replace(
          '<!--VEL_SCRIPT-->',
          '<script>window.VEL_PROJECT=' +
            config +
            ';</script><script>' +
            js.replace(/<\/script/gi, '<\\/script') +
            '</script>',
        );
      kind = 'taskboard';
    } else {
      const file = await safeFile(root, p || 'src/studio.vel');
      const source = await fs.readFile(file, 'utf8');
      parseStudio(source);
      html = compileStudio(source).html;
      kind = 'studio';
    }
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src ${kind === 'taskboard' ? origin : "'none'"}; form-action 'none'; base-uri 'none'">`;
    html = '<!doctype html>' + csp + html.replace(/<!doctype[^>]*>/gi, '');
    return { html, kind, projectName: project.name };
  }
  app.post(
    '/api/workspaces/:id/preview',
    wrap(async (req, res) => {
      const project = getWorkspaces().find((p) => p.id === req.params.id);
      if (!project || project.template !== 'taskboard')
        throw fail('Full-stack preview requires a task-board project.');
      if (typeof req.body.source !== 'string' || Buffer.byteLength(req.body.source) > 500000)
        throw fail('Preview source must be text under 500 KB.');
      const overrides = ['app/index.html', 'app/styles.css', 'app/app.js'].includes(req.body.path)
        ? { [req.body.path]: req.body.source }
        : {};
      const result = await launchDocument(
        req.params.id,
        null,
        req.protocol + '://' + req.headers.host,
        overrides,
      );
      res.json({ html: result.html, diagnostics: [], tracks: [], duration: 1000 });
    }),
  );
  app.post(
    '/api/workspaces/:id/launch',
    wrap(async (req, res) => {
      const origin = req.protocol + '://' + req.headers.host;
      const launch = await launchDocument(req.params.id, req.body.path, origin);
      launches.set(req.params.id, launch);
      res.json({
        url: '/launch/' + req.params.id,
        kind: launch.kind,
        projectName: launch.projectName,
      });
    }),
  );
  app.get(
    '/launch/:id',
    wrap(async (req, res) => {
      const origin = req.protocol + '://' + req.headers.host;
      const launch =
        launches.get(req.params.id) || (await launchDocument(req.params.id, null, origin));
      res.set('Cache-Control', 'no-store');
      res
        .type('html')
        .send(
          `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(launch.projectName)} · Running project</title><style>*{box-sizing:border-box}body{margin:0;background:#101820;font:13px system-ui;color:#d5e5e0}header{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #33453f}a{color:#81e6be;text-decoration:none}iframe{display:block;width:100%;height:calc(100vh - 44px);border:0}</style></head><body><header><span>● ${escape(launch.projectName)} · Local project</span><a href="/">Open Vel Studio ↗</a></header><iframe title="Running project" sandbox="allow-scripts allow-forms" srcdoc="${escape(launch.html)}"></iframe></body></html>`,
        );
    }),
  );
  // The launched application has an opaque sandbox origin. A scoped capability
  // grants only its task API access, while all IDE APIs retain their origin checks.
  app.use('/api/project-data', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin === 'null') {
      res.set('Access-Control-Allow-Origin', 'null');
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(
    '/api/project-data/:id',
    wrap(async (req, res, next) => {
      await rootFor(req.params.id);
      const project = getWorkspaces().find((p) => p.id === req.params.id);
      const actual = req.headers.authorization,
        expected = tokens.get(req.params.id);
      if (
        project.template !== 'taskboard' ||
        !expected ||
        typeof actual !== 'string' ||
        actual !== 'Bearer ' + expected
      )
        throw fail('Invalid project capability. Launch the project again from Vel Studio.', 401);
      next();
    }),
  );
  app.get(
    '/api/project-data/:id/tasks',
    wrap(async (req, res) => res.json({ tasks: await store.read(taskName(req.params.id), []) })),
  );
  app.post(
    '/api/project-data/:id/tasks',
    wrap(async (req, res) => {
      const title = req.body.title;
      if (typeof title !== 'string' || !title.trim() || title.length > 200)
        throw fail('Task title must be 1–200 characters.');
      const task = {
        id: crypto.randomUUID(),
        title: title.trim(),
        done: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await mutateTasks(req.params.id, (tasks) => {
        if (tasks.length >= 1000) throw fail('This project has reached 1000 tasks.');
        tasks.push(task);
      });
      res.status(201).json({ task });
    }),
  );
  app.patch(
    '/api/project-data/:id/tasks/:task',
    wrap(async (req, res) => {
      if (Object.keys(req.body).some((k) => !['title', 'done'].includes(k)))
        throw fail('Use title or done to update a task.');
      if (
        req.body.title !== undefined &&
        (typeof req.body.title !== 'string' ||
          !req.body.title.trim() ||
          req.body.title.length > 200)
      )
        throw fail('Task title must be 1–200 characters.');
      if (req.body.done !== undefined && typeof req.body.done !== 'boolean')
        throw fail('done must be true or false.');
      const task = await mutateTasks(req.params.id, (tasks) => {
        const t = tasks.find((t) => t.id === req.params.task);
        if (!t) throw fail('Task not found.', 404);
        Object.assign(t, req.body, { updatedAt: new Date().toISOString() });
        if (req.body.title !== undefined) t.title = req.body.title.trim();
        return t;
      });
      res.json({ task });
    }),
  );
  app.delete(
    '/api/project-data/:id/tasks/:task',
    wrap(async (req, res) => {
      await mutateTasks(req.params.id, (tasks) => {
        const index = tasks.findIndex((t) => t.id === req.params.task);
        if (index < 0) throw fail('Task not found.', 404);
        tasks.splice(index, 1);
      });
      res.json({ ok: true });
    }),
  );
}
