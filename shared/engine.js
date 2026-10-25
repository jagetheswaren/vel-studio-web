import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { evaluateAnimations } from './studio.js';

const radians = (degrees) => (degrees * Math.PI) / 180;
const degrees = (angle) => Math.round(((angle * 180) / Math.PI) * 1000) / 1000;
const round = (value) => Math.round(value * 1000) / 1000;

/** Small WebGL scene runtime: gravity and ground collision, not a rigidbody solver. */
export function createSceneEngine(container, initialDocument, options = {}) {
  if (!container) throw new Error('A viewport container is required.');
  let doc = initialDocument,
    selectedId = null,
    playing = false,
    disposed = false;
  let frame = 0,
    last = 0,
    elapsed = 0,
    animationTime = 0,
    frames = 0,
    statusTime = performance.now(),
    cameraSignature = '';
  let pointerDown = null,
    draggedGizmo = false,
    jumpRequested = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    throw new Error(
      '3D needs WebGL 2. Enable hardware acceleration in your browser and reload the scene.',
    );
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    'aria-label',
    '3D scene viewport. Drag to orbit. Select an object to edit. Focus and play for WASD or arrow keys and Space to jump.',
  );
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;touch-action:none;';
  container.append(canvas);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.09;
  orbit.minDistance = 0.5;
  orbit.maxDistance = 200;
  const transforms = new TransformControls(camera, canvas);
  transforms.setSize(0.85);
  scene.add(transforms.getHelper());
  const grid = new THREE.GridHelper(40, 40, '#49605d', '#263a37');
  grid.position.y = -0.005;
  grid.visible = options.showGrid !== false;
  scene.add(grid);
  const ambient = new THREE.HemisphereLight('#e0fff6', '#28313c', 0.8);
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(5, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  // Offset shadow comparisons off the lit surface to prevent self-shadow striping.
  sun.shadow.bias = -0.0001;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -12;
  sun.shadow.camera.right = sun.shadow.camera.top = 12;
  scene.add(ambient, sun);
  const meshes = new Map(),
    simulation = new Map(),
    keys = new Set();
  const raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2(),
    bounds = new THREE.Box3();
  let selectionBox = null;
  const events = [];
  function listen(target, type, callback, config) {
    target.addEventListener(type, callback, config);
    events.push(() => target.removeEventListener(type, callback, config));
  }
  function releaseMesh(mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material.dispose();
  }
  function clearSelectionBox() {
    if (!selectionBox) return;
    scene.remove(selectionBox);
    selectionBox.geometry.dispose();
    selectionBox.material.dispose();
    selectionBox = null;
  }
  function makeGeometry(type) {
    if (type === 'sphere') return new THREE.SphereGeometry(0.5, 32, 24);
    if (type === 'plane') return new THREE.PlaneGeometry(1, 1);
    if (type === 'cylinder') return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    if (type === 'torus') return new THREE.TorusGeometry(0.5, 0.16, 16, 48);
    return new THREE.BoxGeometry(1, 1, 1);
  }
  function restoreSimulation() {
    simulation.clear();
    for (const entity of doc.scene.entities)
      simulation.set(entity.id, {
        y: entity.position[1],
        vx: 0,
        vz: 0,
        vy: 0,
        x: 0,
        z: 0,
        grounded: false,
      });
    keys.clear();
    jumpRequested = false;
  }
  function setSelected(id) {
    selectedId = id;
    clearSelectionBox();
    const mesh = meshes.get(id);
    if (mesh && mesh.visible && !playing && options.editable !== false) {
      transforms.attach(mesh);
      selectionBox = new THREE.BoxHelper(mesh, '#6ce8ba');
      scene.add(selectionBox);
    } else transforms.detach();
  }
  function configureDocument(next, resetCamera = false) {
    doc = next;
    transforms.detach();
    clearSelectionBox();
    for (const mesh of meshes.values()) releaseMesh(mesh);
    meshes.clear();
    scene.background = new THREE.Color(doc.scene.background || '#111827');
    ambient.intensity = doc.scene.lighting?.ambient ?? 0.8;
    sun.intensity = doc.scene.lighting?.directional ?? 2;
    grid.position.y = (doc.scene.physics?.groundY ?? 0) - 0.005;
    const nextCameraSignature = JSON.stringify(doc.scene.camera);
    if (resetCamera || nextCameraSignature !== cameraSignature) {
      camera.position.fromArray(doc.scene.camera?.position || [7, 5, 9]);
      orbit.target.fromArray(doc.scene.camera?.target || [0, 1, 0]);
    }
    cameraSignature = nextCameraSignature;
    camera.fov = doc.scene.camera?.fov ?? 45;
    camera.updateProjectionMatrix();
    for (const entity of doc.scene.entities) {
      const material = new THREE.MeshStandardMaterial({
        color: entity.color || '#69dfb7',
        roughness: 0.45,
        metalness: 0.08,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(makeGeometry(entity.type), material);
      mesh.userData.velId = entity.id;
      mesh.name = entity.name;
      mesh.castShadow = entity.type !== 'plane';
      mesh.receiveShadow = true;
      mesh.visible = entity.visible !== false;
      meshes.set(entity.id, mesh);
      scene.add(mesh);
    }
    elapsed = 0;
    restoreSimulation();
    applyPose(0);
    setSelected(selectedId);
  }
  function applyPose(dt) {
    const sampled = evaluateAnimations(doc, animationTime);
    const gravity = doc.scene.physics?.gravity ?? -9.8;
    const floor = doc.scene.physics?.groundY ?? 0;
    for (const entity of sampled.scene.entities) {
      const original = doc.scene.entities.find((e) => e.id === entity.id);
      const mesh = meshes.get(entity.id),
        state = simulation.get(entity.id);
      if (!mesh || !state) continue;
      if (transforms.dragging && transforms.object === mesh) continue;
      mesh.visible = entity.visible !== false;
      mesh.position.fromArray(entity.position);
      mesh.rotation.set(...entity.rotation.map(radians));
      mesh.scale.fromArray(entity.scale);
      mesh.material.color.set(entity.color);
      mesh.material.transparent = entity.opacity !== undefined && entity.opacity < 1;
      mesh.material.opacity = entity.opacity ?? 1;
      const behavior = entity.behavior || { type: 'none', speed: 1 };
      const speed = behavior.speed ?? 1;
      if (behavior.type === 'spin') mesh.rotation.y += elapsed * speed;
      if (behavior.type === 'bob') mesh.position.y += Math.sin(elapsed * speed * 2) * 0.35;
      if (playing && behavior.type === 'player') {
        const dx =
          Number(keys.has('KeyD') || keys.has('ArrowRight')) -
          Number(keys.has('KeyA') || keys.has('ArrowLeft'));
        const dz =
          Number(keys.has('KeyS') || keys.has('ArrowDown')) -
          Number(keys.has('KeyW') || keys.has('ArrowUp'));
        const length = Math.hypot(dx, dz) || 1;
        state.x += (dx / length) * speed * dt;
        state.z += (dz / length) * speed * dt;
        if (jumpRequested && state.grounded) {
          state.vy = Math.max(3, speed * 1.8);
          state.grounded = false;
        }
      }
      mesh.position.x += state.x;
      mesh.position.z += state.z;
      // Infinite horizontal ground only. Primitives do not collide with one another.
      if (entity.physics?.enabled && (entity.physics.mass ?? 1) > 0) {
        if (playing) {
          state.vy += gravity * dt;
          state.y += state.vy * dt;
        }
        mesh.position.y += state.y - original.position[1];
        mesh.updateMatrixWorld(true);
        bounds.setFromObject(mesh);
        if (bounds.min.y < floor && playing) {
          state.y += floor - bounds.min.y;
          mesh.position.y += floor - bounds.min.y;
          const restitution = behavior.type === 'player' ? 0 : (entity.physics.restitution ?? 0.3);
          state.vy = Math.abs(state.vy) > 0.6 ? -state.vy * restitution : 0;
          state.grounded = state.vy < 0.15;
        }
      }
    }
    jumpRequested = false;
    selectionBox?.update();
  }
  transforms.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value;
    if (e.value) draggedGizmo = true;
  });
  transforms.addEventListener('mouseUp', () => {
    const mesh = transforms.object;
    if (!mesh || options.editable === false) return;
    options.onTransform?.(mesh.userData.velId, {
      position: mesh.position.toArray().map(round),
      rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(degrees),
      scale: mesh.scale.toArray().map((v) => Math.max(0.01, round(v))),
    });
  });
  listen(canvas, 'pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    pointerDown = { x: e.clientX, y: e.clientY };
    draggedGizmo = false;
  });
  listen(canvas, 'pointerup', (e) => {
    if (
      !pointerDown ||
      draggedGizmo ||
      playing ||
      options.editable === false ||
      Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5
    )
      return;
    if (transforms.axis) return;
    const rect = canvas.getBoundingClientRect();
    mouse.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(
      [...meshes.values()].filter((m) => m.visible),
      false,
    )[0];
    setSelected(hit?.object.userData.velId || null);
    options.onSelect?.(hit?.object.userData.velId || null);
  });
  listen(canvas, 'keydown', (e) => {
    if (!playing || document.activeElement !== canvas) return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
      ].includes(e.code)
    ) {
      e.preventDefault();
      keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) jumpRequested = true;
    }
  });
  listen(canvas, 'keyup', (e) => {
    keys.delete(e.code);
  });
  listen(canvas, 'blur', () => keys.clear());
  listen(window, 'blur', () => keys.clear());
  listen(canvas, 'webglcontextlost', (e) => {
    e.preventDefault();
    options.onStatus?.({
      fps: 0,
      entities: meshes.size,
      playing: false,
      error: 'The graphics context was lost. Close and reopen this scene to recreate the viewport.',
    });
    playing = false;
  });
  function resize() {
    const width = Math.max(1, container.clientWidth),
      height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  configureDocument(doc, true);
  resize();
  function tick(now) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (playing) {
      elapsed += dt;
      animationTime += dt * 1000;
    }
    applyPose(dt);
    orbit.update();
    renderer.render(scene, camera);
    frames++;
    if (now - statusTime >= 500) {
      options.onStatus?.({
        fps: Math.round((frames * 1000) / (now - statusTime)),
        entities: meshes.size,
        playing,
      });
      frames = 0;
      statusTime = now;
    }
  }
  frame = requestAnimationFrame(tick);
  return {
    setDocument(next) {
      configureDocument(next, false);
    },
    setSelected,
    setPlaying(value) {
      playing = Boolean(value);
      keys.clear();
      setSelected(selectedId);
    },
    seek(time) {
      animationTime = Math.max(0, Number(time) || 0);
      if (!playing) {
        elapsed = 0;
        restoreSimulation();
      }
      applyPose(0);
    },
    setTransformMode(mode) {
      if (['translate', 'rotate', 'scale'].includes(mode)) transforms.setMode(mode);
    },
    setGrid(value) {
      grid.visible = Boolean(value);
    },
    reset() {
      playing = false;
      elapsed = animationTime = 0;
      restoreSimulation();
      applyPose(0);
      setSelected(selectedId);
    },
    screenshot() {
      renderer.render(scene, camera);
      return canvas.toDataURL('image/png');
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      events.forEach((off) => off());
      transforms.detach();
      transforms.dispose();
      orbit.dispose();
      clearSelectionBox();
      for (const mesh of meshes.values()) releaseMesh(mesh);
      const helper = transforms.getHelper();
      helper.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      });
      grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      meshes.clear();
      simulation.clear();
    },
  };
}
