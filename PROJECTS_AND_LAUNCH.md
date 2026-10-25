# Projects, settings, recovery and launch — v0.3

## Start the application

**Portable Windows build:** open `desktop-build/v0.3.0-final/Vel Studio-win32-x64/Vel Studio.exe` from the neighboring output directory. Keep its complete folder together. No separate Node.js installation is required for the packaged application. The desktop app starts its own local backend.

**From source:** install Node.js 22 or newer, then run:

```powershell
npm ci
npm run build
npm run doctor
npm start
```

Open `http://127.0.0.1:4310`. For the desktop window use `npm run desktop`, or double-click `start-vel-desktop.cmd`. For source development use `npm run dev`.

## Create a real full-stack project

1. From Projects home, choose **New project**.
2. Select **Full-stack task board**, give it a name and optional description, and create it.
3. Open the project. Its source files are `app/index.html`, `app/styles.css`, `app/app.js`, and `API.md`.
4. Edit the frontend and save. Keep the HTML `VEL_STYLE` and `VEL_SCRIPT` markers so Launch can embed your saved CSS and JavaScript.
5. Choose **Launch**. It saves modified open buffers before building the project. The launch dialog provides a real local URL. Open it to run the application.
6. Add a task, complete it, refresh the page, and verify it remains saved. The frontend calls the persistent project REST API.

The project uses the studio's Node/Express backend and disk-backed task records. It is a genuine frontend → REST → persistent storage workflow. It does not execute arbitrary backend source code from a workspace. General Node/Python process runners, package installation inside projects and public hosting remain separate future work.

The **Full-stack preview** in the editor combines the current unsaved file with the project's other saved frontend files. Its API is live: adding or removing tasks there changes this project's persistent records. Previewing source does not save the source buffer.

## Project types

| Template | Source | Launch result |
| --- | --- | --- |
| Product studio | `src/studio.vel` plus legacy preview example | Interactive design and 3D runtime |
| Game playground | `src/studio.vel` | Playable primitive scene with keyboard controls |
| Blank studio | `src/studio.vel` | Your own artboard and scene |
| Full-stack task board | Editable HTML/CSS/JS and API notes | Persistent task application |

Projects home shows metadata derived from real stored files. You can search, rename, edit the description, archive and restore a project. Archival hides it from the normal list; it does not delete source or records.

## Settings that change behavior

Application preferences are separate from AI Connections:

- Dark/light application theme.
- Monaco font size, tab size, line wrapping and minimap.
- Autosave enable/disable and delay.
- Reduced interface motion.
- Restore the last project/file/mode on startup.

Save preferences to persist them. Autosave is off by default. When enabled, it writes the edited file after the configured delay. Manual Save remains available. Switching projects still protects unsaved editor buffers. Recent session restoration is skipped when the project is archived or the file no longer exists.

AI Connections still holds provider URLs, model names and encrypted API credentials. Application preferences never expose those secrets.

## File history and recovery

Every changed save records the previous source version. The latest 20 prior versions are retained per file. Saving identical text creates no redundant revision. Open **File history**, choose a revision, inspect its source, and restore it explicitly. The restored file replaces the saved source; the overwritten current version is also retained so you can recover it.

This is file revision recovery, not a backup of the entire computer. Deleted files are not currently recoverable through this dialog. Back up the private data directory separately if needed.

## Backend API

All IDE writes require the local client header and same-origin requests. The launch application uses a distinct project-scoped capability.

| API | Behavior |
| --- | --- |
| `GET /api/projects` | Project metadata, real file counts and byte totals |
| `GET /api/project-templates` | Available creation templates |
| `POST /api/workspaces` | Create with `name`, `description`, `template` |
| `PATCH /api/workspaces/:id` | Rename, describe, archive/restore |
| `GET/PATCH /api/preferences` | Validated application settings |
| `GET/PUT /api/session` | Last project/file/mode |
| `GET /api/history` | Revision metadata for a file |
| `GET /api/history/revision` | Read one revision's source |
| `POST /api/history/restore` | Restore a selected revision |
| `POST /api/workspaces/:id/launch` | Build a saved project snapshot and return its URL |
| `POST /api/workspaces/:id/preview` | Render a task-board project's current buffer with saved assets |
| `GET /launch/:id` | Isolated running project |
| `GET/POST /api/project-data/:id/tasks` | List/create task records |
| `PATCH/DELETE /api/project-data/:id/tasks/:taskId` | Update/remove a task |

Task records have `id`, `title`, `done`, `createdAt` and `updatedAt`. Titles are 1–200 characters; projects are limited to 1,000 tasks. Mutation queues prevent concurrent writes from losing records. The task capability grants access only to its own project's records and changes when the server restarts. Reload the launch page after a restart to obtain a new capability. Source files never contain a hard-coded token.

## Storage

Browser mode stores private data in `.vel-data`. Desktop mode uses its own application user-data directory under `studio-data`. Source, metadata, preferences, recent session, revisions and task records persist on disk. Private data, credentials, generated runtime bundles and dependencies are excluded from Git.

The service is designed for one local user, not public internet hosting. The development Windows package is unsigned. Signing, installer/updater, multi-user authentication, arbitrary server-code execution and production deployment are not included in this version.

## Validate and build

```powershell
npm run format:check
npm test
npm run build
npm run doctor
npm audit
npm run desktop:pack
```

`npm run format` formats the maintained source. GitHub Actions runs format, tests, build and launch checks on Windows and Linux. Local tests use temporary isolated data; no paid AI calls or user credentials are needed.
