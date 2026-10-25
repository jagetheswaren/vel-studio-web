import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { safeFile } from './store.js';
export class Revisions {
  constructor(store, rootFor) {
    this.store = store;
    this.rootFor = rootFor;
    this.queues = new Map();
  }
  name(workspace, p) {
    return (
      'history-' +
      crypto
        .createHash('sha256')
        .update(workspace + '\0' + p)
        .digest('hex')
    );
  }
  async list(workspace, p) {
    await safeFile(await this.rootFor(workspace), p);
    return this.store.read(this.name(workspace, p), []);
  }
  async save(workspace, p, content, { create = false } = {}) {
    const key = this.name(workspace, p),
      previous = this.queues.get(key) || Promise.resolve();
    const op = previous
      .catch(() => {})
      .then(async () => {
        const root = await this.rootFor(workspace),
          file = await safeFile(root, p, { create: true });
        let old = null;
        try {
          old = await fs.readFile(file, 'utf8');
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        if (create && old !== null)
          throw Object.assign(new Error('A file already exists at that path.'), { code: 'EEXIST' });
        if (old === content) return;
        if (old !== null) {
          const entries = await this.store.read(key, []);
          entries.unshift({
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            bytes: Buffer.byteLength(old),
            content: old,
          });
          await this.store.write(key, entries.slice(0, 20));
        }
        const temp = path.join(path.dirname(file), '.vel-save-' + crypto.randomUUID());
        try {
          await fs.writeFile(temp, content, { flag: 'wx' });
          await fs.rename(temp, file);
        } finally {
          await fs.rm(temp, { force: true });
        }
      });
    this.queues.set(key, op);
    try {
      await op;
    } finally {
      if (this.queues.get(key) === op) this.queues.delete(key);
    }
  }
  async restore(workspace, p, id) {
    const revision = (await this.list(workspace, p)).find((r) => r.id === id);
    if (!revision) throw Object.assign(new Error('Revision not found.'), { status: 404 });
    await this.save(workspace, p, revision.content);
    return revision.content;
  }
}
