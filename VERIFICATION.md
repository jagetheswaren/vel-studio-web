# Verification — 25 October 2026

## v0.3 projects and launch

- **29 Node tests passed**: all prior coverage plus metadata/archive, preferences validation, sessions, file revisions, concurrent saves, scoped task APIs, restart persistence and full-stack preview composition.
- Prettier formatting check passed. Production runtime/frontend build passed. Launch doctor passed. Dependency audit reported **0 vulnerabilities**.
- Browser-created a full-stack project through Projects home and opened its HTML source.
- Browser-loaded its sandboxed running application, added a task, completed it and reloaded. The completed record persisted through the API.
- Saved autosave settings through the Preferences UI, edited a file in Monaco, and confirmed the source was written to disk automatically.
- Selected an older source revision in File History, reviewed it and restored after confirmation. The saved source returned to that revision.
- Session restoration reopened the same project/file after browser reload.
- The final Windows portable package passed `--smoke-test`, exit code 0: the application started its own backend and loaded Projects home successfully.
- The additional independent UI evaluation did not finish. Primary-agent browser checks were completed; no independent v0.3 PASS verdict is claimed.

The full-stack template uses a built-in Node/Express project-data backend, not arbitrary user-supplied backend execution. Public hosting, multi-user authentication, signed installers/updaters and universal extension compatibility remain outside this version.

## v0.2 unified studio

- `npm test`: **21 tests passed**, including schema roundtrips, design/scene edit purity, reference cleanup, interactions, animation sampling, template API and self-contained export.
- `npm run build`: offline runtime and Vite production frontend passed.
- `npm audit`: **0 vulnerabilities** at verification time.
- Windows portable package created with Electron Packager.
- Source Electron smoke test passed: studio ready with 9 design layers.
- **Packaged executable smoke test passed**, exit code 0: `VEL_DESKTOP_SMOKE {"title":"Vel Studio — Design. Code. Build worlds.","ready":true,"layers":9}`.
- Browser: inspector edit changed the saved headline X to 88; actual pointer drag then moved it from (88,160) to (138,185).
- Browser: scene transform inspector changed the saved cube position to `[2,1,0]`.
- Browser: adding a motion track through Animate saved a third track into the same source document.
- Browser: 3D rendered, orbit/selection/inspector controls loaded and actual FPS/entity statistics displayed. This is a device observation, not a performance guarantee.
- Exported player was loaded locally, then browser networking was disabled. A button updated its target text; switching to Scene and playing still worked, with no external runtime scripts.
- UI evaluation passed for desktop and compact Design/Scene/Animate views after fixing inspector overlap. The compact toolbar, layers drawer and property controls remain accessible.

The desktop smoke check covers startup and UI loading; a complete native UI regression suite, signed installer, auto-updater and cross-machine QA are not included. Chrome reported a nonfatal Three.js soft-shadow compatibility fallback; rendering continued normally. Existing AI live-service limitations below still apply.

New screenshots: `output/playwright/studio-design.png`, `studio-scene.png`, `studio-animate.png` and `studio-mobile.png`.

## v0.1 baseline checks retained

## Automated

- `npm test`: 12 tests passed.
- `npm run build`: production frontend build passed.
- `npm audit`: 0 vulnerabilities at verification time.
- VS Code extension and example plugin server pass Node syntax checks.

Tests exercise file persistence and traversal blocking, host/origin checks, preview generation, model listing/chat for Ollama and OpenAI-compatible protocols, encrypted key preservation/redaction, plugin lifecycle and explicit invocation, workspace console/export, and renderer diagnostics.

## Browser checks

Chrome was used against both development port 4310 and a separate production server on port 4311 with isolated QA data.

- Welcome project loads in Monaco; generated UI and seven animation tracks render.
- New file creation works. Editing and Ctrl+S persisted the changed text to disk.
- Connections settings save; an unavailable Ollama service shows a clear connection error.
- A local mock AI service was connected to the production build. Chat returned a fenced code suggestion. Review, Apply to editor and Save updated the intended source file. No paid API was used.
- A local mock HTTP plugin was added, enabled and run through the UI; input `Hello Vel` returned the expected `{ "characters": 9 }`.
- Desktop and compact layouts were inspected; the compact Project files dialog exposes workspace selection, new workspace, file creation, file import and file opening.
- AI proposals retain their original workspace/file target, with stale-response guards and confirmation if newer editor changes exist.

Screenshots: `output/playwright/desktop.png` and `output/playwright/mobile.png`.

## Unverified integrations and limits

- No real OpenAI key was supplied; live model access, billing and model compatibility depend on user configuration.
- Ollama was not installed/running on this machine during the check; its request/response protocol was verified using local mocks.
- No official Vel native compiler was available. The executable hook is provided, but compiler CLI compatibility and real native output are unverified.
- The VS Code companion extension source was syntax checked; it was not packaged into a VSIX or run in an extension host.
- This is a local studio development foundation. It does not include a signed desktop installer/updater, an official Vel compiler/language server/debugger, arbitrary VS Code extension compatibility, MCP, or multi-user hosting. v0.2 adds a portable Windows desktop application.
