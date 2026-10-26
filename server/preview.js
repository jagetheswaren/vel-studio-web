import { isStudioSource } from '../shared/studio.js';
import { compileStudio } from './studio.js';
export const starter = `// Vel Preview DSL — an independent UI prototyping subset
// Edit this file to update the live preview.
#WelcomeScreen
V g=lg p=lg
  H g=sm
    Badge "✦  YOUR NEXT GREAT IDEA"
  T "Build something beautiful" size=hero font=bold animate=fade.up(0.6)
  T "A little code. A world of possibilities." fg=muted animate=fade.up(0.6) delay=0.1
  Orb animate=scale(0.8)
  H g=md
    Card p=md g=sm animate=fade.up(0.5) delay=0.2
      T "✧" size=xl fg=accent
      T "Design with code" font=bold
      T "Shape your ideas in real time." fg=muted
    Card p=md g=sm animate=fade.up(0.5) delay=0.3
      T "◈" size=xl fg=accent
      T "Make it move" font=bold
      T "Find the rhythm of your interface." fg=muted
  Progress value=0.65 animate=grow.x(0.8) delay=0.2
  Btn "Get started →" animate=fade.up(0.5) delay=0.4
`;

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const gaps = { xs: 4, sm: 8, md: 16, lg: 28, xl: 40 };
const runtime = `<script>
const animations=[];
for(const el of document.querySelectorAll('[data-motion]')){
 const name=el.dataset.motion;
 const from=name==='scale'?{transform:'scale(.85)',opacity:0}:name==='grow.x'?{transform:'scaleX(0)',transformOrigin:'left'}:name==='fade.up'?{transform:'translateY(20px)',opacity:0}:{opacity:0};
 const to={transform:'none',opacity:1};
 const a=el.animate([from,to],{duration:Number(el.dataset.duration),delay:Number(el.dataset.delay),fill:'both',easing:'cubic-bezier(.16,1,.3,1)'});
 a.pause();if(parent===window||matchMedia('(prefers-reduced-motion: reduce)').matches)a.currentTime=a.effect.getComputedTiming().endTime;animations.push(a);
}
window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='vel:seek')return;
 const time=Math.max(0,Math.min(60000,Number(e.data.time)||0));
 for(const a of animations){a.currentTime=time;if(e.data.playing)a.play();else a.pause();}
});
for(const b of document.querySelectorAll('button'))b.onclick=()=>{b.animate([{transform:'scale(.96)'},{transform:'scale(1)'}],{duration:180});const old=b.textContent;b.textContent='Ready to create ✓';setTimeout(()=>b.textContent=old,1400);};
parent.postMessage({type:'vel:ready'},'*');
</script>`;
const css = `*{box-sizing:border-box}body{margin:0;background:#f8f9f5;color:#17221f;font:15px/1.5 Inter,system-ui,sans-serif;padding:30px}main{max-width:850px;margin:auto}.v,.card{display:flex;flex-direction:column}.h{display:flex;align-items:stretch;flex-wrap:wrap}.h>*{flex:1;min-width:110px}.card{background:#fff;border:1px solid #e4e8e0;border-radius:18px;box-shadow:0 4px 20px #14251b04}.t{margin:0;line-height:1.45}.btn{cursor:pointer;align-self:flex-start;background:#25dca6;color:#072e24;border:0;border-radius:12px;padding:14px 25px;font:600 14px system-ui;box-shadow:0 5px 15px #25dca622}.btn:focus-visible,input:focus-visible{outline:3px solid #7061e8;outline-offset:3px}.badge{font-size:10px;letter-spacing:2px;background:#e0f7ed;color:#257259;padding:7px 12px;border-radius:30px;display:inline-block;align-self:flex-start;white-space:nowrap}.orb{width:140px;height:140px;align-self:center;border-radius:50%;background:radial-gradient(circle at 30% 25%,#ecfff8,#8bedce 35%,#20aa88 80%);box-shadow:20px 14px 45px #32d7ad35;position:relative;margin:8px}.orb:after{content:'';position:absolute;inset:-10px 15px;border:1px solid #43c8a977;border-radius:50%;transform:rotate(50deg)}.progress{height:7px;border-radius:12px;background:#e3e8e2;overflow:hidden}.progress>div{height:100%;background:#28d9a5;border-radius:12px}input{font:inherit;border:1px solid #d3ded7;padding:12px;border-radius:10px;background:white;width:100%}.divider{border:0;border-top:1px solid #dde5df;width:100%}@media(max-width:500px){body{padding:18px}.h{flex-direction:column}.t.hero{font-size:35px!important}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}`;

export function compilePreview(source, path = 'main.vel') {
  if (typeof source !== 'string' || source.length > 500000)
    throw new Error('Source must be text under 500 KB.');
  if (/\.html?$/i.test(path)) return { html: source, diagnostics: [], tracks: [], duration: 1000 };
  if (isStudioSource(source)) return compileStudio(source);
  const diagnostics = [],
    tracks = [],
    roots = [],
    stack = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1,
      text = raw.trim();
    if (!text || text.startsWith('//')) return;
    if (text.startsWith('#')) return;
    if (raw.includes('\t'))
      diagnostics.push({ line, message: 'Use spaces instead of tabs.', severity: 'warning' });
    const indent = raw.match(/^ */)[0].length;
    const match = text.match(/^(\w+)\b(.*)$/);
    if (!match) {
      diagnostics.push({ line, message: 'Expected a component name.', severity: 'error' });
      return;
    }
    const kind = match[1],
      rest = match[2];
    if (
      !['V', 'H', 'Card', 'T', 'Btn', 'In', 'Progress', 'Badge', 'Orb', 'Divider'].includes(kind)
    ) {
      diagnostics.push({
        line,
        message: `Unsupported component: ${kind}. See Preview DSL help.`,
        severity: 'error',
      });
      return;
    }
    const label = rest.match(/^\s*"((?:[^"\\]|\\.)*)"/);
    let content = '';
    if (label) {
      try {
        content = JSON.parse(label[0].trim());
      } catch {
        diagnostics.push({ line, message: 'Invalid quoted text.', severity: 'error' });
      }
    }
    const props = {};
    const propText = label ? rest.slice(label[0].length) : rest;
    const attr = /([\w.]+)=("(?:[^"\\]|\\.)*"|[^\s]+)/g;
    let m;
    while ((m = attr.exec(propText))) {
      let value = m[2];
      if (value.startsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {}
      }
      props[m[1]] = value;
    }
    const leftover = propText.replace(/([\w.]+)=("(?:[^"\\]|\\.)*"|[^\s]+)/g, '').trim();
    if (leftover)
      diagnostics.push({
        line,
        message: `Unrecognized syntax: ${leftover.slice(0, 50)}`,
        severity: 'error',
      });
    const known = [
      'g',
      'p',
      'size',
      'font',
      'fg',
      'value',
      'placeholder',
      'animate',
      'delay',
      'radius',
    ];
    for (const key of Object.keys(props))
      if (!known.includes(key))
        diagnostics.push({ line, message: `Unsupported property: ${key}`, severity: 'warning' });
    const node = { kind, props, content, children: [], line };
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();
    if (stack.length) {
      if (!['V', 'H', 'Card'].includes(stack.at(-1).node.kind))
        diagnostics.push({
          line,
          message: 'Only V, H and Card can contain children.',
          severity: 'error',
        });
      stack.at(-1).node.children.push(node);
    } else roots.push(node);
    stack.push({ indent, node });
  });
  function render(n) {
    const { kind: k, props: p } = n;
    let style = '';
    if (p.g) style += `gap:${gaps[p.g] ?? 16}px;`;
    if (p.p) style += `padding:${gaps[p.p] ?? 16}px;`;
    if (p.font === 'bold') style += 'font-weight:700;';
    const sizes = { sm: 12, md: 15, lg: 22, xl: 30, hero: 48 };
    if (p.size)
      style += `font-size:${sizes[p.size] ?? 15}px;${p.size === 'hero' ? 'letter-spacing:-2px;line-height:1.12;max-width:550px;' : ''}`;
    const colors = { accent: '#159f7c', muted: '#7c8783', text: '#17221f', violet: '#7761db' };
    if (colors[p.fg]) style += `color:${colors[p.fg]};`;
    if (p.radius && /^\d{1,2}$/.test(p.radius)) style += `border-radius:${p.radius}px;`;
    let motion = '';
    if (p.animate) {
      const a = p.animate.match(/^(fade\.up|fade|scale|grow\.x)\((\d*\.?\d+)\)$/);
      if (!a)
        diagnostics.push({
          line: n.line,
          message:
            'Animation must be fade.up(seconds), fade(seconds), scale(seconds) or grow.x(seconds).',
          severity: 'error',
        });
      else {
        const duration = Math.max(1, Math.min(30000, Number(a[2]) * 1000)),
          delay = Math.max(0, Math.min(30000, Number(p.delay || 0) * 1000 || 0));
        motion = ` data-motion="${a[1]}" data-duration="${duration}" data-delay="${delay}"`;
        tracks.push({ name: n.content.slice(0, 26) || k, property: a[1], duration, delay });
      }
    }
    const classes = {
      V: 'v',
      H: 'h',
      Card: 'card',
      T: 't',
      Btn: 'btn',
      In: 'input',
      Progress: 'progress',
      Badge: 'badge',
      Orb: 'orb',
      Divider: 'divider',
    };
    const attrs = `class="${classes[k]} ${p.size === 'hero' ? 'hero' : ''}" style="${style}"${motion}`;
    const inside = escape(n.content) + n.children.map(render).join('');
    if (k === 'In')
      return `<input ${attrs} placeholder="${escape(p.placeholder || n.content)}" aria-label="${escape(p.placeholder || n.content || 'Text input')}" />`;
    if (k === 'Progress') {
      const value = Number(p.value ?? 0);
      if (!Number.isFinite(value))
        diagnostics.push({
          line: n.line,
          message: 'Progress value must be a number.',
          severity: 'error',
        });
      const pct = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
      return `<div ${attrs} role="progressbar" aria-label="Progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pct}%"></div></div>`;
    }
    if (k === 'Divider') return `<hr ${attrs}/>`;
    const tag = k === 'Btn' ? 'button' : k === 'T' ? 'p' : 'div';
    return `<${tag} ${attrs}>${inside}</${tag}>`;
  }
  const markup = roots.map(render).join('');
  return {
    html: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main>${markup}</main>${runtime}</body></html>`,
    diagnostics,
    tracks,
    duration: Math.max(1000, ...tracks.map((t) => t.duration + t.delay)),
  };
}
