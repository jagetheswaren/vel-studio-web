import {
  parseStudio,
  evaluateAnimations,
  applyDesignAction,
  animationDuration,
} from '../shared/studio.js';
import { createSceneEngine } from '../shared/engine.js';

const root =
  document.getElementById('vel-player') || document.body.appendChild(document.createElement('div'));
const style = document.createElement('style');
style.textContent = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#10161e;color:#dfe9e7;font-family:Inter,Segoe UI,system-ui,sans-serif}button{font:inherit;cursor:pointer}button:focus-visible,[tabindex]:focus-visible{outline:2px solid #6fe4bb;outline-offset:3px}.vel-player{display:flex;flex-direction:column;height:100vh;min-height:300px;overflow:hidden}.vel-player-header{height:52px;flex:none;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid #ffffff15;background:#111923}.vel-player-brand{font-size:13px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.vel-player-brand:before{content:'◈';color:#6fe4bb;margin-right:9px}.vel-player-tabs{display:flex;gap:4px}.vel-player-header button{padding:7px 11px;border:1px solid #ffffff18;background:#192430;color:#bfcfc9;border-radius:6px;font-size:11px}.vel-player-header button.active{color:#6fe4bb;background:#244239;border-color:#6fe4bb40}.vel-player-stage{flex:1;min-height:0;overflow:auto;display:flex;justify-content:center;align-items:center;padding:22px;background:radial-gradient(#ffffff0c 1px,transparent 1px) 0 0/16px 16px}.vel-player-sizer{position:relative;flex:none}.vel-player-artboard{position:absolute;left:0;top:0;overflow:hidden;transform-origin:top left;box-shadow:0 10px 60px #0004}.vel-player-node{position:absolute;box-sizing:border-box;white-space:pre-wrap;overflow:hidden;border:0;line-height:1.2;transform-origin:center center}.vel-player-scene{position:relative;flex:1;min-height:0;display:none}.vel-player-footer{height:30px;flex:none;display:flex;gap:12px;justify-content:space-between;padding:7px 14px;color:#82948f;border-top:1px solid #ffffff12;font-size:10px}.vel-player-error{padding:30px;max-width:650px;color:#f1c9b6;font-size:14px;line-height:1.6}.vel-player-error strong{display:block;margin-bottom:10px;color:#f9e5dd}@media(max-width:480px){.vel-player-header{gap:5px;padding:0 9px}.vel-player-brand{font-size:11px}.vel-player-header button{padding:7px}.vel-player-stage{padding:12px}.vel-player-footer{font-size:9px}.vel-player-footer span:last-child{display:none}}
`;
document.head.append(style);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

try {
  let doc = parseStudio(document.getElementById('vel-document')?.textContent || '');
  let sceneEngine = null,
    currentView = 'design',
    playing = false,
    time = animationDuration(doc),
    last = 0,
    disposed = false;
  const shell = element('div', 'vel-player'),
    header = element('header', 'vel-player-header');
  const brand = element('div', 'vel-player-brand', doc.name),
    tabs = element('nav', 'vel-player-tabs');
  tabs.setAttribute('aria-label', 'Runtime view');
  const designButton = element('button', 'active', 'Design'),
    sceneButton = element('button', '', 'Scene');
  const playButton = element('button', '', '▶ Play'),
    resetButton = element('button', '', 'Reset');
  for (const b of [designButton, sceneButton, playButton, resetButton]) b.type = 'button';
  tabs.append(designButton, sceneButton);
  header.append(brand, tabs, playButton, resetButton);
  const stage = element('div', 'vel-player-stage'),
    sizer = element('div', 'vel-player-sizer'),
    board = element('div', 'vel-player-artboard');
  stage.setAttribute('aria-label', 'Design runtime');
  board.setAttribute('aria-label', doc.name + ' artboard');
  sizer.append(board);
  stage.append(sizer);
  const sceneContainer = element('div', 'vel-player-scene');
  sceneContainer.setAttribute('aria-label', 'Scene runtime');
  const footer = element('footer', 'vel-player-footer'),
    status = element('span', '', 'Interactive preview'),
    help = element('span', '', 'One document · Design + scene + motion');
  footer.append(status, help);
  shell.append(header, stage, sceneContainer, footer);
  root.replaceChildren(shell);
  const nodeElements = new Map();
  for (const node of doc.design.nodes) {
    const el = element(node.type === 'button' ? 'button' : 'div', 'vel-player-node');
    el.dataset.nodeId = node.id;
    if (node.type === 'button') {
      el.type = 'button';
      el.addEventListener('click', () => {
        doc = applyDesignAction(doc, node.id);
        renderDesign();
      });
    }
    nodeElements.set(node.id, el);
    board.append(el);
  }
  function fit() {
    const scale = Math.min(
      1,
      Math.max(0.05, (stage.clientWidth - 44) / doc.design.width),
      Math.max(0.05, (stage.clientHeight - 44) / doc.design.height),
    );
    sizer.style.width = `${doc.design.width * scale}px`;
    sizer.style.height = `${doc.design.height * scale}px`;
    board.style.width = `${doc.design.width}px`;
    board.style.height = `${doc.design.height}px`;
    board.style.transform = `scale(${scale})`;
  }
  function renderDesign() {
    const sampled = evaluateAnimations(doc, time);
    board.style.background = sampled.design.background;
    for (const node of sampled.design.nodes) {
      const el = nodeElements.get(node.id);
      if (!el) continue;
      const textNode = node.type === 'text';
      Object.assign(el.style, {
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`,
        height: `${node.height}px`,
        transform: `rotate(${node.rotation || 0}deg) scale(${node.scale ?? 1})`,
        opacity: String(node.opacity ?? 1),
        display: node.visible === false ? 'none' : node.type === 'button' ? 'flex' : 'block',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: node.type === 'button' ? 'center' : 'left',
        background: textNode ? 'transparent' : node.fill,
        color: node.color || '#eef3f8',
        borderRadius: node.type === 'ellipse' ? '50%' : `${node.radius || 0}px`,
        fontSize: `${node.fontSize || 16}px`,
        fontWeight: textNode && (node.fontSize || 16) >= 28 ? '650' : '500',
        padding: node.type === 'button' ? '0 12px' : '0',
      });
      el.textContent = node.text || '';
      if (node.type === 'button') el.setAttribute('aria-label', node.text || node.name);
    }
  }
  function updatePlayback() {
    playButton.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    playButton.classList.toggle('active', playing);
    sceneEngine?.setPlaying(playing);
    status.textContent =
      currentView === 'scene'
        ? playing
          ? 'Click scene · WASD / arrows · Space jump'
          : 'Scene paused · Drag to orbit · Scroll to zoom'
        : playing
          ? 'Playing design animation'
          : 'Interactive preview · Try the buttons';
  }
  function showView(view) {
    currentView = view;
    stage.style.display = view === 'design' ? 'flex' : 'none';
    sceneContainer.style.display = view === 'scene' ? 'block' : 'none';
    designButton.classList.toggle('active', view === 'design');
    sceneButton.classList.toggle('active', view === 'scene');
    if (view === 'scene' && !sceneEngine) {
      try {
        sceneEngine = createSceneEngine(sceneContainer, doc, {
          editable: false,
          showGrid: true,
          onStatus: (next) => {
            if (next.error) status.textContent = next.error;
          },
        });
        sceneEngine.seek(time);
      } catch (e) {
        const error = element('div', 'vel-player-error');
        error.append(
          element('strong', '', 'The 3D scene needs WebGL 2'),
          document.createTextNode(e.message),
        );
        sceneContainer.replaceChildren(error);
      }
    }
    if (view === 'design') fit();
    updatePlayback();
  }
  designButton.onclick = () => showView('design');
  sceneButton.onclick = () => showView('scene');
  playButton.onclick = () => {
    if (!playing && currentView === 'design' && time >= animationDuration(doc)) time = 0;
    playing = !playing;
    updatePlayback();
  };
  resetButton.onclick = () => {
    playing = false;
    time = 0;
    sceneEngine?.reset();
    renderDesign();
    updatePlayback();
  };
  const observer = new ResizeObserver(fit);
  observer.observe(stage);
  function onMessage(e) {
    if (e.source !== parent || e.data?.type !== 'vel:seek') return;
    time = Math.max(0, Math.min(600000, Number(e.data.time) || 0));
    playing = Boolean(e.data.playing);
    sceneEngine?.seek(time);
    renderDesign();
    updatePlayback();
  }
  window.addEventListener('message', onMessage);
  function tick(now) {
    if (disposed) return;
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    if (playing) {
      time += dt;
      if (currentView === 'design') {
        renderDesign();
        if (time >= animationDuration(doc) && !doc.animations.some((a) => a.loop)) {
          playing = false;
          updatePlayback();
        }
      }
    }
    requestAnimationFrame(tick);
  }
  window.addEventListener(
    'pagehide',
    () => {
      disposed = true;
      observer.disconnect();
      sceneEngine?.dispose();
      window.removeEventListener('message', onMessage);
    },
    { once: true },
  );
  renderDesign();
  fit();
  updatePlayback();
  requestAnimationFrame(tick);
  parent.postMessage({ type: 'vel:ready' }, '*');
} catch (e) {
  root.replaceChildren(
    element('div', 'vel-player-error', `This studio document could not be loaded: ${e.message}`),
  );
}
