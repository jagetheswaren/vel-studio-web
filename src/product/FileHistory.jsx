import React, { useEffect, useState } from 'react';
import { History, RotateCcw, LoaderCircle, FileCode2 } from 'lucide-react';
import './product.css';
async function request(path, body) {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Vel-Client': 'local' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'History request failed.');
  return data;
}
export default function FileHistory({
  workspace,
  path,
  dirty,
  onRestored,
  onClose,
  onBeforeRestore,
}) {
  const [revisions, setRevisions] = useState([]),
    [selected, setSelected] = useState(null),
    [content, setContent] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const base = `workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}`;
  useEffect(() => {
    let current = true;
    request(`/api/history?${base}`)
      .then((d) => {
        if (current) setRevisions(d.revisions);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [base]);
  useEffect(() => {
    if (!selected) return;
    let current = true;
    setBusy(true);
    request(`/api/history/revision?${base}&id=${encodeURIComponent(selected)}`)
      .then((d) => {
        if (current) setContent(d.content);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [selected, base]);
  async function restore() {
    if (!selected) return;
    if (
      !confirm(
        dirty
          ? 'This file has unsaved changes. Replace the editor buffer and saved file with this revision?'
          : 'Restore this revision as the current saved file?',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await onBeforeRestore?.();
      const d = await request('/api/history/restore', { workspace, path, id: selected });
      onRestored(d.content);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="file-history">
      <div className="history-heading">
        <FileCode2 size={16} />
        <strong>{path}</strong>
        <span>Up to 20 previous saved versions</span>
      </div>
      {error && (
        <div className="product-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="history-empty">
          <LoaderCircle size={21} className="spin" />
          Loading saved revisions…
        </div>
      ) : !revisions.length ? (
        <div className="history-empty">
          <History size={30} />
          <h3>Your file’s story starts here.</h3>
          <p>
            Previous versions appear after the file is changed and saved.
            <br />
            There are no saved revisions to restore yet.
          </p>
        </div>
      ) : (
        <div className="history-layout">
          <nav>
            {revisions.map((r, i) => (
              <button
                className={selected === r.id ? 'selected' : ''}
                key={r.id}
                onClick={() => setSelected(r.id)}
              >
                <History size={14} />
                <span>
                  <strong>{new Date(r.createdAt).toLocaleString()}</strong>
                  <small>
                    {r.bytes} bytes {i === 0 ? '· Most recent revision' : ''}
                  </small>
                </span>
              </button>
            ))}
          </nav>
          <section>
            {selected ? (
              <>
                <div className="history-preview-heading">
                  <span>REVISION PREVIEW</span>
                  <button className="product-primary" disabled={busy} onClick={restore}>
                    <RotateCcw size={13} />
                    Restore revision
                  </button>
                </div>
                {busy ? (
                  <div className="history-empty">
                    <LoaderCircle size={20} className="spin" />
                    Loading revision…
                  </div>
                ) : (
                  <pre>{content}</pre>
                )}
              </>
            ) : (
              <div className="history-empty">
                <History size={24} />
                <span>Select a revision to review its contents.</span>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
