// One serializable document drives the code editor, designer, scene and runtime.
export const STUDIO_VERSION = 1;
export const designTypes = ['frame','rect','ellipse','text','button'];
export const entityTypes = ['box','sphere','plane','cylinder','torus'];
export const studioTemplates = [
 {id:'starter',name:'Product studio',description:'A product interface, animated 3D scene, and linked button interactions.'},
 {id:'game',name:'Playground',description:'A keyboard-controlled player, bouncing objects, gravity and ground collision.'},
 {id:'blank',name:'Blank canvas',description:'An empty design artboard and scene ready for your own idea.'}
];
export const makeId = (prefix='item') => `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)}`;
const clone = value => structuredClone(value);
export const isStudioSource = source => typeof source==='string' && source.trimStart().startsWith('{');
export function serializeStudio(doc){ return JSON.stringify(doc,null,2)+'\n'; }

const nodeDefaults = {
 frame:{width:360,height:240,fill:'#202b3b',radius:20},
 rect:{width:160,height:100,fill:'#6fe4bb',radius:16},
 ellipse:{width:120,height:120,fill:'#b9a1f4',radius:60},
 text:{width:360,height:64,fill:'#000000',text:'Your next idea',color:'#eef3f8',fontSize:28,radius:0},
 button:{width:180,height:48,fill:'#6fe4bb',text:'Get started',color:'#11271f',fontSize:16,radius:12}
};
function newNode(type,index=0){if(!designTypes.includes(type))throw new Error('Unknown design node type.');return {id:makeId(type),type,name:type[0].toUpperCase()+type.slice(1),x:40+index*12,y:40+index*12,rotation:0,opacity:1,visible:true,locked:false,...nodeDefaults[type]};}
function newEntity(type,index=0){if(!entityTypes.includes(type))throw new Error('Unknown scene entity type.');return {id:makeId(type),type,name:type[0].toUpperCase()+type.slice(1),position:[index*1.5,1,0],rotation:type==='plane'?[-90,0,0]:[0,0,0],scale:type==='plane'?[12,12,1]:[1,1,1],color:type==='plane'?'#293747':'#6fe4bb',visible:true,opacity:1,physics:{enabled:false,mass:1,restitution:0.4},behavior:{type:'none',speed:1}};}

export function createStudioTemplate(id='starter'){
 if(!studioTemplates.some(t=>t.id===id))throw new Error('Unknown studio template.');
 const doc={kind:'vel-studio',version:1,name:id==='game'?'Motion playground':id==='blank'?'Untitled studio':'Forma — product studio',design:{width:960,height:640,background:'#111b25',nodes:[]},scene:{background:'#101924',camera:{position:[7,5,9],target:[0,1,0],fov:45},lighting:{ambient:0.8,directional:2},physics:{gravity:-9.8,groundY:0},entities:[]},animations:[]};
 if(id==='blank')return doc;
 const design=doc.design.nodes;
 design.push({...newNode('text'),id:'brand',name:'Brand',x:52,y:32,width:260,height:28,text:'◈  FORMA STUDIO',fontSize:18,color:'#83ebc5'});
 design.push({...newNode('text'),id:'eyebrow',name:'Eyebrow',x:56,y:112,width:400,height:24,text:'ONE IDEA. EVERY DIMENSION.',fontSize:13,color:'#95a4b5'});
 design.push({...newNode('text'),id:'headline',name:'Hero headline',x:52,y:160,width:590,height:150,text:id==='game'?'Make a world.\nThen step inside.':'Design it.\nBring it to life.',fontSize:58,color:'#f1f6fa'});
 design.push({...newNode('text'),id:'description',name:'Supporting copy',x:56,y:335,width:520,height:66,text:'A shared canvas for interfaces, code,\nand worlds that move.',fontSize:20,color:'#9aabbc'});
 design.push({...newNode('ellipse'),id:'orb-back',name:'Violet orb',x:730,y:143,width:155,height:155,fill:'#ad92e5',opacity:0.85});
 design.push({...newNode('ellipse'),id:'orb-front',name:'Mint orb',x:655,y:225,width:194,height:194,fill:'#69dfb6'});
 design.push({...newNode('button'),id:'cta',name:'Primary action',x:56,y:444,width:208,height:54,text:'Create something →',action:{type:'setText',target:'status',value:'Your idea is ready to build.'}});
 design.push({...newNode('text'),id:'status',name:'Interaction status',x:56,y:522,width:600,height:30,text:'Click the button in Run preview to try the interaction.',fontSize:14,color:'#9aabbc'});
 design.push({...newNode('rect'),id:'divider',name:'Footer rule',x:56,y:587,width:848,height:1,fill:'#334255',radius:0});
 const floor={...newEntity('plane'),id:'ground',name:'Ground',position:[0,-0.02,0],rotation:[-90,0,0],scale:[16,16,1],color:'#253342'};
 const cube={...newEntity('box'),id:'hero-cube',name:id==='game'?'Player':'Mint sculpture',position:[0,1,0],rotation:[0,25,0],scale:[1.5,1.5,1.5],color:'#6fe4bb',physics:{enabled:id==='game',mass:1,restitution:0.1},behavior:{type:id==='game'?'player':'spin',speed:id==='game'?4:0.5}};
 const sphere={...newEntity('sphere'),id:'violet-sphere',name:'Violet sphere',position:[2.6,2,0],scale:[0.8,0.8,0.8],color:'#b9a1f4',physics:{enabled:id==='game',mass:1,restitution:0.8},behavior:{type:id==='game'?'none':'bob',speed:1}};
 doc.scene.entities.push(floor,cube,sphere,{...newEntity('torus'),id:'accent-ring',name:'Orbit ring',position:[-2.8,1.5,-1],rotation:[25,0,0],scale:[0.9,0.9,0.9],color:'#f4bc76',behavior:{type:'spin',speed:0.35}});
 doc.animations.push({id:'entrance-headline',target:'headline',property:'opacity',from:0,to:1,duration:900,delay:0,loop:false},{id:'float-orb',target:'orb-front',property:'y',from:250,to:215,duration:2200,delay:0,loop:true});
 return doc;
}

export function validateStudio(doc){
 const errors=[];const issue=(path,message,severity='error')=>errors.push({path,message,severity});
 const obj=(v,p)=>{if(!v||typeof v!=='object'||Array.isArray(v)){issue(p,'Expected an object.');return false;}return true;};
 const num=(v,p,min=-100000,max=100000)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)issue(p,`Expected a finite number from ${min} to ${max}.`);};
 const str=(v,p,max=500)=>{if(typeof v!=='string'||v.length>max)issue(p,`Expected text up to ${max} characters.`);};
 const color=(v,p)=>{if(typeof v!=='string'||!/^#[\da-f]{6}$/i.test(v))issue(p,'Use a six-digit hex color, for example #6fe4bb.');};
 const vec=(v,p,min=-10000,max=10000)=>{if(!Array.isArray(v)||v.length!==3)issue(p,'Expected an array of three numbers.');else v.forEach((n,i)=>num(n,`${p}[${i}]`,min,max));};
 const bool=(v,p)=>{if(v!==undefined&&typeof v!=='boolean')issue(p,'Expected true or false.');};
 if(!obj(doc,'document'))return errors;
 if(doc.kind!=='vel-studio')issue('kind','Expected "vel-studio".');if(doc.version!==1)issue('version','Only schema version 1 is supported.');str(doc.name,'name',120);
 const ids=new Map();function id(item,p,space){if(typeof item.id!=='string'||!/^[a-z][\w-]{0,79}$/i.test(item.id))issue(p+'.id','Use a letter followed by up to 79 letters, numbers, dashes or underscores.');else if(ids.has(item.id))issue(p+'.id','IDs must be unique across the document.');else ids.set(item.id,{space,item});}
 function array(value,p,max){if(!Array.isArray(value)||value.length>max){issue(p,`Expected an array with at most ${max} items.`);return [];}return value;}
 const nodes=obj(doc.design,'design')?array(doc.design.nodes,'design.nodes',500):[];
 if(doc.design){num(doc.design.width,'design.width',100,10000);num(doc.design.height,'design.height',100,10000);color(doc.design.background,'design.background');}
 nodes.forEach((n,i)=>{const p=`design.nodes[${i}]`;if(!obj(n,p))return;id(n,p,'design');if(!designTypes.includes(n.type))issue(p+'.type','Unsupported design type.');str(n.name,p+'.name',120);for(const k of ['x','y'])num(n[k],p+'.'+k);for(const k of ['width','height'])num(n[k],p+'.'+k,1,10000);if(n.rotation!==undefined)num(n.rotation,p+'.rotation',-36000,36000);if(n.scale!==undefined)num(n.scale,p+'.scale',0.01,100);if(n.fill!==undefined)color(n.fill,p+'.fill');if(n.color!==undefined)color(n.color,p+'.color');if(n.opacity!==undefined)num(n.opacity,p+'.opacity',0,1);if(n.fontSize!==undefined)num(n.fontSize,p+'.fontSize',6,500);if(n.radius!==undefined)num(n.radius,p+'.radius',0,5000);if(n.text!==undefined)str(n.text,p+'.text',15000);bool(n.visible,p+'.visible');bool(n.locked,p+'.locked');});
 const scene=obj(doc.scene,'scene')?doc.scene:null;const entities=scene?array(scene.entities,'scene.entities',200):[];
 if(scene){color(scene.background,'scene.background');if(obj(scene.camera,'scene.camera')){vec(scene.camera.position,'scene.camera.position');vec(scene.camera.target,'scene.camera.target');num(scene.camera.fov,'scene.camera.fov',10,120);}if(obj(scene.lighting,'scene.lighting')){num(scene.lighting.ambient,'scene.lighting.ambient',0,10);num(scene.lighting.directional,'scene.lighting.directional',0,20);}if(obj(scene.physics,'scene.physics')){num(scene.physics.gravity,'scene.physics.gravity',-100,100);num(scene.physics.groundY,'scene.physics.groundY',-10000,10000);}}
 entities.forEach((e,i)=>{const p=`scene.entities[${i}]`;if(!obj(e,p))return;id(e,p,'scene');if(!entityTypes.includes(e.type))issue(p+'.type','Unsupported scene primitive.');str(e.name,p+'.name',120);vec(e.position,p+'.position');vec(e.rotation,p+'.rotation',-36000,36000);vec(e.scale,p+'.scale',0.01,1000);color(e.color,p+'.color');bool(e.visible,p+'.visible');if(e.opacity!==undefined)num(e.opacity,p+'.opacity',0,1);if(e.physics!==undefined&&obj(e.physics,p+'.physics')){bool(e.physics.enabled,p+'.physics.enabled');if(e.physics.mass!==undefined)num(e.physics.mass,p+'.physics.mass',0.01,10000);if(e.physics.restitution!==undefined)num(e.physics.restitution,p+'.physics.restitution',0,1);}if(e.behavior!==undefined&&obj(e.behavior,p+'.behavior')){if(!['none','spin','bob','player'].includes(e.behavior.type))issue(p+'.behavior.type','Use none, spin, bob or player.');num(e.behavior.speed,p+'.behavior.speed',0,100);}});
 nodes.forEach((n,i)=>{if(!n?.action)return;const p=`design.nodes[${i}].action`;if(!obj(n.action,p))return;if(!['toggle','setText','increment'].includes(n.action.type))issue(p+'.type','Use toggle, setText or increment.');const target=ids.get(n.action.target);if(!target||target.space!=='design')issue(p+'.target','Target must name an existing design node.');else if(['setText','increment'].includes(n.action.type)&&!['text','button'].includes(target.item.type))issue(p+'.target','Text actions need a text or button target.');if(n.action.type==='setText')str(n.action.value,p+'.value',15000);});
 const animations=array(doc.animations,'animations',500),animationIds=new Set();
 animations.forEach((a,i)=>{const p=`animations[${i}]`;if(!obj(a,p))return;if(typeof a.id!=='string'||!a.id||animationIds.has(a.id))issue(p+'.id','Animation IDs must be nonempty and unique.');animationIds.add(a.id);const target=ids.get(a.target);if(!target)issue(p+'.target','Animation target must exist.');const allowed=target?.space==='design'?['x','y','rotation','opacity','scale']:['x','y','z','rotation','rotationX','rotationY','rotationZ','opacity','scale'];if(!allowed.includes(a.property))issue(p+'.property','Unsupported animation property for this target.');num(a.from,p+'.from');num(a.to,p+'.to');if(a.property==='opacity'){num(a.from,p+'.from',0,1);num(a.to,p+'.to',0,1);}if(a.property==='scale'){num(a.from,p+'.from',0.01,100);num(a.to,p+'.to',0.01,100);}num(a.duration,p+'.duration',1,60000);num(a.delay,p+'.delay',0,60000);bool(a.loop,p+'.loop');});
 // Never use inherited keys as data or pass them into an extension API.
 function scan(value,p,depth=0){if(depth>20){issue(p,'Document nesting is too deep.');return;}if(value&&typeof value==='object')for(const k of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(k))issue(p+'.'+k,'Reserved object property.');else scan(value[k],p+'.'+k,depth+1);}}scan(doc,'document');
 return errors;
}
export function parseStudio(source){
 if(typeof source!=='string'||source.length>500000)throw new Error('Studio source must be text under 500 KB.');let doc;try{doc=JSON.parse(source);}catch(e){throw new Error('Invalid studio JSON: '+e.message);}
 const errors=validateStudio(doc).filter(e=>e.severity==='error');if(errors.length)throw new Error(errors.slice(0,8).map(e=>e.path+': '+e.message).join('\n'));return doc;
}
export function updateItem(doc,space,id,patch){const next=clone(doc),items=space==='design'?next.design.nodes:space==='scene'?next.scene.entities:null;if(!items)throw new Error('Unknown document space.');const index=items.findIndex(n=>n.id===id);if(index<0)throw new Error('Item not found.');if(patch.id!==undefined&&patch.id!==id)throw new Error('An item ID cannot be changed.');items[index]={...items[index],...clone(patch),id};return next;}
export function addDesignNode(doc,type){const next=clone(doc);next.design.nodes.push(newNode(type,next.design.nodes.length%10));return next;}
export function addEntity(doc,type){const next=clone(doc);next.scene.entities.push(newEntity(type,next.scene.entities.length%5));return next;}
export function removeItem(doc,space,id){const next=clone(doc);if(space==='design'){next.design.nodes=next.design.nodes.filter(n=>n.id!==id);next.design.nodes.forEach(n=>{if(n.action?.target===id)delete n.action;});}else if(space==='scene')next.scene.entities=next.scene.entities.filter(e=>e.id!==id);else throw new Error('Unknown document space.');next.animations=next.animations.filter(a=>a.target!==id);return next;}
export function duplicateItem(doc,space,id){const next=clone(doc),items=space==='design'?next.design.nodes:space==='scene'?next.scene.entities:null;if(!items)throw new Error('Unknown document space.');const original=items.find(n=>n.id===id);if(!original)throw new Error('Item not found.');const copy=clone(original);copy.id=makeId(copy.type);copy.name+=' copy';if(space==='design'){copy.x+=24;copy.y+=24;}else copy.position[0]+=1.5;items.push(copy);return next;}
export function animationDuration(doc){return Math.max(1000,...doc.animations.map(a=>a.duration+a.delay));}
export function evaluateAnimations(doc,time){
 const next=clone(doc);const targets=new Map([...next.design.nodes.map(n=>[n.id,{space:'design',item:n}]),...next.scene.entities.map(n=>[n.id,{space:'scene',item:n}])]);
 for(const a of next.animations){const target=targets.get(a.target);if(!target)continue;const elapsed=Math.max(0,Number(time)||0)-a.delay;let t=elapsed/a.duration;if(a.loop&&elapsed>=0)t=(elapsed%a.duration)/a.duration;t=Math.max(0,Math.min(1,t));const eased=t*t*(3-2*t),value=a.from+(a.to-a.from)*eased,n=target.item;
  if(target.space==='design')n[a.property]=value;
  else if(['x','y','z'].includes(a.property))n.position[['x','y','z'].indexOf(a.property)]=value;
  else if(['rotation','rotationX','rotationY','rotationZ'].includes(a.property))n.rotation[a.property==='rotation'?1:['rotationX','rotationY','rotationZ'].indexOf(a.property)]=value;
  else if(a.property==='scale')n.scale=[value,value,value];else if(a.property==='opacity')n.opacity=value;
 }return next;
}
export function applyDesignAction(doc,nodeId){const next=clone(doc),node=next.design.nodes.find(n=>n.id===nodeId),action=node?.action,target=next.design.nodes.find(n=>n.id===action?.target);if(!target)return next;if(action.type==='toggle')target.visible=target.visible===false;else if(action.type==='setText')target.text=String(action.value??'');else if(action.type==='increment')target.text=String((Number.parseFloat(target.text)||0)+1);return next;}
