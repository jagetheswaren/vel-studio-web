# Vel Studio v0.3

A local, full-stack creative studio: visual UI designer, 3D scene editor, animation authoring, Monaco code editor, persistent workspaces, AI assistant and HTTP tools. The same `.vel` Studio document connects the canvas, scene, code and exported runtime.

Version 0.3 adds Projects home, project templates and metadata, a real full-stack task-board application, a working Launch flow, persistent editor/application settings, autosave, recent sessions and file revision recovery. Read the [projects and launch guide](PROJECTS_AND_LAUNCH.md) for the complete workflow and API details.

Quick start: **New project → Full-stack task board → Create → edit/save → Launch → Open project**. The running application has persistent REST-backed tasks, not demonstration-only data. Its editor preview includes HTML, CSS, JavaScript and the real project API.

## Start the Windows desktop app

The prepared final portable application is in the neighboring `desktop-build/v0.3.0-final/Vel Studio-win32-x64` folder. Run **Vel Studio.exe** from that folder, or double-click **start-vel-desktop.cmd**. Keep the entire portable folder together; the executable depends on its supporting files. The desktop app starts its own loopback backend and stores writable projects in its application user-data directory. Source packaging defaults to `desktop-build/v0.3.0`; use `npm run desktop:pack -- --output PATH` for a separate build folder.

The package is an unsigned development build. Source builds are available with `npm run build`, then `npm run desktop`. To package Windows again, use `npm run desktop:pack` after building; the packager preserves existing build output instead of silently overwriting it.

## Unified studio workflow

Open `src/studio.vel`, which is seeded safely in the welcome workspace and every Studio-template workspace. Full-stack task-board projects instead contain editable HTML/CSS/JavaScript and API notes.

1. **Design:** add shapes, text and buttons; move/resize layers; edit geometry and appearance; duplicate, reorder, hide or lock layers; undo/redo visual edits.
2. **Scene:** add primitives, select objects, edit transforms/materials or use gizmos, orbit/zoom the camera, configure lighting/gravity and built-in behaviors.
3. **Animate:** add tracks, edit targets/properties/values/timing, play or scrub design and scene motion.
4. **Code:** inspect and edit the same JSON document in Monaco. Manual Save or explicitly enabled autosave persists changes.
5. **Export:** download one self-contained HTML player with interactive design buttons and a playable 3D scene. No CDN or external runtime download is needed.

Use **Templates** in the top bar for a product studio, game playground or blank document. In the playground, click/focus the scene canvas while playing; use WASD/arrows to move and Space to jump.

The application implementation language is JavaScript. The project language is a declarative JSON dialect with `kind: "vel-studio"`, not the official Vel language or a new general-purpose compiler. Flat 2D layers, primitive 3D objects and built-in behaviors are the current scope. Physics supports gravity and one ground plane; it is not a complete rigidbody solver. Visual undo history resets when switching through Code. The [development roadmap](DEVELOPMENT_ROADMAP.md) describes the remaining work toward a full professional tool suite.

Detailed documentation: [product analysis and reimplementation process](PRODUCT_ANALYSIS.md), [architecture](ARCHITECTURE.md), [document language](STUDIO_LANGUAGE.md), [verification](VERIFICATION.md).

**Status:** working development foundation, not full Figma/Unity/VS Code parity. The older **Vel Preview DSL** remains supported for simple indented UI files such as `src/main.vel`. Neither document dialect implements the official Vel compiler. The optional native compiler hook applies only to separately supported source files. This project is not affiliated with Vel, Microsoft, OpenAI, or Ollama.

## Start on Windows

Install Node.js 22 or newer. Double-click **start-vel.cmd**, then open **http://127.0.0.1:4310**.

Alternatively, from this directory:

```powershell
npm ci
npm run build
npm run doctor
npm start
```

Development mode with live frontend reload:

```powershell
npm run dev
```

The backend and frontend share one local origin. `PORT` changes the port; `VEL_DATA_DIR` changes the storage directory. The server binds to `127.0.0.1` and is designed for a single local user. Do not expose it publicly.

## What works

- Workspaces created and stored on disk, with a welcome project.
- File explorer, new text files, multi-file import without overwriting, multiple editor tabs, syntax highlighting, save, unsaved-change indicators, Ctrl+S, file search.
- Live preview of the supported DSL and standalone HTML in a sandboxed iframe.
- Animation tracks derived from source, play/pause/restart and scrubbing.
- Desktop/mobile preview sizes; Code, Design and Animate layouts; a project/workspace dialog on compact screens.
- Problems panel and a workspace command console.
- AI chat via Ollama, OpenAI API, or an OpenAI-compatible server; discover models and choose one.
- Optional current-file context; fenced AI code proposals require review and explicit application to the editor.
- Saved provider settings and encrypted API tokens; tokens are not sent back to the browser.
- HTTP JSON plugin registration, enable/disable, invocation and removal.
- An optional companion VS Code extension under `extensions/vscode` to open the IDE and copy a file into it.

## Connect AI

Open **Connections** using the settings icon.

### Ollama

Install Ollama independently, start its service, and pull a chat/code model of your choice using `ollama pull MODEL_NAME`. Set the base URL to `http://127.0.0.1:11434`. Click **Save & discover models**, then choose or enter a model name and save. Local requests are routed through the backend; browser CORS settings do not need changing.

### OpenAI

Select OpenAI, keep the base URL `https://api.openai.com/v1`, enter an API key, and select a chat-capable model available to that key. `OPENAI_API_KEY` on the server is also supported. This integrates the OpenAI API; it does not sign into your ChatGPT account. A ChatGPT subscription and API access are separate products.

### Other compatible servers

Use the OpenAI-compatible provider for a service exposing `GET /models` and `POST /chat/completions` relative to its base URL, such as a local server at `http://127.0.0.1:1234/v1`. URLs must use HTTPS except for loopback services. Model availability depends on your provider. The app sends standard text chat requests; model-specific advanced features are not implemented.

The assistant sends conversation text to the selected endpoint. The **current file** checkbox starts off unchecked. Enabling it includes that file's path and text in each request. It does not send the entire workspace. Review suggestions before applying; apply changes the editor buffer, and Save persists it.

## Preview DSL

```text
#WelcomeScreen
V g=lg p=lg
  Badge "WELCOME"
  T "Build something beautiful" size=hero font=bold animate=fade.up(0.6)
  T "Your next idea starts here." fg=muted
  H g=md
    Card p=md g=sm
      T "Design with code" font=bold
      In placeholder="Your project name"
    Card p=md
      Progress value=0.65 animate=grow.x(0.8)
  Btn "Get started" animate=scale(0.3) delay=0.2
```

Indentation determines nesting. `V`, `H` and `Card` contain children. Supported leaf components: `T`, `Btn`, `In`, `Progress`, `Badge`, `Orb`, `Divider`. Quoted strings use JSON escaping. `#Name` is a screen declaration; `//` starts a comment.

| Property | Supported values |
| --- | --- |
| `g`, `p` | `xs`, `sm`, `md`, `lg`, `xl` |
| `size` | `sm`, `md`, `lg`, `xl`, `hero` |
| `font` | `bold` |
| `fg` | `text`, `muted`, `accent`, `violet` |
| `radius` | integer 0–99 |
| `value` | progress number 0–1 |
| `placeholder` | quoted input label |
| `animate` | `fade.up(seconds)`, `fade(seconds)`, `scale(seconds)`, `grow.x(seconds)` |
| `delay` | seconds |

The renderer generates isolated HTML and uses the Web Animations API. Unsupported components and syntax appear in Problems. This DSL does not execute arbitrary Vel/C++ code, resolve component imports, implement reactive variables, or provide native debugging. The example button has small demonstration click feedback. HTML previews run their own inline scripts but do not expose IDE APIs, network access, or parent DOM access; timeline control applies to generated DSL animations only.

## Workspace console and export

The bottom Terminal is a **restricted workspace console**, not a PowerShell shell. Commands:

```text
help
ls
cat src/main.vel
check src/main.vel
build src/main.vel
git status
```

Save the editor before running `check` or `build`: these commands read the saved file. `build` writes `build/index.html` inside the workspace, which you can copy from `.vel-data/workspaces/WORKSPACE_ID/build/index.html`. Git status only works if that workspace is already a Git repository; Git initialization, commits, full shell processes and debugging are not implemented.

The optional native compiler field takes an absolute executable path. The native build hook invokes that executable with one argument: the selected saved `.vel` file path, with the workspace as working directory. If your compiler needs different arguments, supply an executable wrapper. No official compiler was available for validation. Configure executables you trust; they run with your OS user's permissions.

## HTTP plugins

Add an endpoint from **Plugins**, then enable it. A user-initiated run sends:

```http
POST YOUR_ENDPOINT
Content-Type: application/json
Authorization: Bearer YOUR_OPTIONAL_TOKEN

{"input":"your explicit input"}
```

The service must return JSON. The UI shows the response. Plugins do not receive source files unless you paste them into the input. They cannot install JavaScript into the IDE. This is a small HTTP integration protocol, **not** a VS Code extension host, MCP client, universal plugin marketplace, or automatic AI tool execution. Each plugin starts disabled. HTTPS is required except for loopback HTTP.

For a working local example, run `node examples/plugin-server.mjs` in another terminal, add `http://127.0.0.1:4320/run` as a plugin endpoint, enable it, and run it with some text. It returns word, line and character counts. Stop the example server with Ctrl+C when finished.

## Data and credentials

Local data is stored in `.vel-data/` (excluded from Git):

```text
.vel-data/
  workspaces.json
  settings.json
  plugins.json
  .secret-key
  workspaces/<id>/...
```

Tokens are AES-256-GCM encrypted using a locally stored key. This reduces accidental plaintext exposure; it is not Windows Credential Manager or a substitute for protecting the user's account. Anyone with access to the data directory and its key can decrypt tokens. Keep `.vel-data` out of shared repositories and archives. Back it up as private data if needed. No credentials are included in the project.

## Architecture

- `src/main.jsx`, `src/styles.css`: React UI and Monaco worker integration, all served locally.
- `server/app.js`: Express API, workspace operations and plugin/AI routes.
- `server/preview.js`: preview parser, HTML rendering and animation runtime.
- `server/providers.js`: Ollama/OpenAI-compatible transport, timeout/error handling.
- `server/store.js`: persistence, secret encryption and file path boundaries.
- `server/index.js`: loopback server, Vite development middleware or production assets.
- `shared/studio.js`: the unified schema, edit helpers, animation sampler and button actions.
- `shared/engine.js`, `src/studio/`: the 3D engine, designer, scene inspector and animation authoring.
- `runtime/player.js`, `server/studio.js`: the bundled offline player and export API.
- `desktop/main.cjs`: Electron desktop lifecycle and its private local backend.
- `server/product.js`, `server/project-template.js`, `server/revisions.js`: projects, preferences, sessions, full-stack launch/task API and revision recovery.
- `src/product/`: project dashboard, application settings and file history UI.
- `test/`: Node tests for renderer and API flows with mock AI/plugin servers.
- `extensions/vscode/`: companion extension source and development instructions.

## Validate

```powershell
npm test
npm run build
npm audit
```

The automated tests use temporary isolated data and local mock services. They verify persistence, path traversal protection, host/origin checks, secret handling, provider protocols, plugin execution, compiler diagnostics and preview export. They do not prove a live paid API connection or an installed native compiler.

Reference protocols: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Ollama chat](https://docs.ollama.com/api/chat), [Ollama model list](https://docs.ollama.com/api/tags). Official Vel access and documentation: [Vel](https://vel.kadarla.com/).
