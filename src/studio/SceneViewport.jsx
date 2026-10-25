import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, RotateCcw } from 'lucide-react';
import { createSceneEngine } from '../../shared/engine.js';

export default function SceneViewport({ document: studioDocument, selectedId, onSelect, onTransform, playing = false, time = 0, showGrid = true, transformMode = 'translate', onStatus }) {
  const container = useRef(null), engine = useRef(null), callbacks = useRef({ onSelect, onTransform, onStatus });
  const [status, setStatus] = useState({ fps: 0, entities: 0, playing: false }), [error, setError] = useState(''), [generation, setGeneration] = useState(0);
  callbacks.current = { onSelect, onTransform, onStatus };
  useEffect(() => {
    try {
      setError('');
      engine.current = createSceneEngine(container.current, studioDocument, {
        onSelect: id => callbacks.current.onSelect?.(id),
        onTransform: (id, patch) => callbacks.current.onTransform?.(id, patch),
        onStatus: next => { setStatus(next); if (next.error) setError(next.error); callbacks.current.onStatus?.(next); }
      });
    } catch (e) { setError(e.message); callbacks.current.onStatus?.({ fps: 0, entities: 0, playing: false, error: e.message }); }
    return () => { engine.current?.dispose(); engine.current = null; };
  }, [generation]);
  useEffect(() => { engine.current?.setDocument(studioDocument); }, [studioDocument, generation]);
  useEffect(() => { engine.current?.setSelected(selectedId); }, [selectedId, generation]);
  useEffect(() => { engine.current?.setPlaying(playing); }, [playing, generation]);
  useEffect(() => { engine.current?.seek(time); }, [time, generation]);
  useEffect(() => { engine.current?.setGrid(showGrid); }, [showGrid, generation]);
  useEffect(() => { engine.current?.setTransformMode(transformMode); }, [transformMode, generation]);
  return <div className="scene-viewport-shell" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background: studioDocument.scene.background }}>
    <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    {error ? <div role="alert" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 15, padding: 30, color: '#dce7e4', background: '#151d26e8', textAlign: 'center' }}><AlertTriangle size={26}/><strong>3D viewport unavailable</strong><span style={{ fontSize: 13, maxWidth: 420 }}>{error}</span><button onClick={() => setGeneration(g => g + 1)}><RotateCcw size={13}/> Recreate viewport</button></div> : <>
      <div style={{ position: 'absolute', left: 14, top: 12, pointerEvents: 'none', color: '#adbfbc', font: '11px system-ui', background: '#101820b8', border: '1px solid #ffffff12', borderRadius: 7, padding: '7px 10px' }}>{status.entities} entities · {status.fps} FPS · {playing ? 'PLAYING' : 'EDIT MODE'}</div>
      <button title="Download scene screenshot" aria-label="Download scene screenshot" onClick={() => { const href = engine.current?.screenshot(); if (!href) return; const a = window.document.createElement('a'); a.href = href; a.download = 'vel-scene.png'; a.click(); }} style={{ position: 'absolute', right: 12, top: 12, padding: 8, background: '#101820b8', color: '#bfcdc9', border: '1px solid #ffffff19', borderRadius: 7 }}><Camera size={15}/></button>
      <div style={{ position: 'absolute', left: 14, bottom: 12, right: 14, pointerEvents: 'none', color: '#a9bbb5', font: '11px/1.5 system-ui', background: '#101820a8', padding: '7px 10px', borderRadius: 7 }}>{playing ? 'Click viewport · WASD / arrows to move · Space to jump · Drag to orbit' : 'Drag to orbit · Scroll to zoom · Click an object to select · Gizmo edits save to source'}<br/><span style={{ opacity: .7 }}>Physics: gravity and ground collision only.</span></div>
    </>}
  </div>;
}
