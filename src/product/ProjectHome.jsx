import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  ArrowUpRight,
  Box,
  Frame,
  Columns3,
  Archive,
  ArchiveRestore,
  Pencil,
  Play,
  FolderOpen,
  X,
  LoaderCircle,
  Layers3,
  Check,
  Sparkles,
} from 'lucide-react';
import './product.css';

async function request(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Vel-Client': 'local' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Project request failed.');
  return result;
}
const timeLabel = (value) => {
  if (!value) return 'Local project';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? 'Local project'
    : `Updated ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};
const sizeLabel = (bytes) =>
  !bytes
    ? '0 KB'
    : bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function ProjectHome({
  onOpen,
  onLaunch,
  onError,
  onPreferences,
  onConnections,
  refreshKey = 0,
  createRequested = 0,
}) {
  const [projects, setProjects] = useState([]),
    [templates, setTemplates] = useState([]),
    [query, setQuery] = useState(''),
    [archived, setArchived] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(''),
    [dialog, setDialog] = useState(null),
    [error, setError] = useState('');
  const [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [template, setTemplate] = useState('starter');
  async function reload() {
    const result = await request('/api/projects');
    setProjects(result.projects);
  }
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([request('/api/projects'), request('/api/project-templates')])
      .then(([a, b]) => {
        if (!cancelled) {
          setProjects(a.projects);
          setTemplates(b.templates);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  useEffect(() => {
    if (createRequested) startCreate();
  }, [createRequested]);
  useEffect(() => {
    if (!dialog) return;
    const escape = (e) => {
      if (e.key === 'Escape' && !busy) setDialog(null);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [dialog, busy]);
  const visible = useMemo(
    () =>
      projects.filter(
        (p) =>
          !!p.archived === archived &&
          `${p.name} ${p.description || ''}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [projects, archived, query],
  );
  function startCreate() {
    setName('');
    setDescription('');
    setTemplate('starter');
    setError('');
    setDialog({ type: 'create' });
  }
  function editProject(project) {
    setName(project.name);
    setDescription(project.description || '');
    setError('');
    setDialog({ type: 'edit', project });
  }
  async function submit(e) {
    e.preventDefault();
    setBusy('dialog');
    setError('');
    try {
      if (dialog.type === 'create') {
        const project = await request('/api/workspaces', {
          name: name.trim(),
          description: description.trim(),
          template,
        });
        await reload();
        setDialog(null);
        await onOpen(project);
      } else {
        await request(
          `/api/workspaces/${dialog.project.id}`,
          { name: name.trim(), description: description.trim() },
          'PATCH',
        );
        await reload();
        setDialog(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  async function archive(project) {
    setBusy(project.id);
    try {
      await request(`/api/workspaces/${project.id}`, { archived: !project.archived }, 'PATCH');
      await reload();
    } catch (e) {
      onError(e);
    } finally {
      setBusy('');
    }
  }
  return (
    <main className="project-home" aria-label="Projects home">
      <div className="project-home-inner">
        <nav className="home-topline">
          <span>
            <i />
            LOCAL CREATIVE WORKSPACE
          </span>
          <div>
            <button onClick={onConnections}>
              <Sparkles size={14} />
              AI connections
            </button>
            <button onClick={onPreferences}>
              Workspace settings <ArrowUpRight size={13} />
            </button>
          </div>
        </nav>
        <section className="home-hero">
          <div>
            <span className="product-eyebrow">VEL STUDIO / YOUR PROJECTS</span>
            <h1>
              Make your next
              <br />
              idea <em>real.</em>
            </h1>
            <p>
              A canvas for the idea. An editor for the details.
              <br />A working application you can launch.
            </p>
            <div className="home-hero-actions">
              <button className="product-primary" onClick={startCreate}>
                <Plus size={17} />
                New project
              </button>
              <span>Design · Code · Build worlds</span>
            </div>
          </div>
          <div className="home-hero-art" aria-hidden="true">
            <div className="hero-editor-window">
              <div className="hero-editor-header">
                <span />
                <span />
                <span />
                <small>your-next-idea.vel</small>
              </div>
              <div className="hero-editor-body">
                <div className="hero-code-lines">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="hero-design">
                  <div className="hero-shape-back" />
                  <div className="hero-shape-front" />
                  <span>Ideas, in motion.</span>
                  <i />
                  <b />
                </div>
              </div>
              <div className="hero-editor-footer">
                <span />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="hero-floating-label">
              <Layers3 size={15} />
              <span>One connected workspace</span>
            </div>
          </div>
        </section>
        <section className="projects-section">
          <header className="projects-heading">
            <div>
              <h2>{archived ? 'Archived projects' : 'Your projects'}</h2>
              <span>
                {loading
                  ? 'Opening your workspace…'
                  : `${visible.length} ${visible.length === 1 ? 'project' : 'projects'}${query ? ' found' : ''}`}
              </span>
            </div>
            <div className="project-filters">
              <label>
                <Search size={15} />
                <input
                  aria-label="Search projects"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a project…"
                />
              </label>
              <button
                className={archived ? 'selected' : ''}
                aria-pressed={archived}
                onClick={() => setArchived(!archived)}
              >
                <Archive size={15} />
                <span>Archived</span>
              </button>
            </div>
          </header>
          {error && !dialog && (
            <div className="product-error" role="alert">
              {error}
              <button
                onClick={() => {
                  setError('');
                  reload().catch((e) => setError(e.message));
                }}
              >
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <div className="projects-loading">
              <LoaderCircle className="spin" size={22} />
              <span>Loading your projects…</span>
            </div>
          ) : visible.length ? (
            <div className="project-grid">
              {visible.map((project) => (
                <article
                  className={`project-card template-${project.template || 'starter'} ${project.archived ? 'archived' : ''}`}
                  key={project.id}
                >
                  <button
                    className="project-thumbnail"
                    onClick={() => onOpen(project)}
                    aria-label={`Open ${project.name}`}
                  >
                    <ProjectThumbnail template={project.template} />
                    <span className="project-preview-label">TEMPLATE PREVIEW</span>
                    <span className="project-open-label">
                      Open project <ArrowUpRight size={14} />
                    </span>
                  </button>
                  <div className="project-card-content">
                    <div className="project-card-title">
                      <button onClick={() => onOpen(project)}>{project.name}</button>
                      <button
                        title={`Edit ${project.name}`}
                        aria-label={`Edit ${project.name}`}
                        onClick={() => editProject(project)}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                    <p>{project.description || 'An open space for your next idea.'}</p>
                    <div className="project-metadata">
                      <span>
                        {templates.find((t) => t.id === project.template)?.name || 'Studio project'}
                      </span>
                      <span>
                        {project.fileCount ?? 0} files · {sizeLabel(project.totalBytes)}
                      </span>
                    </div>
                    <footer>
                      <span>{timeLabel(project.updatedAt)}</span>
                      <div>
                        <button
                          title={project.archived ? 'Restore project' : 'Archive project'}
                          aria-label={`${project.archived ? 'Restore' : 'Archive'} ${project.name}`}
                          disabled={busy === project.id}
                          onClick={() => archive(project)}
                        >
                          {project.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                        </button>
                        <button
                          className="project-launch"
                          title="Launch saved project"
                          onClick={() => onLaunch(project.id, false)}
                        >
                          <Play size={12} fill="currentColor" />
                          Launch
                        </button>
                      </div>
                    </footer>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="projects-empty">
              <FolderOpen size={29} />
              <h3>
                {query
                  ? 'No projects match your search.'
                  : archived
                    ? 'A little room for later.'
                    : 'Your next project starts here.'}
              </h3>
              <p>
                {query
                  ? 'Try another name or clear your search.'
                  : archived
                    ? 'Archived projects will appear here. You can restore them anytime.'
                    : 'Create a studio or start with a working fullstack taskboard.'}
              </p>
              {!query && !archived && (
                <button className="product-primary" onClick={startCreate}>
                  <Plus size={15} />
                  Create a project
                </button>
              )}
            </div>
          )}
        </section>
        <footer className="home-footer">
          <span>
            <i />
            Projects stay on this computer.
          </span>
          <button onClick={onPreferences}>
            Shape your workspace <ArrowUpRight size={12} />
          </button>
        </footer>
      </div>
      {dialog && (
        <div
          className="product-dialog-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setDialog(null);
          }}
        >
          <section
            className="product-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={dialog.type === 'create' ? 'Create project' : 'Edit project'}
          >
            <header>
              <div>
                <span className="product-eyebrow">YOUR NEXT CHAPTER</span>
                <h2>
                  {dialog.type === 'create' ? 'What will you make?' : 'A place for your idea.'}
                </h2>
              </div>
              <button
                aria-label="Close project dialog"
                onClick={() => setDialog(null)}
                disabled={!!busy}
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={submit}>
              <label className="product-field">
                Project name
                <input
                  autoFocus
                  required
                  maxLength={60}
                  placeholder="Give your idea a name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="product-field">
                Description <small>Optional</small>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="What are you creating?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              {dialog.type === 'create' && (
                <>
                  <span className="product-field-title">Start with a foundation</span>
                  <div className="project-template-options">
                    {templates.map((t) => (
                      <button
                        type="button"
                        className={template === t.id ? 'selected' : ''}
                        key={t.id}
                        onClick={() => setTemplate(t.id)}
                      >
                        <span>
                          {t.id === 'taskboard' ? (
                            <Columns3 size={20} />
                          ) : t.id === 'game' ? (
                            <Box size={20} />
                          ) : (
                            <Frame size={20} />
                          )}
                        </span>
                        <div>
                          <strong>{t.name}</strong>
                          <p>{t.description}</p>
                          <small>{t.category}</small>
                        </div>
                        {template === t.id && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                  {!templates.length && (
                    <p className="product-note">
                      Templates are unavailable. Close this dialog and refresh the projects home.
                    </p>
                  )}
                </>
              )}
              {error && (
                <div className="product-error" role="alert">
                  {error}
                </div>
              )}
              <div className="product-dialog-actions">
                <button type="button" onClick={() => setDialog(null)} disabled={!!busy}>
                  Cancel
                </button>
                <button
                  className="product-primary"
                  disabled={
                    !!busy || !name.trim() || (dialog.type === 'create' && !templates.length)
                  }
                >
                  {busy === 'dialog' ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Plus size={15} />
                  )}{' '}
                  {dialog.type === 'create' ? 'Create project' : 'Save project'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function ProjectThumbnail({ template }) {
  if (template === 'taskboard')
    return (
      <div className="thumbnail-taskboard" aria-hidden="true">
        <div>
          <i />
          <span>Team workspace</span>
          <b>Today, in focus.</b>
        </div>
        <section>
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <span>{['TO DO', 'IN PROGRESS', 'DONE'][i]}</span>
              {[0, 1, 2].slice(0, i === 1 ? 2 : 3).map((j) => (
                <article key={j}>
                  <i />
                  <b />
                  <em />
                </article>
              ))}
            </div>
          ))}
        </section>
      </div>
    );
  if (template === 'game')
    return (
      <div className="thumbnail-game" aria-hidden="true">
        <span className="game-grid" />
        <span className="game-cube" />
        <span className="game-sphere" />
        <span className="game-ring" />
        <div>
          <small>3D SCENE</small>
          <strong>A world in the making.</strong>
        </div>
      </div>
    );
  if (template === 'blank')
    return (
      <div className="thumbnail-blank" aria-hidden="true">
        <span>
          <Frame size={30} />
        </span>
        <i />
        <small>THE POSSIBILITIES ARE OPEN.</small>
      </div>
    );
  return (
    <div className="thumbnail-design" aria-hidden="true">
      <span>◈ FORMA</span>
      <strong>
        Design it.
        <br />
        Bring it to life.
      </strong>
      <i />
      <b />
      <em>CREATE SOMETHING →</em>
    </div>
  );
}
