import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Store, safeFile, listFiles } from './store.js';
import { compilePreview, starter } from './preview.js';
import { validateEndpoint, getModels, chat, requestJson } from './providers.js';
import {
  createStudioTemplate,
  studioTemplates,
  serializeStudio,
  parseStudio,
  isStudioSource,
} from '../shared/studio.js';
import { compileStudio } from './studio.js';
import { installProductRoutes } from './product.js';
import { projectTemplates, taskboardFiles } from './project-template.js';
import { Revisions } from './revisions.js';
const exec = promisify(execFile);
const defaults = {
  providers: [
    {
      id: 'ollama',
      name: 'Ollama · local',
      type: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: '',
      secret: '',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: '',
      secret: '',
    },
    {
      id: 'compatible',
      name: 'OpenAI-compatible',
      type: 'compatible',
      baseUrl: 'http://127.0.0.1:1234/v1',
      model: '',
      secret: '',
    },
  ],
  activeProvider: 'ollama',
  compilerPath: '',
};
const publicProvider = ({ secret, ...p }) => ({ ...p, hasKey: Boolean(secret) });
const publicPlugin = ({ secret, ...p }) => ({ ...p, hasKey: Boolean(secret) });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const text = (s, max = 200) => typeof s === 'string' && s.length <= max;

export async function createApp({ dataDir = path.resolve('.vel-data') } = {}) {
  const store = new Store(dataDir);
  await store.init();
  const workspaceRoot = path.join(dataDir, 'workspaces');
  await fs.mkdir(workspaceRoot, { recursive: true });
  let workspaces = await store.read('workspaces', null);
  if (!workspaces) {
    workspaces = [{ id: 'welcome', name: 'motion-studio' }];
    const root = path.join(workspaceRoot, 'welcome');
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/main.vel'), starter);
    await fs.writeFile(
      path.join(root, 'README.md'),
      '# motion-studio\n\nA working Vel Preview DSL project. Open src/main.vel to begin.\n\nThis preview subset is independent of the official Vel native compiler.\n',
    );
    await store.write('workspaces', workspaces);
  }
  // Add the new example once without changing any existing user source files.
  const welcome = path.join(workspaceRoot, 'welcome', 'src', 'studio.vel');
  if (workspaces.some((w) => w.id === 'welcome')) {
    try {
      await fs.writeFile(welcome, serializeStudio(createStudioTemplate()), { flag: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  workspaces = workspaces.map((w) => ({
    description: '',
    template: 'starter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: false,
    ...w,
  }));
  await store.write('workspaces', workspaces);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.hostname;
    if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host))
      return res.status(403).json({ error: 'VEL IDE accepts localhost requests only.' });
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) {
      res.set('Cache-Control', 'no-store');
      const projectData = req.path.startsWith('/api/project-data/');
      if (
        !projectData &&
        req.headers.origin &&
        req.headers.origin !== `${req.protocol}://${req.headers.host}`
      )
        return res.status(403).json({ error: 'Cross-origin API requests are not allowed.' });
      if (
        !projectData &&
        !['GET', 'HEAD'].includes(req.method) &&
        req.headers['x-vel-client'] !== 'local'
      )
        return res.status(403).json({ error: 'Missing local client header.' });
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  async function rootFor(id) {
    if (typeof id !== 'string' || !workspaces.some((w) => w.id === id))
      throw fail('Workspace not found.', 404);
    return path.join(workspaceRoot, id);
  }
  async function provider(id) {
    const s = await store.read('settings', defaults);
    const p = s.providers.find((x) => x.id === id);
    if (!p) throw fail('Provider not found.', 404);
    return [
      p,
      store.unseal(p.secret) || (p.type === 'openai' ? process.env.OPENAI_API_KEY || '' : ''),
    ];
  }
  async function setWorkspaces(next) {
    workspaces = next;
    await store.write('workspaces', workspaces);
  }
  async function touchWorkspace(id) {
    await setWorkspaces(
      workspaces.map((w) => (w.id === id ? { ...w, updatedAt: new Date().toISOString() } : w)),
    );
  }
  const revisions = new Revisions(store, rootFor);
  installProductRoutes(app, {
    store,
    rootFor,
    getWorkspaces: () => workspaces,
    setWorkspaces,
    revisions,
    touchWorkspace,
  });
  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      version: '0.3.0',
      renderer: 'Vel Studio + Preview DSL',
      features: ['projects', 'preferences', 'revisions', 'launch', 'taskboard-api'],
    }),
  );
  app.get('/api/studio/templates', (_req, res) =>
    res.json({
      templates: studioTemplates.map((t) => ({
        ...t,
        source: serializeStudio(createStudioTemplate(t.id)),
      })),
    }),
  );
  app.post(
    '/api/studio/export',
    wrap(async (req, res) => {
      const doc = parseStudio(req.body.source),
        result = compileStudio(req.body.source);
      const filename =
        (doc.name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'vel-studio') + '.html';
      res.attachment(filename).type('html').send(result.html);
    }),
  );
  app.get('/api/workspaces', (_req, res) => res.json({ workspaces, activeId: workspaces[0].id }));
  app.post(
    '/api/workspaces',
    wrap(async (req, res) => {
      const { name, description = '', template = 'starter' } = req.body;
      if (!text(name, 60) || !name.trim()) throw fail('Workspace name must be 1–60 characters.');
      if (!text(description, 500) || !projectTemplates.some((t) => t.id === template))
        throw fail('Choose a valid template and description under 500 characters.');
      const now = new Date().toISOString(),
        w = {
          id: crypto.randomUUID(),
          name: name.trim(),
          description,
          template,
          createdAt: now,
          updatedAt: now,
          archived: false,
        };
      const root = path.join(workspaceRoot, w.id);
      await fs.mkdir(root, { recursive: true });
      if (template === 'taskboard') {
        for (const [p, content] of Object.entries(taskboardFiles))
          await fs.writeFile(await safeFile(root, p, { create: true }), content);
      } else {
        await fs.mkdir(path.join(root, 'src'));
        await fs.writeFile(path.join(root, 'src/main.vel'), starter);
        await fs.writeFile(
          path.join(root, 'src/studio.vel'),
          serializeStudio(createStudioTemplate(template)),
        );
      }
      workspaces.push(w);
      await store.write('workspaces', workspaces);
      res.status(201).json(w);
    }),
  );
  app.get(
    '/api/files',
    wrap(async (req, res) =>
      res.json({ files: await listFiles(await rootFor(req.query.workspace)) }),
    ),
  );
  app.get(
    '/api/file',
    wrap(async (req, res) => {
      const file = await safeFile(await rootFor(req.query.workspace), req.query.path);
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > 500000) throw fail('Open a text file under 500 KB.');
      const content = await fs.readFile(file, 'utf8');
      if (content.includes('\0')) throw fail('Binary files cannot be edited.');
      res.json({ content });
    }),
  );
  app.put(
    '/api/file',
    wrap(async (req, res) => {
      const { workspace, path: p, content, create } = req.body;
      if (!text(content, 500000) || Buffer.byteLength(content) > 500000)
        throw fail('File content must be text under 500 KB.');
      await revisions.save(workspace, p, content, { create });
      await touchWorkspace(workspace);
      res.json({ ok: true });
    }),
  );
  app.delete(
    '/api/file',
    wrap(async (req, res) => {
      await fs.unlink(await safeFile(await rootFor(req.body.workspace), req.body.path));
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/preview',
    wrap(async (req, res) => {
      const result = compilePreview(req.body.source, req.body.path);
      const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
      result.html = '<!doctype html>' + csp + result.html.replace(/<!doctype[^>]*>/gi, '');
      res.json(result);
    }),
  );
  app.get(
    '/api/settings',
    wrap(async (_req, res) => {
      const s = await store.read('settings', defaults);
      res.json({ ...s, providers: s.providers.map(publicProvider) });
    }),
  );
  app.put(
    '/api/settings',
    wrap(async (req, res) => {
      const { providers, activeProvider, compilerPath = '' } = req.body;
      const old = await store.read('settings', defaults);
      if (
        !Array.isArray(providers) ||
        !providers.length ||
        providers.length > 20 ||
        !text(compilerPath, 500)
      )
        throw fail('Invalid provider settings.');
      const ids = new Set();
      const normalized = providers.map((p) => {
        if (
          !text(p.id, 60) ||
          !p.id ||
          ids.has(p.id) ||
          !text(p.name, 80) ||
          !p.name ||
          !['ollama', 'openai', 'compatible'].includes(p.type) ||
          !text(p.model ?? '', 200) ||
          !text(p.apiKey ?? '', 1000)
        )
          throw fail('Each provider needs a unique ID, name, valid type and model.');
        ids.add(p.id);
        const existing = old.providers.find((x) => x.id === p.id);
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          baseUrl: validateEndpoint(p.baseUrl),
          model: p.model || '',
          secret: p.clearKey ? '' : p.apiKey ? store.seal(p.apiKey) : existing?.secret || '',
        };
      });
      if (!ids.has(activeProvider)) throw fail('Select an existing active provider.');
      if (compilerPath && !path.isAbsolute(compilerPath))
        throw fail('Compiler path must be an absolute executable path.');
      const s = { providers: normalized, activeProvider, compilerPath };
      await store.write('settings', s);
      res.json({ ...s, providers: normalized.map(publicProvider) });
    }),
  );
  app.post(
    '/api/models',
    wrap(async (req, res) => {
      const [p, key] = await provider(req.body.providerId);
      res.json({ models: await getModels(p, key) });
    }),
  );
  app.post(
    '/api/chat',
    wrap(async (req, res) => {
      const [p, key] = await provider(req.body.providerId);
      if (p.type === 'openai' && !key && !process.env.OPENAI_API_KEY)
        throw fail('Add an OpenAI API key in Connections.');
      res.json({
        content: await chat(p, key || (p.type === 'openai' ? process.env.OPENAI_API_KEY : ''), {
          ...req.body,
          model: req.body.model || p.model,
        }),
      });
    }),
  );
  app.get(
    '/api/plugins',
    wrap(async (_req, res) =>
      res.json({ plugins: (await store.read('plugins', [])).map(publicPlugin) }),
    ),
  );
  app.post(
    '/api/plugins',
    wrap(async (req, res) => {
      const { name, description = '', url, apiKey = '' } = req.body;
      if (!text(name, 80) || !name.trim() || !text(description, 500) || !text(apiKey, 1000))
        throw fail('Plugin needs a name and valid connection settings.');
      const plugins = await store.read('plugins', []);
      if (plugins.length >= 30) throw fail('Maximum 30 plugins.');
      const p = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description,
        url: validateEndpoint(url),
        enabled: false,
        secret: store.seal(apiKey),
      };
      plugins.push(p);
      await store.write('plugins', plugins);
      res.status(201).json(publicPlugin(p));
    }),
  );
  app.patch(
    '/api/plugins/:id',
    wrap(async (req, res) => {
      if (typeof req.body.enabled !== 'boolean') throw fail('enabled must be true or false.');
      const plugins = await store.read('plugins', []),
        p = plugins.find((x) => x.id === req.params.id);
      if (!p) throw fail('Plugin not found.', 404);
      p.enabled = req.body.enabled;
      await store.write('plugins', plugins);
      res.json(publicPlugin(p));
    }),
  );
  app.delete(
    '/api/plugins/:id',
    wrap(async (req, res) => {
      const plugins = await store.read('plugins', []);
      if (!plugins.some((p) => p.id === req.params.id)) throw fail('Plugin not found.', 404);
      await store.write(
        'plugins',
        plugins.filter((p) => p.id !== req.params.id),
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    '/api/plugins/:id/run',
    wrap(async (req, res) => {
      const plugins = await store.read('plugins', []),
        p = plugins.find((x) => x.id === req.params.id);
      if (!p) throw fail('Plugin not found.', 404);
      if (!p.enabled) throw fail('Enable this plugin before running it.');
      if (!text(req.body.input, 50000)) throw fail('Plugin input must be text under 50 KB.');
      res.json({
        output: await requestJson(p.url, {
          method: 'POST',
          body: { input: req.body.input },
          key: store.unseal(p.secret),
        }),
      });
    }),
  );
  async function nativeBuild(workspace, p) {
    const settings = await store.read('settings', defaults);
    if (!settings.compilerPath)
      throw fail(
        'Native compiler is not configured. Install Vel separately and set its executable path in Connections.',
      );
    if (!/\.vel$/i.test(p)) throw fail('Select a .vel source file.');
    const root = await rootFor(workspace),
      file = await safeFile(root, p);
    try {
      const { stdout, stderr } = await exec(settings.compilerPath, [file], {
        cwd: root,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      return { output: stdout + stderr || 'Compiler finished successfully.', exitCode: 0 };
    } catch (e) {
      if (e.code === 'ENOENT') throw fail('Compiler executable was not found. Check Connections.');
      return {
        output:
          (e.stdout || '') + (e.stderr || '') + (e.killed ? '\nCompiler timed out.' : '') ||
          'Compiler failed. Check the executable and command-line compatibility.',
        exitCode: typeof e.code === 'number' ? e.code : 1,
      };
    }
  }
  app.post(
    '/api/native-build',
    wrap(async (req, res) => res.json(await nativeBuild(req.body.workspace, req.body.path))),
  );
  app.post(
    '/api/terminal',
    wrap(async (req, res) => {
      const root = await rootFor(req.body.workspace),
        command = req.body.command;
      if (!text(command, 400)) throw fail('Command must be text under 400 characters.');
      let output = '',
        exitCode = 0;
      const [cmd, ...args] = command.trim().split(/\s+/),
        p = args.join(' ');
      if (cmd === 'help')
        output =
          'Workspace console (not a system shell)\nhelp               Show commands\nls                 List workspace files\ncat PATH           Read a text file\ncheck PATH         Validate preview DSL\nbuild PATH         Export preview to build/index.html\ngit status         Show repository status\nNative compilation: use Run native after configuring a compiler.';
      else if (cmd === 'ls') output = (await listFiles(root)).map((f) => f.path).join('\n');
      else if (cmd === 'cat') {
        const file = await safeFile(root, p);
        if ((await fs.stat(file)).size > 500000) throw fail('File is too large.');
        output = await fs.readFile(file, 'utf8');
      } else if (cmd === 'check' || cmd === 'build') {
        const source = await fs.readFile(await safeFile(root, p), 'utf8'),
          result = compilePreview(source, p);
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        output = result.diagnostics
          .map((d) => `${d.severity} ${p}:${d.line} ${d.message}`)
          .join('\n');
        exitCode = errors.length ? 1 : 0;
        if (!errors.length) {
          if (cmd === 'build') {
            await fs.writeFile(
              await safeFile(root, 'build/index.html', { create: true }),
              result.html,
            );
            output += '\nBuilt build/index.html';
          } else output += '\nPreview validation passed.';
        }
      } else if (cmd === 'git' && p === 'status') {
        try {
          const r = await exec('git', ['status', '--short'], {
            cwd: root,
            timeout: 10000,
            maxBuffer: 100000,
            windowsHide: true,
          });
          output = r.stdout || 'Working tree clean.';
        } catch {
          output = 'This workspace is not a Git repository (or Git is unavailable).';
          exitCode = 1;
        }
      } else {
        output = `Unknown command: ${cmd || '(empty)'}. Type help for supported workspace commands.`;
        exitCode = 1;
      }
      res.json({ output, exitCode });
    }),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use((err, _req, res, _next) => {
    const status = err.status || { ENOENT: 404, EEXIST: 409, EISDIR: 400 }[err.code] || 400;
    res.status(status).json({
      error:
        err.code === 'ENOENT'
          ? 'File not found.'
          : err.code === 'EEXIST'
            ? 'A file already exists at that path.'
            : err.type === 'entity.too.large'
              ? 'Request exceeds 1 MB.'
              : err.message || 'Request failed.',
    });
  });
  return { app, store };
}
