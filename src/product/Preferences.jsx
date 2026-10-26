import React, { useState } from 'react';
import {
  Palette,
  Code2,
  Save,
  Workflow,
  Moon,
  Sun,
  Sparkles,
  ArrowUpRight,
  LoaderCircle,
} from 'lucide-react';
import './product.css';

export const defaultPreferences = {
  theme: 'dark',
  editor: { fontSize: 14, tabSize: 2, wordWrap: true, minimap: false },
  autoSave: false,
  autoSaveDelay: 1500,
  reduceMotion: false,
  restoreSession: true,
};
function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="preference-toggle">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}
export default function Preferences({ preferences, onSaved, onClose, onConnections }) {
  const [draft, setDraft] = useState(structuredClone(preferences)),
    [tab, setTab] = useState('appearance'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const editor = (patch) => setDraft((d) => ({ ...d, editor: { ...d.editor, ...patch } }));
  async function save() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Vel-Client': 'local' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Preferences could not be saved.');
      onSaved(data);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="preferences">
      <nav>
        {[
          ['appearance', 'Appearance', Palette],
          ['editor', 'Editor', Code2],
          ['workflow', 'Workflow', Workflow],
        ].map(([id, label, Icon]) => (
          <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>
            <Icon size={16} />
            {label}
          </button>
        ))}
        <div />
        <button onClick={onConnections}>
          <Sparkles size={16} />
          AI connections
          <ArrowUpRight size={12} />
        </button>
      </nav>
      <div className="preferences-main">
        <div className="preferences-content">
          {tab === 'appearance' ? (
            <>
              <span className="product-eyebrow">MAKE IT FEEL LIKE YOURS</span>
              <h3>Appearance</h3>
              <p className="product-note">Choose the environment that helps you focus.</p>
              <span className="product-field-title">Workspace theme</span>
              <div className="theme-options">
                {['dark', 'light'].map((theme) => (
                  <button
                    key={theme}
                    aria-pressed={draft.theme === theme}
                    className={`${theme} ${draft.theme === theme ? 'selected' : ''}`}
                    onClick={() => update({ theme })}
                  >
                    <span className="theme-preview">
                      <i />
                      <div>
                        <b />
                        <b />
                        <b />
                      </div>
                      <em />
                    </span>
                    <strong>
                      {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}{' '}
                      {theme === 'dark' ? 'Midnight' : 'Daylight'}
                    </strong>
                  </button>
                ))}
              </div>
              <Toggle
                label="Reduce interface motion"
                description="Use restrained transitions in the Studio shell. Your authored animations stay editable."
                checked={draft.reduceMotion}
                onChange={(reduceMotion) => update({ reduceMotion })}
              />
            </>
          ) : tab === 'editor' ? (
            <>
              <span className="product-eyebrow">A LITTLE SPACE TO THINK</span>
              <h3>Editor</h3>
              <p className="product-note">Tune the code editor for the way you work.</p>
              <div className="preference-fields">
                <label className="product-field">
                  Font size
                  <input
                    type="number"
                    min={11}
                    max={24}
                    value={draft.editor.fontSize}
                    onChange={(e) => editor({ fontSize: Number(e.target.value) })}
                  />
                  <small>11–24 pixels</small>
                </label>
                <label className="product-field">
                  Tab size
                  <select
                    value={draft.editor.tabSize}
                    onChange={(e) => editor({ tabSize: Number(e.target.value) })}
                  >
                    <option value={2}>2 spaces</option>
                    <option value={4}>4 spaces</option>
                    <option value={8}>8 spaces</option>
                  </select>
                </label>
              </div>
              <Toggle
                label="Wrap long lines"
                description="Keep long lines visible without horizontal scrolling."
                checked={draft.editor.wordWrap}
                onChange={(wordWrap) => editor({ wordWrap })}
              />
              <Toggle
                label="Show minimap"
                description="Display a compact overview of the current file."
                checked={draft.editor.minimap}
                onChange={(minimap) => editor({ minimap })}
              />
              <div className="preference-code-sample" style={{ fontSize: draft.editor.fontSize }}>
                <span>// Your next idea</span>
                <br />
                <b>#WelcomeScreen</b>
                <br />
                &nbsp; T <em>"Hello, possibility."</em>
              </div>
            </>
          ) : (
            <>
              <span className="product-eyebrow">KEEP YOUR FLOW</span>
              <h3>Workflow</h3>
              <p className="product-note">Choose how your work is saved and reopened.</p>
              <Toggle
                label="Autosave the active file"
                description="Save the current file after you pause typing. Other open files still use manual Save."
                checked={draft.autoSave}
                onChange={(autoSave) => update({ autoSave })}
              />
              <label className="product-field autosave-delay">
                Autosave delay
                <input
                  disabled={!draft.autoSave}
                  type="number"
                  min={500}
                  max={30000}
                  step={100}
                  value={draft.autoSaveDelay}
                  onChange={(e) => update({ autoSaveDelay: Number(e.target.value) })}
                />
                <small>500–30,000 milliseconds</small>
              </label>
              <Toggle
                label="Restore the last project"
                description="Reopen your last saved file and view on startup. Otherwise start on Projects Home."
                checked={draft.restoreSession}
                onChange={(restoreSession) => update({ restoreSession })}
              />
              <p className="preference-local-note">
                Preferences and project files are stored by your local Vel Studio service.
              </p>
            </>
          )}
          {error && (
            <div className="product-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <footer className="preferences-actions">
          <span>Changes apply when you save.</span>
          <button onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="product-primary" onClick={save} disabled={busy}>
            {busy ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}Save
            preferences
          </button>
        </footer>
      </div>
    </div>
  );
}
