import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import {
  Files,
  Search,
  GitBranch,
  Play,
  Square,
  Settings,
  Sparkles,
  Box,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Save,
  RefreshCw,
  Monitor,
  Smartphone,
  Terminal,
  AlertCircle,
  SlidersHorizontal,
  Send,
  Plug,
  BookOpen,
  Check,
  ArrowUpRight,
  LoaderCircle,
  Trash2,
  Folder,
  FileCode2,
  PanelRightClose,
  PanelRightOpen,
  SkipBack,
  Circle,
  Command,
  ExternalLink,
  Layers3,
  Frame,
  Clapperboard,
  Download,
  House,
  History,
  Sliders,
} from 'lucide-react';
import StudioWorkbench from './studio/StudioWorkbench.jsx';
import ProjectHome from './product/ProjectHome.jsx';
import Preferences, { defaultPreferences } from './product/Preferences.jsx';
import FileHistory from './product/FileHistory.jsx';
import { isStudioSource } from '../shared/studio.js';
import './styles.css';

self.MonacoEnvironment = {
  getWorker: (_moduleId, label) =>
    label === 'json'
      ? new JsonWorker()
      : ['html', 'handlebars', 'razor'].includes(label)
        ? new HtmlWorker()
        : ['javascript', 'typescript'].includes(label)
          ? new TsWorker()
          : ['css', 'scss', 'less'].includes(label)
            ? new CssWorker()
            : new EditorWorker(),
};
loader.config({ monaco });
monaco.languages.register({ id: 'vel' });
monaco.languages.setMonarchTokensProvider('vel', {
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/#\w+/, 'type.identifier'],
      [/@[\w.]+|\$[\w.]+/, 'variable'],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/\b(V|H|Card|T|Btn|In|Progress|Badge|Orb|Divider)\b/, 'keyword'],
      [/\b[\w.]+(?==)/, 'attribute.name'],
      [/\b\d+(\.\d+)?\b/, 'number'],
    ],
  },
});
monaco.editor.defineTheme('vel-night', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'B8A2F1' },
    { token: 'type.identifier', foreground: 'B8A2F1' },
    { token: 'string', foreground: '75DEC3' },
    { token: 'attribute.name', foreground: '92CBE6' },
    { token: 'variable', foreground: 'E4C483' },
    { token: 'comment', foreground: '727E8E' },
  ],
  colors: {
    'editor.background': '#13181F',
    'editor.foreground': '#D8E0EB',
    'editorLineNumber.foreground': '#5B6676',
    'editor.lineHighlightBackground': '#1A222C',
    'editor.selectionBackground': '#33485A',
    'editorCursor.foreground': '#6CE8BA',
    'editorGutter.background': '#13181F',
  },
});

async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Vel-Client': 'local' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const fileIcon = (path) =>
  path.endsWith('.vel') ? 'vel' : path.endsWith('.html') ? 'html' : 'text';
function IconButton({ icon: Icon, title, onClick, active, className = '', ...props }) {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''} ${className}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      {...props}
    >
      <Icon size={17} />
    </button>
  );
}
function Modal({ title, eyebrow, children, onClose, wide = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = [
          ...dialog.current.querySelectorAll('button,input,select,textarea,a[href]'),
        ].filter((x) => !x.disabled);
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <header>
          <div>
            <span className="eyebrow">{eyebrow || 'VEL WORKSPACE'}</span>
            <h2>{title}</h2>
          </div>
          <IconButton icon={X} title="Close dialog" onClick={onClose} />
        </header>
        {children}
      </section>
    </div>
  );
}
function App() {
  const [workspaces, setWorkspaces] = useState([]),
    [workspace, setWorkspace] = useState(''),
    [files, setFiles] = useState([]);
  const [docs, setDocs] = useState({}),
    [saved, setSaved] = useState({}),
    [tabs, setTabs] = useState([]),
    [active, setActive] = useState('');
  const [mode, setMode] = useState('Code'),
    [bottom, setBottom] = useState('Timeline'),
    [side, setSide] = useState('Assistant');
  const [modal, setModal] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState({ html: '', diagnostics: [], tracks: [], duration: 1000 }),
    [previewBusy, setPreviewBusy] = useState(false),
    [device, setDevice] = useState('Desktop');
  const [settings, setSettings] = useState({ providers: [], activeProvider: '', compilerPath: '' }),
    [provider, setProvider] = useState(''),
    [model, setModel] = useState(''),
    [models, setModels] = useState([]);
  const [messages, setMessages] = useState([]),
    [prompt, setPrompt] = useState(''),
    [context, setContext] = useState(false),
    [chatBusy, setChatBusy] = useState(false),
    [proposal, setProposal] = useState(null);
  const [logs, setLogs] = useState([
      { text: 'Vel local workspace ready. Type help for available commands.', type: 'info' },
    ]),
    [command, setCommand] = useState('');
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [query, setQuery] = useState(''),
    [cursor, setCursor] = useState({ lineNumber: 1, column: 1 });
  const [templates, setTemplates] = useState([]),
    [templatesLoading, setTemplatesLoading] = useState(false);
  const [home, setHome] = useState(true),
    [preferences, setPreferences] = useState(defaultPreferences),
    [launch, setLaunch] = useState(null),
    [historyTarget, setHistoryTarget] = useState(null),
    [saveState, setSaveState] = useState({ state: 'idle' }),
    [homeVersion, setHomeVersion] = useState(0);
  const iframe = useRef(null),
    editorRef = useRef(null),
    docsRef = useRef(docs),
    activeRef = useRef(active),
    workspaceRef = useRef(workspace),
    lastPreview = useRef(0),
    chatEnd = useRef(null),
    chatRequest = useRef(0),
    fileRequest = useRef(0),
    importInput = useRef(null);
  const savedRef = useRef(saved),
    startupComplete = useRef(false),
    writeQueues = useRef(new Map());
  docsRef.current = docs;
  activeRef.current = active;
  workspaceRef.current = workspace;
  savedRef.current = saved;
  const source = docs[active] ?? '',
    dirty = active && source !== saved[active],
    activeProvider = settings.providers.find((p) => p.id === provider);
  const studioDocument = isStudioSource(source),
    showStudio = (studioDocument && mode !== 'Code') || mode === 'Scene';
  const taskboardProject = workspaces.find((w) => w.id === workspace)?.template === 'taskboard';
  async function makePreview(content, path, id = workspaceRef.current) {
    return workspaces.find((w) => w.id === id)?.template === 'taskboard'
      ? api(`/api/workspaces/${encodeURIComponent(id)}/preview`, { source: content, path })
      : api('/api/preview', { source: content, path });
  }
  const report = (e) => setError(e.message || String(e));
  const flash = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 4000);
  };
  async function loadSettings() {
    const data = await api('/api/settings');
    setSettings(data);
    setProvider(data.activeProvider || data.providers[0]?.id || '');
    const p = data.providers.find((p) => p.id === data.activeProvider) || data.providers[0];
    setModel(p?.model || '');
  }
  async function refreshFiles(id = workspaceRef.current) {
    const data = await api(`/api/files?workspace=${encodeURIComponent(id)}`);
    if (workspaceRef.current === id) setFiles(data.files);
    return data.files;
  }
  async function openFile(path, id = workspaceRef.current) {
    if (workspaceRef.current !== id) return;
    const request = ++fileRequest.current;
    let content = docsRef.current[path];
    if (!(path in docsRef.current)) {
      const data = await api(
        `/api/file?workspace=${encodeURIComponent(id)}&path=${encodeURIComponent(path)}`,
      );
      if (workspaceRef.current !== id || request !== fileRequest.current) return;
      content = data.content;
      setDocs((d) => ({ ...d, [path]: data.content }));
      setSaved((d) => ({ ...d, [path]: data.content }));
    }
    if (workspaceRef.current !== id || request !== fileRequest.current) return;
    setTabs((t) => (t.includes(path) ? t : [...t, path]));
    setActive(path);
    if (isStudioSource(content)) {
      setMode('Design');
      setSide(null);
    } else setMode('Code');
  }
  async function selectWorkspace(id, force = false, session = null) {
    if (
      !force &&
      Object.keys(docsRef.current).some((p) => docsRef.current[p] !== savedRef.current[p]) &&
      !confirm('Switch workspace and discard unsaved changes?')
    )
      return false;
    setWorkspace(id);
    workspaceRef.current = id;
    fileRequest.current++;
    chatRequest.current++;
    lastPreview.current++;
    setDocs({});
    docsRef.current = {};
    setSaved({});
    setTabs([]);
    setActive('');
    setMessages([]);
    setChatBusy(false);
    setPlaying(false);
    setPreviewBusy(false);
    setFiles([]);
    const next = await refreshFiles(id);
    if (workspaceRef.current === id && next.length) {
      const restored = session && next.find((f) => f.path === session.path);
      await openFile(
        restored?.path ||
          next.find((f) => f.path === 'app/index.html')?.path ||
          next.find((f) => f.path === 'src/studio.vel')?.path ||
          next.find((f) => f.path === 'src/main.vel')?.path ||
          next.find((f) => f.path.endsWith('.vel'))?.path ||
          next[0].path,
        id,
      );
      if (restored && ['Code', 'Design', 'Scene', 'Animate'].includes(session.mode))
        setMode(session.mode);
    }
    return workspaceRef.current === id;
  }
  useEffect(() => {
    (async () => {
      try {
        const prefs = await api('/api/preferences');
        setPreferences(prefs);
        const data = await api('/api/workspaces');
        setWorkspaces(data.workspaces);
        if (prefs.restoreSession) {
          const session = await api('/api/session');
          if (session && data.workspaces.some((w) => w.id === session.workspace)) {
            const list = await api(`/api/files?workspace=${encodeURIComponent(session.workspace)}`);
            if (list.files.some((f) => f.path === session.path)) {
              await selectWorkspace(session.workspace, true, session);
              setHome(false);
            }
          }
        }
        await loadSettings();
      } catch (e) {
        report(e);
      } finally {
        startupComplete.current = true;
        setLoading(false);
      }
    })();
  }, []);
  const persistFile = useCallback(async ({ id, path, content, automatic = false }) => {
    if (!id || !path || typeof content !== 'string') return false;
    const key = `${id}:${path}`,
      previous = writeQueues.current.get(key) || Promise.resolve();
    const operation = previous
      .catch(() => {})
      .then(async () => {
        if (
          automatic &&
          (workspaceRef.current !== id ||
            activeRef.current !== path ||
            docsRef.current[path] !== content ||
            savedRef.current[path] === content)
        )
          return false;
        if (workspaceRef.current === id && activeRef.current === path)
          setSaveState({ state: 'saving', workspace: id, path });
        try {
          await api('/api/file', { workspace: id, path, content }, 'PUT');
          if (workspaceRef.current === id) {
            setSaved((d) => ({ ...d, [path]: content }));
            savedRef.current = { ...savedRef.current, [path]: content };
            if (activeRef.current === path)
              setSaveState({
                state: 'saved',
                workspace: id,
                path,
                message: automatic ? 'Autosaved' : 'Saved',
              });
            if (!automatic) flash(`${path} saved`);
          }
          return true;
        } catch (e) {
          if (workspaceRef.current === id) {
            setSaveState({ state: 'error', workspace: id, path, message: e.message });
            report(e);
          }
          return false;
        }
      });
    writeQueues.current.set(key, operation);
    const result = await operation;
    if (writeQueues.current.get(key) === operation) writeQueues.current.delete(key);
    return result;
  }, []);
  const save = useCallback(
    () =>
      persistFile({
        id: workspaceRef.current,
        path: activeRef.current,
        content: docsRef.current[activeRef.current],
      }),
    [persistFile],
  );
  useEffect(() => {
    document.body.dataset.theme = preferences.theme;
    document.body.classList.toggle('product-motion-reduced', preferences.reduceMotion);
  }, [preferences.theme, preferences.reduceMotion]);
  useEffect(() => {
    if (
      !startupComplete.current ||
      !preferences.autoSave ||
      !dirty ||
      !workspace ||
      !active ||
      home ||
      modal === 'history'
    )
      return;
    const id = workspace,
      path = active,
      content = source;
    const timer = setTimeout(
      () => persistFile({ id, path, content, automatic: true }),
      preferences.autoSaveDelay,
    );
    return () => clearTimeout(timer);
  }, [
    preferences.autoSave,
    preferences.autoSaveDelay,
    source,
    workspace,
    active,
    dirty,
    home,
    modal,
    persistFile,
  ]);
  useEffect(() => {
    if (!startupComplete.current || !workspace || !active || home || !preferences.restoreSession)
      return;
    const timer = setTimeout(() => {
      api('/api/session', { workspace, path: active, mode }, 'PUT').catch((e) => report(e));
    }, 250);
    return () => clearTimeout(timer);
  }, [workspace, active, mode, home, preferences.restoreSession]);
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setModal('search');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    const unload = (e) => {
      if (Object.keys(docs).some((p) => docs[p] !== saved[p])) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('beforeunload', unload);
    };
  }, [save, docs, saved]);
  useEffect(() => {
    if (!active) return;
    const version = ++lastPreview.current;
    const timer = setTimeout(async () => {
      setPreviewBusy(true);
      try {
        const result = await makePreview(source, active, workspace);
        if (version === lastPreview.current) {
          setPreview(result);
          setTime(result.duration || 1000);
          setPlaying(false);
        }
      } catch (e) {
        if (version === lastPreview.current) report(e);
      } finally {
        if (version === lastPreview.current) setPreviewBusy(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [source, active, workspace, taskboardProject]);
  useEffect(() => {
    iframe.current?.contentWindow?.postMessage({ type: 'vel:seek', time, playing }, '*');
  }, [time, playing, preview]);
  useEffect(() => {
    if (!playing) return;
    let frame, start;
    const base = time,
      duration = Math.max(preview.duration || 1000, 100);
    const tick = (now) => {
      if (!start) start = now;
      const t = base + now - start;
      if (t >= duration) {
        setTime(duration);
        setPlaying(false);
      } else {
        setTime(t);
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, preview.duration]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, chatBusy]);
  function closeTab(path) {
    if (docs[path] !== saved[path] && !confirm(`Discard unsaved changes in ${path}?`)) return;
    setTabs((t) => {
      const next = t.filter((p) => p !== path);
      if (active === path) setActive(next.at(-1) || '');
      return next;
    });
    setDocs((d) => {
      const n = { ...d };
      delete n[path];
      return n;
    });
  }
  async function runPreview() {
    const id = workspaceRef.current,
      path = activeRef.current,
      content = docsRef.current[path],
      version = ++lastPreview.current;
    try {
      setBusy(true);
      const result = await makePreview(content, path, id);
      if (
        workspaceRef.current !== id ||
        activeRef.current !== path ||
        version !== lastPreview.current
      )
        return;
      setPreview(result);
      setTime(result.duration || 1000);
      setPlaying(false);
      setLogs((l) => [
        ...l,
        {
          text: result.diagnostics.some((d) => d.severity === 'error')
            ? 'Preview has errors. Open Problems for details.'
            : `Preview built • ${result.tracks.length} animation tracks`,
          type: 'info',
        },
      ]);
      flash('Preview refreshed');
    } catch (e) {
      if (workspaceRef.current === id) report(e);
    } finally {
      setBusy(false);
    }
  }
  async function runNative() {
    const id = workspaceRef.current,
      path = activeRef.current,
      content = docsRef.current[path];
    setBusy(true);
    setBottom('Terminal');
    try {
      await api('/api/file', { workspace: id, path, content }, 'PUT');
      if (workspaceRef.current === id) setSaved((d) => ({ ...d, [path]: content }));
      const result = await api('/api/native-build', { workspace: id, path });
      if (workspaceRef.current === id)
        setLogs((l) => [...l, { text: result.output, type: result.exitCode ? 'error' : 'info' }]);
    } catch (e) {
      if (workspaceRef.current === id) report(e);
    } finally {
      setBusy(false);
    }
  }
  async function discoverModels() {
    setBusy(true);
    try {
      const data = await api('/api/models', { providerId: provider });
      setModels(data.models);
      if (!model && data.models.length) setModel(data.models[0]);
      flash(`Connected • ${data.models.length} models available`);
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function sendChat(text = prompt) {
    if (!text.trim() || chatBusy) return;
    if (!provider || !model) {
      setModal('connections');
      return;
    }
    const target = {
        workspace: workspaceRef.current,
        path: activeRef.current,
        source: docsRef.current[activeRef.current] ?? '',
      },
      request = ++chatRequest.current;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setPrompt('');
    setChatBusy(true);
    try {
      const data = await api('/api/chat', {
        providerId: provider,
        model,
        messages: next.map(({ role, content }) => ({ role, content })),
        ...(context && target.path
          ? { context: { path: target.path, content: target.source } }
          : {}),
      });
      if (workspaceRef.current !== target.workspace || request !== chatRequest.current) return;
      setMessages((m) => [...m, { role: 'assistant', content: data.content, target }]);
    } catch (e) {
      if (workspaceRef.current === target.workspace && request === chatRequest.current) report(e);
    } finally {
      if (workspaceRef.current === target.workspace && request === chatRequest.current)
        setChatBusy(false);
    }
  }
  async function importFiles(event) {
    const selected = [...event.target.files],
      id = workspaceRef.current;
    event.target.value = '';
    if (!selected.length) return;
    if (selected.length > 100) {
      report(new Error('Import up to 100 text files at a time.'));
      return;
    }
    setBusy(true);
    let count = 0;
    const failures = [];
    for (const file of selected) {
      try {
        if (file.size > 500000) throw new Error('over 500 KB');
        const content = await file.text();
        if (content.includes('\0')) throw new Error('binary files are not supported');
        await api(
          '/api/file',
          { workspace: id, path: file.webkitRelativePath || file.name, content, create: true },
          'PUT',
        );
        count++;
      } catch (e) {
        failures.push(`${file.name}: ${e.message}`);
      }
    }
    if (workspaceRef.current === id) {
      try {
        await refreshFiles(id);
      } catch (e) {
        failures.push(e.message);
      }
      flash(`Imported ${count} file${count === 1 ? '' : 's'} • existing files preserved`);
      if (failures.length) report(new Error(failures.join('\n')));
    }
    setBusy(false);
  }
  async function terminalRun(e) {
    e.preventDefault();
    if (!command.trim()) return;
    const current = command,
      id = workspaceRef.current;
    setCommand('');
    setLogs((l) => [...l, { text: `❯ ${current}`, type: 'command' }]);
    try {
      const data = await api('/api/terminal', { workspace: id, command: current });
      if (workspaceRef.current !== id) return;
      setLogs((l) => [...l, { text: data.output, type: data.exitCode ? 'error' : 'info' }]);
      if (current.trim().startsWith('build ')) await refreshFiles(id);
    } catch (e) {
      if (workspaceRef.current === id) setLogs((l) => [...l, { text: e.message, type: 'error' }]);
    }
  }
  async function openTemplates() {
    setModal('templates');
    setTemplatesLoading(true);
    try {
      const data = await api('/api/studio/templates');
      setTemplates(data.templates);
    } catch (e) {
      report(e);
    } finally {
      setTemplatesLoading(false);
    }
  }
  async function createFromTemplate(template) {
    const id = workspaceRef.current,
      path = `src/studio-${Date.now()}.vel`;
    setBusy(true);
    try {
      await api(
        '/api/file',
        { workspace: id, path, content: template.source, create: true },
        'PUT',
      );
      if (workspaceRef.current !== id) return;
      await refreshFiles(id);
      await openFile(path, id);
      setModal(null);
      flash(`${template.name} created`);
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportStudio() {
    setBusy(true);
    try {
      const res = await fetch('/api/studio/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vel-Client': 'local' },
        body: JSON.stringify({ source }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Export failed.');
      }
      const blob = await res.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = (active.split('/').at(-1) || 'studio.vel').replace(/\.vel$/i, '') + '.html';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      flash('Standalone application exported');
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  function openHome() {
    setHome(true);
    setHomeVersion((v) => v + 1);
    setModal(null);
    setPlaying(false);
  }
  async function openProject(project) {
    try {
      const data = await api('/api/workspaces');
      setWorkspaces(data.workspaces);
      if (workspaceRef.current === project.id && activeRef.current) {
        setHome(false);
        return;
      }
      if (await selectWorkspace(project.id)) setHome(false);
    } catch (e) {
      report(e);
    }
  }
  async function launchProject(id = workspaceRef.current, saveCurrent = true) {
    if (!id) return;
    setBusy(true);
    try {
      const current = id === workspaceRef.current,
        path = current ? activeRef.current : '',
        launchBody =
          current && path.endsWith('.vel') && isStudioSource(docsRef.current[path]) ? { path } : {};
      if (saveCurrent && current && path) {
        for (const [filePath, content] of Object.entries(docsRef.current)) {
          if (content === savedRef.current[filePath]) continue;
          const savedSuccessfully = await persistFile({ id, path: filePath, content });
          if (!savedSuccessfully)
            throw new Error('Launch stopped because a project file could not be saved.');
        }
      }
      const result = await api(`/api/workspaces/${encodeURIComponent(id)}/launch`, launchBody);
      const url = new URL(result.url, window.location.href);
      if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol))
        throw new Error('The launch service returned an invalid local URL.');
      setLaunch({ ...result, url: url.href });
      setModal('launch');
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  function openHistory() {
    if (!activeRef.current) return;
    setHistoryTarget({ workspace: workspaceRef.current, path: activeRef.current });
    setModal('history');
  }
  const currentSaveState =
    saveState.workspace === workspace && saveState.path === active ? saveState : { state: 'idle' };
  const saveLabel =
    currentSaveState.state === 'saving'
      ? 'Saving…'
      : currentSaveState.state === 'error'
        ? 'Save failed'
        : dirty
          ? 'Unsaved changes'
          : currentSaveState.state === 'saved'
            ? currentSaveState.message
            : 'All changes saved';
  const previewPane = (
    <section className="preview-pane">
      <div className="panel-heading">
        <span>
          <i className={`status-dot ${previewBusy ? 'working' : ''}`} />
          {previewBusy
            ? 'Updating preview'
            : taskboardProject
              ? 'Full-stack preview'
              : 'Live Preview'}
        </span>
        <div className="device-toggle">
          <IconButton
            icon={Monitor}
            title="Desktop preview"
            active={device === 'Desktop'}
            onClick={() => setDevice('Desktop')}
          />
          <IconButton
            icon={Smartphone}
            title="Mobile preview"
            active={device === 'Mobile'}
            onClick={() => setDevice('Mobile')}
          />
          <IconButton icon={RefreshCw} title="Refresh preview" onClick={runPreview} />
        </div>
      </div>
      <div className={`preview-stage ${device.toLowerCase()}`}>
        <iframe
          ref={iframe}
          title="Live UI preview"
          sandbox={taskboardProject ? 'allow-scripts allow-forms' : 'allow-scripts'}
          srcDoc={preview.html}
          onLoad={() =>
            iframe.current?.contentWindow?.postMessage({ type: 'vel:seek', time, playing }, '*')
          }
        />
      </div>
      <div className="preview-caption">
        <span>
          <Box size={12} />{' '}
          {taskboardProject ? 'Live project API · changes persist' : 'Vel Preview DSL'}
        </span>
        <button onClick={() => setModal('help')}>
          Language guide <ArrowUpRight size={12} />
        </button>
      </div>
    </section>
  );
  return (
    <div
      className={`ide mode-${mode.toLowerCase()} ${showStudio && !home ? 'studio-active' : ''} ${home ? 'project-home-open' : ''}`}
    >
      <input
        ref={importInput}
        type="file"
        multiple
        hidden
        aria-label="Import project files"
        onChange={importFiles}
      />
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openHome();
          }}
          aria-label="Projects home"
        >
          <span className="vel-mark">V</span>
          <strong>
            VEL <span>STUDIO</span>
          </strong>
        </a>
        <div className="workspace-picker">
          <Folder size={14} />
          <select
            aria-label="Workspace"
            value={workspace}
            onChange={(e) => selectWorkspace(e.target.value).catch(report)}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <IconButton icon={Plus} title="New workspace" onClick={() => setModal('workspace')} />
        </div>
        <nav className="mode-tabs" aria-label="Editor mode">
          {['Code', 'Design', 'Scene', 'Animate'].map((m) => (
            <button
              key={m}
              className={mode === m ? 'selected' : ''}
              onClick={() => {
                setMode(m);
                if (studioDocument && m !== 'Code') setSide(null);
                if (m === 'Animate') setBottom('Timeline');
              }}
            >
              {m}
            </button>
          ))}
        </nav>
        <button className="command-search" onClick={() => setModal('search')}>
          <Search size={14} />
          <span>Search files...</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="top-actions">
          <IconButton
            icon={House}
            title="Projects home"
            className="global-product-tool"
            active={home}
            onClick={openHome}
          />
          <button
            className="run-button"
            disabled={busy || !active}
            onClick={() => {
              if (showStudio) setMode('Code');
              runPreview();
            }}
          >
            {busy ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            Run
          </button>
          <IconButton
            icon={Box}
            className="native-build-button"
            title="Save and run native compiler"
            disabled={busy || !active?.endsWith('.vel') || studioDocument}
            onClick={runNative}
          />
          <IconButton
            icon={Save}
            className="manual-save-button"
            title="Save file (Ctrl+S)"
            onClick={save}
            disabled={!dirty}
          />
          <IconButton
            icon={Layers3}
            className="studio-template-button"
            title="Studio templates"
            onClick={openTemplates}
          />
          <IconButton
            icon={History}
            className="file-history-button"
            title="File version history"
            disabled={!active}
            onClick={openHistory}
          />
          <IconButton
            icon={Sparkles}
            className="connections-button"
            title="Connections and settings"
            onClick={() => setModal('connections')}
          />
          <IconButton
            icon={Settings}
            className="preferences-button"
            title="Application preferences"
            onClick={() => setModal('preferences')}
          />
          {!home && (
            <button
              className="product-launch-button"
              disabled={busy || !workspace || !active}
              onClick={() => launchProject(workspace, true)}
            >
              <Play size={12} fill="currentColor" />
              Launch
            </button>
          )}
        </div>
      </header>
      {home ? (
        <ProjectHome
          onOpen={openProject}
          onLaunch={launchProject}
          onError={report}
          onPreferences={() => setModal('preferences')}
          onConnections={() => setModal('connections')}
          refreshKey={homeVersion}
        />
      ) : (
        <div className="workbench">
          <nav className="activity-bar" aria-label="Tools">
            <div>
              <IconButton icon={House} title="Projects home" onClick={openHome} />
              <IconButton
                icon={Files}
                title="Project files"
                active={modal !== 'plugins'}
                onClick={() => {
                  setModal(window.matchMedia('(max-width: 850px)').matches ? 'files' : null);
                }}
              />
              <IconButton icon={Search} title="Search files" onClick={() => setModal('search')} />
              <IconButton
                icon={GitBranch}
                title="Git status"
                onClick={async () => {
                  setBottom('Terminal');
                  try {
                    const d = await api('/api/terminal', { workspace, command: 'git status' });
                    setLogs((l) => [...l, { text: d.output, type: 'info' }]);
                  } catch (e) {
                    report(e);
                  }
                }}
              />
              <IconButton icon={Plug} title="Plugins" onClick={() => setModal('plugins')} />
              <IconButton
                icon={Sparkles}
                title="AI assistant"
                active={side === 'Assistant'}
                onClick={() => setSide(side === 'Assistant' ? null : 'Assistant')}
              />
            </div>
            <div>
              <IconButton icon={BookOpen} title="Language guide" onClick={() => setModal('help')} />
              <IconButton
                icon={Settings}
                title="Application preferences"
                onClick={() => setModal('preferences')}
              />
            </div>
          </nav>
          <aside className="explorer">
            <div className="panel-heading">
              <span>EXPLORER</span>
              <div style={{ display: 'flex' }}>
                <IconButton
                  icon={ArrowUpRight}
                  title="Import files"
                  disabled={busy}
                  onClick={() => importInput.current?.click()}
                />
                <IconButton icon={Plus} title="New file" onClick={() => setModal('file')} />
              </div>
            </div>
            <div className="project-name">
              <ChevronDown size={14} />
              <Folder size={14} />
              <span>{workspaces.find((w) => w.id === workspace)?.name || 'Workspace'}</span>
            </div>
            <div className="file-tree">
              {loading ? (
                <p className="muted pad">Loading files…</p>
              ) : (
                files.map((f) => (
                  <div key={f.path} className={`file-row ${active === f.path ? 'selected' : ''}`}>
                    <button onClick={() => openFile(f.path).catch(report)} title={f.path}>
                      <FileCode2 size={15} className={fileIcon(f.path)} />
                      <span>{f.path}</span>
                      {docs[f.path] !== undefined && docs[f.path] !== saved[f.path] && (
                        <i className="dirty-dot" />
                      )}
                    </button>
                    <button
                      className="delete-file"
                      title={`Delete ${f.path}`}
                      onClick={async () => {
                        if (!confirm(`Permanently delete ${f.path}?`)) return;
                        try {
                          await api('/api/file', { workspace, path: f.path }, 'DELETE');
                          setTabs((t) => t.filter((x) => x !== f.path));
                          if (active === f.path) setActive('');
                          setDocs((d) => {
                            const n = { ...d };
                            delete n[f.path];
                            return n;
                          });
                          await refreshFiles();
                        } catch (e) {
                          report(e);
                        }
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="explorer-footer">
              <div className="mini-logo">
                <Box size={19} />
              </div>
              <strong>Your ideas. In motion.</strong>
              <p>
                Code, preview, and animate
                <br />
                in one workspace.
              </p>
              <button onClick={() => setModal('help')}>
                Explore the language <ArrowUpRight size={12} />
              </button>
              <span className="version">LOCAL STUDIO · v0.3</span>
            </div>
          </aside>
          <main className="main-workspace">
            {showStudio ? (
              <StudioWorkbench
                key={workspace + '/' + active}
                source={source}
                view={mode.toLowerCase()}
                onChange={(newSource) => setDocs((d) => ({ ...d, [active]: newSource }))}
                onSave={save}
                onExport={exportStudio}
                onError={report}
                onCreateTemplate={openTemplates}
              />
            ) : (
              <>
                <div className="upper-workspace">
                  <section className="editor-pane">
                    <div className="file-tabs">
                      {tabs.map((p) => (
                        <div key={p} className={`file-tab ${p === active ? 'selected' : ''}`}>
                          <button onClick={() => setActive(p)}>
                            <FileCode2 size={14} />
                            {p.split('/').at(-1)}
                            {docs[p] !== saved[p] && <i className="dirty-dot" />}
                          </button>
                          <button title={`Close ${p}`} onClick={() => closeTab(p)}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <IconButton
                        icon={Plus}
                        title="Create file"
                        onClick={() => setModal('file')}
                      />
                      <IconButton
                        icon={ArrowUpRight}
                        title="Import source files"
                        disabled={busy}
                        onClick={() => importInput.current?.click()}
                      />
                    </div>
                    <div className="breadcrumbs">
                      {active ? (
                        <>
                          <span>{workspaces.find((w) => w.id === workspace)?.name}</span>
                          <ChevronRight size={11} />
                          <FileCode2 size={12} />
                          <span>{active}</span>
                        </>
                      ) : (
                        <span>No file open</span>
                      )}
                      <span className="dsl-badge">
                        {studioDocument
                          ? 'STUDIO DOCUMENT'
                          : taskboardProject
                            ? 'FULL-STACK APP'
                            : 'PREVIEW DSL'}
                      </span>
                    </div>
                    <div className="editor-container">
                      {active ? (
                        <Editor
                          height="100%"
                          path={`${workspace}/${active}`}
                          language={
                            studioDocument
                              ? 'json'
                              : active.endsWith('.vel')
                                ? 'vel'
                                : active.endsWith('.html')
                                  ? 'html'
                                  : /\.(js|jsx)$/.test(active)
                                    ? 'javascript'
                                    : /\.(ts|tsx)$/.test(active)
                                      ? 'typescript'
                                      : active.endsWith('.css')
                                        ? 'css'
                                        : active.endsWith('.json')
                                          ? 'json'
                                          : 'plaintext'
                          }
                          theme={preferences.theme === 'light' ? 'vs' : 'vel-night'}
                          value={source}
                          onChange={(value) => setDocs((d) => ({ ...d, [active]: value ?? '' }))}
                          onMount={(editor) => {
                            editorRef.current = editor;
                            editor.onDidChangeCursorPosition((e) => setCursor(e.position));
                          }}
                          options={{
                            editContext: false,
                            fontSize: preferences.editor.fontSize,
                            fontFamily: "'Cascadia Code', 'Consolas', monospace",
                            lineHeight: 23,
                            minimap: { enabled: preferences.editor.minimap },
                            scrollBeyondLastLine: false,
                            padding: { top: 16 },
                            smoothScrolling: true,
                            automaticLayout: true,
                            tabSize: preferences.editor.tabSize,
                            wordWrap: preferences.editor.wordWrap ? 'on' : 'off',
                            renderLineHighlight: 'line',
                            bracketPairColorization: { enabled: true },
                          }}
                        />
                      ) : (
                        <div className="empty-editor">
                          <span className="vel-mark large">V</span>
                          <h2>Make room for your next idea.</h2>
                          <p>Open a file or create something new.</p>
                          <button className="primary" onClick={() => setModal('file')}>
                            <Plus size={14} />
                            New file
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="editor-footnote">
                      <span>
                        <Circle size={10} /> {active ? saveLabel : 'No file selected'}
                      </span>
                      <span>{source.split('\n').length} lines</span>
                    </div>
                  </section>
                  {previewPane}
                </div>
                <section className="bottom-pane">
                  <header className="bottom-tabs">
                    <div>
                      {[
                        ['Timeline', SlidersHorizontal],
                        ['Terminal', Terminal],
                        ['Problems', AlertCircle],
                      ].map(([name, Icon]) => (
                        <button
                          key={name}
                          className={bottom === name ? 'selected' : ''}
                          onClick={() => setBottom(name)}
                        >
                          <Icon size={14} />
                          {name}
                          {name === 'Problems' && preview.diagnostics.length > 0 && (
                            <span className="count">{preview.diagnostics.length}</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <span className="bottom-description">
                      {bottom === 'Timeline'
                        ? 'Animation workspace'
                        : bottom === 'Terminal'
                          ? 'Workspace commands'
                          : 'Preview diagnostics'}
                    </span>
                  </header>
                  {bottom === 'Timeline' ? (
                    <div className="timeline">
                      <div className="timeline-toolbar">
                        <div>
                          <IconButton
                            icon={playing ? Square : Play}
                            title={playing ? 'Pause animation' : 'Play animation'}
                            active={playing}
                            onClick={() => {
                              if (time >= (preview.duration || 1000)) setTime(0);
                              setPlaying(!playing);
                            }}
                          />
                          <IconButton
                            icon={SkipBack}
                            title="Rewind animation"
                            onClick={() => {
                              setTime(0);
                              setPlaying(false);
                            }}
                          />
                          <span className="timecode">
                            {(time / 1000).toFixed(3)}{' '}
                            <small>/ {((preview.duration || 1000) / 1000).toFixed(3)} s</small>
                          </span>
                        </div>
                        <span className="timeline-hint">Scrub to explore motion</span>
                      </div>
                      <div className="timeline-body">
                        <div className="track-label ruler-label">
                          LAYERS <span>{preview.tracks.length}</span>
                        </div>
                        <div className="ruler">
                          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                            <span key={v}>{Math.round((preview.duration || 1000) * v)}ms</span>
                          ))}
                        </div>
                        {preview.tracks.length ? (
                          preview.tracks.map((track, i) => (
                            <React.Fragment key={i}>
                              <div className="track-label">
                                <span className={`track-diamond color-${i % 2}`} />
                                <span>
                                  {track.name}
                                  <small>{track.property}</small>
                                </span>
                              </div>
                              <div className="track-lane">
                                <div
                                  className={`track-clip color-${i % 2}`}
                                  style={{
                                    left: `${(100 * (track.delay || 0)) / (preview.duration || 1000)}%`,
                                    width: `${Math.max(2, (100 * track.duration) / (preview.duration || 1000))}%`,
                                  }}
                                >
                                  <i />
                                  <i />
                                </div>
                                <div
                                  className="playhead"
                                  style={{ left: `${(time / (preview.duration || 1000)) * 100}%` }}
                                />
                              </div>
                            </React.Fragment>
                          ))
                        ) : (
                          <div className="timeline-empty">
                            Add <code>animate=fade.up(0.6)</code> to a component to create a track.
                          </div>
                        )}
                        <input
                          aria-label="Animation time"
                          className="timeline-scrubber"
                          type="range"
                          min="0"
                          max={preview.duration || 1000}
                          value={time}
                          onChange={(e) => {
                            setPlaying(false);
                            setTime(Number(e.target.value));
                          }}
                        />
                      </div>
                    </div>
                  ) : bottom === 'Terminal' ? (
                    <div className="terminal">
                      <div className="terminal-log">
                        {logs.map((log, i) => (
                          <pre key={i} className={log.type}>
                            {log.text}
                          </pre>
                        ))}
                      </div>
                      <form onSubmit={terminalRun}>
                        <span>❯</span>
                        <input
                          aria-label="Terminal command"
                          placeholder="help · ls · check main.vel · build main.vel"
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                        />
                        <button type="submit">Enter ↵</button>
                      </form>
                    </div>
                  ) : (
                    <div className="problems">
                      {preview.diagnostics.length ? (
                        preview.diagnostics.map((d, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              editorRef.current?.revealLineInCenter(d.line);
                              editorRef.current?.setPosition({ lineNumber: d.line, column: 1 });
                              editorRef.current?.focus();
                            }}
                          >
                            <AlertCircle size={14} className={d.severity} />
                            <span>{d.message}</span>
                            <small>Line {d.line}</small>
                          </button>
                        ))
                      ) : (
                        <div className="no-problems">
                          <Check size={18} />
                          <span>No preview problems found</span>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
          {side && (
            <aside className="assistant-pane">
              <div className="panel-heading">
                <span>
                  <Sparkles size={14} />
                  AI Assistant
                </span>
                <IconButton
                  icon={PanelRightClose}
                  title="Hide assistant"
                  onClick={() => setSide(null)}
                />
              </div>
              <div className="assistant-connection">
                <button onClick={() => setModal('connections')}>
                  <span className="provider-symbol">✳</span>
                  <div>
                    <strong>{activeProvider?.name || 'Choose a connection'}</strong>
                    <small>{model || 'Select a model to begin'}</small>
                  </div>
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="chat-scroll">
                {!messages.length && (
                  <div className="assistant-welcome">
                    <div className="assistant-spark">
                      <Sparkles size={22} />
                    </div>
                    <span className="eyebrow">A LITTLE HELP, A LOT OF POSSIBILITY</span>
                    <h2>
                      Build with
                      <br />a second mind.
                    </h2>
                    <p>
                      Connect your preferred model to explore ideas, explain code, and refine your
                      interface.
                    </p>
                    <div className="suggestions">
                      {[
                        'Explain this file',
                        'Suggest a subtle entrance animation',
                        'Help improve this layout',
                      ].map((text) => (
                        <button key={text} onClick={() => sendChat(text)}>
                          <span>{text}</span>
                          <ArrowUpRight size={13} />
                        </button>
                      ))}
                    </div>
                    <div className="privacy-note">
                      <i className="status-dot" />
                      <span>You choose what context to share.</span>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <article key={i} className={`chat-message ${msg.role}`}>
                    <div>
                      <span>{msg.role === 'user' ? 'YOU' : 'VEL ASSISTANT'}</span>
                      {msg.role === 'assistant' && <Sparkles size={12} />}
                    </div>
                    <p>{msg.content}</p>
                    {msg.role === 'assistant' &&
                      /```(?:vel|html|json)?\s*\n([\s\S]*?)```/.test(msg.content) && (
                        <button
                          className="review-button"
                          onClick={() =>
                            setProposal({
                              content: msg.content.match(
                                /```(?:vel|html|json)?\s*\n([\s\S]*?)```/,
                              )[1],
                              ...msg.target,
                            })
                          }
                        >
                          <FileCode2 size={13} />
                          Review code suggestion
                        </button>
                      )}
                  </article>
                ))}
                {chatBusy && (
                  <div className="thinking">
                    <LoaderCircle size={14} className="spin" />
                    Waiting for your model…
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              <div className="chat-compose">
                <label className="context-checkbox">
                  <input
                    type="checkbox"
                    checked={context}
                    onChange={(e) => setContext(e.target.checked)}
                  />
                  <FileCode2 size={12} />
                  Include current file{context && active && <span>{active.split('/').at(-1)}</span>}
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendChat();
                  }}
                >
                  <textarea
                    aria-label="Message AI assistant"
                    rows={3}
                    placeholder="Ask, explore, or build something…"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                  />
                  <div>
                    <span>
                      {activeProvider?.type === 'ollama'
                        ? 'Local model via Ollama'
                        : 'Your configured AI connection'}
                    </span>
                    <button
                      className="send-button"
                      title="Send message"
                      disabled={chatBusy || !prompt.trim()}
                    >
                      {chatBusy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </form>
                <small>AI suggestions are reviewed before applying.</small>
              </div>
            </aside>
          )}
          {!side && (
            <button
              className="reopen-assistant"
              title="Open AI assistant"
              onClick={() => setSide('Assistant')}
            >
              <PanelRightOpen size={15} />
            </button>
          )}
        </div>
      )}
      <footer className="statusbar">
        <div>
          <i className={`status-dot ${previewBusy ? 'working' : ''}`} />
          <span>
            {loading
              ? 'Opening workspace…'
              : notice ||
                (home
                  ? 'Projects home · local service ready'
                  : currentSaveState.state === 'saving'
                    ? 'Saving…'
                    : currentSaveState.state === 'error'
                      ? 'Save failed'
                      : currentSaveState.state === 'saved' && !dirty
                        ? currentSaveState.message
                        : previewBusy
                          ? 'Updating preview…'
                          : 'Local workspace ready')}
          </span>
          <span className="status-divider" />
          <GitBranch size={12} />
          <span>workspace</span>
        </div>
        <div>
          <span>
            {studioDocument
              ? 'Vel Studio v1'
              : taskboardProject
                ? 'HTML · CSS · JavaScript'
                : 'Vel Preview DSL'}
          </span>
          <span>UTF-8</span>
          <span>
            Ln {cursor.lineNumber}, Col {cursor.column}
          </span>
          <button onClick={() => setModal('connections')}>
            <Plug size={12} />
            {activeProvider?.name || 'Connect AI'}
          </button>
        </div>
      </footer>
      {error && (
        <div className="error-toast" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <IconButton icon={X} title="Dismiss error" onClick={() => setError('')} />
        </div>
      )}
      {(modal === 'file' || modal === 'workspace') && (
        <CreateModal
          kind={modal}
          onClose={() => setModal(null)}
          onCreate={async (name) => {
            if (modal === 'workspace') {
              const data = await api('/api/workspaces', { name });
              setWorkspaces((w) => [...w, data]);
              await selectWorkspace(data.id);
            } else {
              await api(
                '/api/file',
                {
                  workspace,
                  path: name,
                  content: name.endsWith('.vel')
                    ? '#NewScreen\n  V g=md p=lg\n    T "Hello, Vel" size=xl font=bold\n'
                    : '',
                  create: true,
                },
                'PUT',
              );
              await refreshFiles();
              await openFile(name);
            }
            setModal(null);
          }}
        />
      )}
      {modal === 'preferences' && (
        <Modal
          title="Make the workspace yours."
          eyebrow="APPLICATION SETTINGS"
          wide
          onClose={() => setModal(null)}
        >
          <Preferences
            preferences={preferences}
            onSaved={(next) => {
              setPreferences(next);
              flash('Preferences saved');
            }}
            onClose={() => setModal(null)}
            onConnections={() => setModal('connections')}
          />
        </Modal>
      )}
      {modal === 'history' && historyTarget && (
        <Modal
          title="A history of your ideas."
          eyebrow="FILE VERSIONS"
          wide
          onClose={() => setModal(null)}
        >
          <FileHistory
            key={historyTarget.workspace + '/' + historyTarget.path}
            workspace={historyTarget.workspace}
            path={historyTarget.path}
            dirty={
              historyTarget.workspace === workspace &&
              docs[historyTarget.path] !== saved[historyTarget.path]
            }
            onBeforeRestore={async () => {
              if (workspaceRef.current !== historyTarget.workspace)
                throw new Error(
                  'The project changed. Reopen history from the target project before restoring.',
                );
              await writeQueues.current.get(historyTarget.workspace + ':' + historyTarget.path);
              if (workspaceRef.current !== historyTarget.workspace)
                throw new Error(
                  'The project changed while waiting to restore. No revision was restored.',
                );
            }}
            onRestored={(content) => {
              if (workspaceRef.current !== historyTarget.workspace)
                throw new Error(
                  'The revision was restored in its original project, but the open project changed. Reopen the original project to view it.',
                );
              setDocs((d) => ({ ...d, [historyTarget.path]: content }));
              setSaved((d) => ({ ...d, [historyTarget.path]: content }));
              savedRef.current = { ...savedRef.current, [historyTarget.path]: content };
              setActive(historyTarget.path);
              setSaveState({
                state: 'saved',
                workspace: historyTarget.workspace,
                path: historyTarget.path,
                message: 'Revision restored',
              });
              flash('Saved revision restored');
            }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === 'launch' && launch && (
        <Modal
          title="Your project is running."
          eyebrow="LOCAL PROJECT LAUNCH"
          onClose={() => setModal(null)}
        >
          <div className="launch-dialog">
            <span className="launch-symbol">
              <Play size={23} fill="currentColor" />
            </span>
            <h3>{launch.projectName}</h3>
            <p>
              {launch.kind === 'taskboard'
                ? 'Your fullstack taskboard is connected to its persistent local API. Changes to records are saved by the service.'
                : 'Your saved Studio document is running in its own local application view.'}
            </p>
            <a className="launch-link" href={launch.url} target="_blank" rel="noopener noreferrer">
              {launch.url}
              <ExternalLink size={14} />
            </a>
            <a
              className="product-primary"
              href={launch.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open running project <ArrowUpRight size={15} />
            </a>
            <small>
              Keep the Vel Studio local service running to use this link. Launch uses saved project
              files.
            </small>
          </div>
        </Modal>
      )}
      {modal === 'connections' && (
        <Connections
          settings={settings}
          provider={provider}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await loadSettings();
            setModels([]);
            flash('Connections saved');
          }}
          onError={report}
        />
      )}
      {modal === 'plugins' && <Plugins onClose={() => setModal(null)} onError={report} />}
      {modal === 'files' && (
        <Modal title="Project files" eyebrow="WORKSPACES & FILES" onClose={() => setModal(null)}>
          <div className="modal-body">
            <label className="field-label">
              Workspace
              <select
                aria-label="Project workspace"
                value={workspace}
                onChange={(e) => selectWorkspace(e.target.value).catch(report)}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="modal-actions"
              style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 0 }}
            >
              <button onClick={() => setModal('workspace')}>
                <Plus size={13} />
                Workspace
              </button>
              <button onClick={() => setModal('file')}>
                <Plus size={13} />
                New file
              </button>
              <button disabled={busy} onClick={() => importInput.current?.click()}>
                <ArrowUpRight size={13} />
                Import files
              </button>
            </div>
            <div className="search-results">
              {files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => {
                    openFile(f.path).catch(report);
                    setModal(null);
                  }}
                >
                  <FileCode2 size={16} />
                  {f.path}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            {!files.length && (
              <p className="muted">No files yet. Create or import a file to begin.</p>
            )}
          </div>
        </Modal>
      )}
      {modal === 'search' && (
        <Modal title="Find a file" onClose={() => setModal(null)}>
          <div className="modal-body">
            <div className="search-input">
              <Search size={17} />
              <input
                autoFocus
                placeholder="Search by file name…"
                aria-label="Search project files"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="search-results">
              {files
                .filter((f) => f.path.toLowerCase().includes(query.toLowerCase()))
                .map((f) => (
                  <button
                    key={f.path}
                    onClick={() => {
                      openFile(f.path).catch(report);
                      setModal(null);
                    }}
                  >
                    <FileCode2 size={16} />
                    {f.path}
                    <ArrowUpRight size={13} />
                  </button>
                ))}
            </div>
          </div>
        </Modal>
      )}
      {modal === 'templates' && (
        <Modal
          title="Start with a little possibility."
          eyebrow="VEL STUDIO TEMPLATES"
          wide
          onClose={() => setModal(null)}
        >
          <div className="modal-body">
            <p className="muted">
              Each template creates a new .vel document with an editable design canvas, 3D scene,
              and animation tracks. Your existing files stay untouched.
            </p>
            {templatesLoading ? (
              <p className="muted">Loading templates…</p>
            ) : (
              <div className="studio-template-list">
                {templates.map((template, i) => (
                  <button
                    key={template.id}
                    className="studio-template-card"
                    disabled={busy}
                    onClick={() => createFromTemplate(template)}
                  >
                    <span className="studio-template-icon">
                      {i === 1 ? (
                        <Box size={23} />
                      ) : i === 2 ? (
                        <Frame size={23} />
                      ) : (
                        <Layers3 size={23} />
                      )}
                    </span>
                    <div>
                      <strong>{template.name}</strong>
                      <p>{template.description}</p>
                    </div>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
            )}
            <p className="muted" style={{ marginTop: 20, fontSize: 10 }}>
              Original local creative tools · standalone HTML export · source in JSON .vel format.
            </p>
          </div>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal
          title="A small language. Big ideas."
          eyebrow="VEL PREVIEW DSL"
          wide
          onClose={() => setModal(null)}
        >
          <div className="modal-body help">
            <p>
              <strong>Vel Studio:</strong> open src/studio.vel or use Studio templates to design
              interfaces, edit 3D scenes, and author animations in one source document. The Design
              and Scene inspectors update the same JSON shown in Code. Export downloads a standalone
              HTML application. This is an original creative studio with primitive scene simulation,
              not full Figma or Unity compatibility.
            </p>
            <p>
              This IDE includes an experimental preview subset for building UI concepts. It is
              separate from the official Vel compiler. You can also preview standalone HTML files.
            </p>
            <div className="help-columns">
              <div>
                <h3>Your first screen</h3>
                <pre>
                  {
                    '#WelcomeScreen\n  V g=md p=lg\n    T "Hello, Vel" size=xl font=bold\n    Card p=lg animate=fade.up(0.6)\n      T "Your next idea starts here"\n      Progress value=0.65\n      Btn "Get started"'
                  }
                </pre>
              </div>
              <div>
                <h3>Building blocks</h3>
                <p>
                  <code>V</code> vertical layout · <code>H</code> horizontal layout
                  <br />
                  <code>Card</code> surface · <code>T</code> text · <code>Btn</code> button
                  <br />
                  <code>In</code> text input · <code>Progress</code> progress bar
                </p>
                <h3>Style & motion</h3>
                <p>
                  Indent children by two spaces.
                  <br />
                  <code>g=md p=lg fg=accent font=bold size=xl</code>
                  <br />
                  <code>animate=fade.up(0.6) delay=0.1</code>
                  <br />
                  <code>animate=scale(0.2)</code>
                </p>
              </div>
            </div>
            <h3>Connect your tools</h3>
            <p>
              Settings supports Ollama, OpenAI API, and OpenAI-compatible servers. API keys stay on
              the local backend. ChatGPT account sign-in and VS Code extensions are not included.
              Plugins connect to explicit HTTP JSON endpoints; they are not MCP servers.
            </p>
            <p className="muted">
              Native builds require a separately installed Vel compiler configured in Settings. The
              terminal supports workspace commands shown by <code>help</code>.
            </p>
          </div>
        </Modal>
      )}
      {proposal && (
        <Modal
          title="Review code suggestion"
          eyebrow="AI CHANGE PROPOSAL"
          wide
          onClose={() => setProposal(null)}
        >
          <div className="modal-body">
            <p>
              This suggestion targets{' '}
              <strong>{proposal.path || '(no file selected when requested)'}</strong> in{' '}
              <strong>
                {workspaces.find((w) => w.id === proposal.workspace)?.name ||
                  'the originating workspace'}
              </strong>
              . Applying replaces that file’s editor content. Save separately when ready.
            </p>
            {proposal.workspace !== workspace && (
              <p className="inline-error">
                Switch back to the originating workspace before applying this suggestion.
              </p>
            )}
            {proposal.workspace === workspace &&
              proposal.path &&
              docs[proposal.path] !== proposal.source && (
                <p className="inline-error">
                  This file has changed since the AI request. Applying the suggestion will replace
                  your newer edits and requires confirmation.
                </p>
              )}
            {proposal.path && !tabs.includes(proposal.path) && (
              <p className="muted">Open the target file before applying this suggestion.</p>
            )}
            <pre className="proposal-code">{proposal.content}</pre>
            <div className="modal-actions">
              <button onClick={() => setProposal(null)}>Cancel</button>
              <button
                className="primary"
                disabled={
                  !proposal.path ||
                  proposal.workspace !== workspace ||
                  !tabs.includes(proposal.path)
                }
                onClick={() => {
                  if (proposal.workspace !== workspaceRef.current) return;
                  if (
                    docsRef.current[proposal.path] !== proposal.source &&
                    !confirm(
                      `The file ${proposal.path} has changed since this AI request. Replace your newer editor content with this suggestion?`,
                    )
                  )
                    return;
                  setDocs((d) => ({ ...d, [proposal.path]: proposal.content }));
                  setActive(proposal.path);
                  setProposal(null);
                  flash('Suggestion applied to editor • not saved');
                }}
              >
                <Check size={14} />
                Apply to editor
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateModal({ kind, onClose, onCreate }) {
  const [name, setName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={kind === 'file' ? 'Create a new file' : 'Start a new workspace'}
      onClose={onClose}
    >
      <form
        className="modal-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onCreate(name.trim());
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label">
          {kind === 'file' ? 'File path' : 'Workspace name'}
          <input
            autoFocus
            required
            maxLength={160}
            placeholder={kind === 'file' ? 'components/Hero.vel' : 'My next idea'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="muted">
          {kind === 'file'
            ? 'Use .vel for the preview DSL or .html for a standalone page.'
            : 'Each workspace has its own saved project files.'}
        </p>
        {error && <p className="inline-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Connections({ settings, provider, onClose, onSaved, onError }) {
  const [draft, setDraft] = useState(structuredClone(settings)),
    [selected, setSelected] = useState(provider || settings.providers[0]?.id),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [models, setModels] = useState([]);
  const current = draft.providers.find((p) => p.id === selected);
  const update = (patch) =>
    setDraft((s) => ({
      ...s,
      providers: s.providers.map((p) => (p.id === selected ? { ...p, ...patch } : p)),
    }));
  async function persist() {
    await api('/api/settings', { ...draft, activeProvider: selected }, 'PUT');
    await onSaved();
  }
  return (
    <Modal title="Your tools, connected." eyebrow="CONNECTIONS & SETTINGS" wide onClose={onClose}>
      <div className="modal-body connections">
        <p className="muted">
          Bring your own AI. Connect local models or an API provider. Keys are stored by the local
          server and never returned to the editor.
        </p>
        <div className="connection-layout">
          <nav>
            {draft.providers.map((p) => (
              <button
                key={p.id}
                className={selected === p.id ? 'selected' : ''}
                onClick={() => {
                  setSelected(p.id);
                  setModels([]);
                  setStatus('');
                }}
              >
                <span className="provider-symbol">{p.type === 'ollama' ? '◉' : '✳'}</span>
                <span>
                  {p.name}
                  <small>{p.type === 'ollama' ? 'Local inference' : 'API connection'}</small>
                </span>
                <ChevronRight size={13} />
              </button>
            ))}
            <button
              onClick={() => {
                const id = `provider-${Date.now()}`;
                setDraft((s) => ({
                  ...s,
                  providers: [
                    ...s.providers,
                    {
                      id,
                      name: 'Custom provider',
                      type: 'compatible',
                      baseUrl: 'http://localhost:1234/v1',
                      model: '',
                    },
                  ],
                }));
                setSelected(id);
              }}
            >
              <Plus size={14} />
              Add provider
            </button>
          </nav>
          {current && (
            <div className="connection-form">
              <div className="form-grid">
                <label className="field-label">
                  Connection name
                  <input value={current.name} onChange={(e) => update({ name: e.target.value })} />
                </label>
                <label className="field-label">
                  Protocol
                  <select value={current.type} onChange={(e) => update({ type: e.target.value })}>
                    <option value="ollama">Ollama</option>
                    <option value="openai">OpenAI API</option>
                    <option value="compatible">OpenAI-compatible</option>
                  </select>
                </label>
              </div>
              <label className="field-label">
                Base URL
                <input
                  value={current.baseUrl}
                  onChange={(e) => update({ baseUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                />
              </label>
              <label className="field-label">
                API key{' '}
                <small>
                  {current.hasKey ? 'Saved • leave blank to keep' : 'Optional for local servers'}
                </small>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={current.apiKey || ''}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  placeholder={current.hasKey ? '••••••••••••••••' : 'API key'}
                />
              </label>
              <label className="field-label">
                Model
                <input
                  list="provider-models"
                  value={current.model || ''}
                  onChange={(e) => update({ model: e.target.value })}
                  placeholder="Enter or discover a model"
                />
                <datalist id="provider-models">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              <div className="connection-test">
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setStatus('');
                    try {
                      await persist();
                      const d = await api('/api/models', { providerId: selected });
                      setModels(d.models);
                      setStatus(
                        `Connected • ${d.models.length} model${d.models.length === 1 ? '' : 's'} available`,
                      );
                    } catch (e) {
                      setStatus(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}Save
                  & discover models
                </button>
              </div>
              {status && (
                <p className="connection-status" role="status">
                  {status}
                </p>
              )}
              <p className="connection-info">
                {current.type === 'ollama'
                  ? 'Start Ollama on your computer and pull a model first. The IDE connects through its backend, so browser CORS changes are unnecessary.'
                  : 'Use API credentials for this provider. A ChatGPT subscription does not configure this API connection.'}
              </p>
            </div>
          )}
        </div>
        <div className="native-settings">
          <label className="field-label">
            Native Vel compiler path <small>Optional · separately installed compiler</small>
            <input
              value={draft.compilerPath || ''}
              onChange={(e) => setDraft((s) => ({ ...s, compilerPath: e.target.value }))}
              placeholder="C:\\tools\\vel\\velc.exe"
            />
          </label>
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await persist();
                onClose();
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={14} />
            Save connections
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Plugins({ onClose, onError }) {
  const [plugins, setPlugins] = useState([]),
    [name, setName] = useState(''),
    [url, setUrl] = useState(''),
    [description, setDescription] = useState(''),
    [key, setKey] = useState(''),
    [busy, setBusy] = useState(false),
    [runId, setRunId] = useState(''),
    [input, setInput] = useState(''),
    [output, setOutput] = useState('');
  const refresh = async () => setPlugins((await api('/api/plugins')).plugins);
  useEffect(() => {
    refresh().catch(onError);
  }, []);
  return (
    <Modal title="Make your workspace yours." eyebrow="HTTP PLUGINS" wide onClose={onClose}>
      <div className="modal-body plugins">
        <p className="muted">
          Connect your own HTTP JSON tools. Each run sends <code>{'{ input: "..." }'}</code> to the
          endpoint you configure. These are HTTP integrations, not VS Code extensions or MCP
          servers.
        </p>
        <div className="plugin-list">
          {plugins.length ? (
            plugins.map((p) => (
              <article className="plugin-card" key={p.id}>
                <span className="plugin-icon">
                  <Plug size={19} />
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <p>{p.description || p.url}</p>
                  <small>{p.url}</small>
                </div>
                <button
                  className={`toggle ${p.enabled ? 'on' : ''}`}
                  aria-label={`${p.enabled ? 'Disable' : 'Enable'} ${p.name}`}
                  aria-pressed={p.enabled}
                  onClick={async () => {
                    try {
                      await api(`/api/plugins/${p.id}`, { enabled: !p.enabled }, 'PATCH');
                      await refresh();
                    } catch (e) {
                      onError(e);
                    }
                  }}
                >
                  <i />
                </button>
                <button
                  disabled={!p.enabled}
                  onClick={() => {
                    setRunId(p.id);
                    setOutput('');
                  }}
                >
                  Run
                </button>
                <IconButton
                  icon={Trash2}
                  title={`Remove ${p.name}`}
                  onClick={async () => {
                    if (!confirm(`Remove ${p.name}?`)) return;
                    try {
                      await api(`/api/plugins/${p.id}`, undefined, 'DELETE');
                      await refresh();
                      if (runId === p.id) setRunId('');
                    } catch (e) {
                      onError(e);
                    }
                  }}
                />
              </article>
            ))
          ) : (
            <div className="empty-plugins">
              <Plug size={24} />
              <strong>Your plugin shelf is ready.</strong>
              <span>Add an endpoint below to connect your first tool.</span>
            </div>
          )}
        </div>
        {runId && (
          <form
            className="plugin-run"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const d = await api(`/api/plugins/${runId}/run`, { input });
                setOutput(
                  typeof d.output === 'string' ? d.output : JSON.stringify(d.output, null, 2),
                );
              } catch (e) {
                setOutput(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Run {plugins.find((p) => p.id === runId)?.name}</h3>
            <textarea
              aria-label="Plugin input"
              placeholder="Input for this tool"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="primary" disabled={busy}>
              {busy ? 'Running…' : 'Run plugin'}
            </button>
            {output && <pre>{output}</pre>}
          </form>
        )}
        <form
          className="add-plugin"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api('/api/plugins', { name, url, description, apiKey: key });
              setName('');
              setUrl('');
              setDescription('');
              setKey('');
              await refresh();
            } catch (e) {
              onError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Add an integration</h3>
          <div className="form-grid">
            <label className="field-label">
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My design tool"
              />
            </label>
            <label className="field-label">
              Endpoint URL
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3001/run"
              />
            </label>
            <label className="field-label">
              Description
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this tool do?"
              />
            </label>
            <label className="field-label">
              Bearer token <small>Optional</small>
              <input
                type="password"
                autoComplete="new-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
          </div>
          <div className="modal-actions">
            <button className="primary" disabled={busy}>
              <Plus size={14} />
              Add plugin
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

createRoot(document.getElementById('root')).render(<App />);
