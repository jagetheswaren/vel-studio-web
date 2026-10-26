# Development roadmap

## Delivered foundation

- v0.3: project dashboard/templates/metadata/archive, persistent preferences, autosave and recent sessions.
- v0.3: 20-version file history, explicit restore, and a full-stack task application with persistent scoped REST data.
- v0.3: live full-stack preview, saved-project launch URLs, launch doctor and Windows/Linux CI checks.

- Local IDE, file storage, Monaco, save/import, diagnostics and a restricted workspace console.
- Provider adapters for Ollama and OpenAI-compatible text chat, model discovery and reviewed edits.
- Explicit HTTP tool integrations, settings and encrypted tokens.
- Shared Vel Studio document, validation, templates and source editing.
- Visual design authoring and a 3D primitive scene workflow.
- Declarative interactions, animation sampling, basic behaviors and ground physics.
- Standalone offline HTML player and Windows Electron packaging pipeline.

The verification report is the authority for what was exercised. A packaged Windows folder is not a signed installer or a production release.

## Next: professional authoring

### Design system and layout

Nested frames, groups, constraints, auto layout, snapping, alignment/distribution, reusable components, variants and token libraries. Acceptance: a responsive reusable component can be edited once and reflected in multiple instances without losing source identity.

### Asset pipeline

Image, font, audio and GLTF import with a persistent asset manifest, local previews, size limits, missing-asset diagnostics and export bundling. Acceptance: an imported asset survives save/reopen and works in an offline export.

### Game engine

A dedicated physics library with colliders and object-to-object collision; 2D sprites/tilemaps; prefab definitions; skeletal animation; audio and particle systems. Acceptance: a player moves on platforms and collides reproducibly at a fixed simulation step.

### Programming language and debugging

Choose between developing a full language toolchain and integrating the official Vel compiler under its available terms. Add functions/events/types/modules, a language server, source maps and debugger. Acceptance: breakpoints, variables and stack frames match the user's source. The current JSON dialect is not that compiler.

### Extensibility

Define a versioned manifest, command registry, scoped capabilities and isolated extension host; add an MCP client with session/tool lifecycle, cancellation and visible execution approval. Evaluate VS Code compatibility as its own substantial project, including API licensing and version compatibility. Acceptance: an extension can add a command without direct access to credentials or unrelated files.

### AI breadth

Native provider protocols beyond OpenAI-compatible text chat, image/audio/model generation, patch/diff review, multi-file proposals, cancellation, budgets and selectable tool execution. Acceptance: a multi-file change has an accurate diff and can be applied or rejected atomically. "All AI" cannot mean every provider/model works without credentials or a compatible adapter.

### Product delivery

Project export/import archives, crash recovery, migrations, signing, installer/updater, performance budgets, accessibility testing and cross-platform packaging. Acceptance: a clean machine installs, opens a project and exports it without development tools.

### Collaboration and cloud

Identity, permissions, CRDT document collaboration, conflict recovery, asset synchronization and deployment. Acceptance: simultaneous edits converge and permissions are enforced on the server. These require a multi-user backend, distinct from the current local service.

## Delivery discipline

For each feature: observe the user workflow, define public contracts, implement the smallest complete slice, write focused tests for failure-prone behavior, verify the UI and exported runtime, and update compatibility documentation. Prioritize by real user projects rather than adding empty panels.
