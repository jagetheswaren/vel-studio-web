import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class Store {
  constructor(root) {
    this.root = root;
    this.queue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(this.root, { recursive: true });
    const keyPath = path.join(this.root, '.secret-key');
    try {
      this.key = await fs.readFile(keyPath);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      this.key = crypto.randomBytes(32);
      await fs.writeFile(keyPath, this.key, { mode: 0o600, flag: 'wx' });
    }
  }
  async read(name, fallback) {
    try {
      return JSON.parse(await fs.readFile(path.join(this.root, name + '.json'), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return structuredClone(fallback);
      throw e;
    }
  }
  async write(name, value) {
    const op = this.queue.then(async () => {
      const target = path.join(this.root, name + '.json'),
        tmp = target + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
      await fs.rename(tmp, target);
    });
    this.queue = op.catch(() => {});
    return op;
  }
  seal(value) {
    if (!value) return '';
    const iv = crypto.randomBytes(12),
      c = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([c.update(value, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), encrypted]).toString('base64');
  }
  unseal(value) {
    if (!value) return '';
    const b = Buffer.from(value, 'base64'),
      d = crypto.createDecipheriv('aes-256-gcm', this.key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  }
}

export async function safeFile(root, relative, { create = false } = {}) {
  if (
    typeof relative !== 'string' ||
    !relative ||
    relative.length > 240 ||
    /[\x00-\x1f:]/.test(relative) ||
    relative.includes('\\') ||
    path.isAbsolute(relative) ||
    relative
      .split('/')
      .some(
        (s) =>
          !s ||
          s === '.' ||
          s === '..' ||
          s.startsWith('.') ||
          /[<>"|?*]/.test(s) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s) ||
          /[. ]$/.test(s),
      )
  )
    throw new Error('Use a relative file path without hidden files, traversal or reserved names.');
  const canonical = await fs.realpath(root);
  let current = canonical;
  const parts = relative.split('/');
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not allowed.');
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error('Parent must be a folder.');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      if (!create) throw e;
      if (i < parts.length - 1) await fs.mkdir(current);
    }
  }
  if (!current.startsWith(canonical + path.sep)) throw new Error('File is outside workspace.');
  return current;
}
export async function listFiles(root, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink())
      continue;
    const p = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) result.push(...(await listFiles(root, p)));
    else if (entry.isFile())
      result.push({ path: p, size: (await fs.stat(path.join(root, p))).size });
    if (result.length > 2000) throw new Error('Workspace exceeds 2000 files.');
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
