# Vel Studio: product analysis and reimplementation process

## Product objective

One local application should let a creator draw a UI, arrange a 3D scene, edit the source, add motion, ask an AI assistant for help, connect tools, and export a working result. A document edited by one tool must be immediately usable by the others.

The current implementation is an original vertical slice of that workflow. It does not claim compatibility with proprietary project formats, the full Unity engine, Figma services, or the VS Code extension host.

## 1. Observe public behavior and define the workflows

We studied public documentation to identify the underlying concepts rather than copying source code or private internals.

| Reference | Observable model | Vel implementation |
| --- | --- | --- |
| Figma | A file contains typed nodes with shared and type-specific properties. | Typed design layers, editable geometry and appearance, selection, ordering, and a source document. |
| Unity | Scene objects are containers configured with components. | Scene entities with transforms, material color, behavior and basic physics settings. |
| VS Code | Editors, commands, configuration, language support and extension capabilities. | Monaco, file/workspace persistence, commands, diagnostics, provider settings and explicit HTTP integrations. |
| Three.js | A WebGL renderer displays a scene using a camera. | Local WebGL 3D rendering, orbit controls, selection and transform gizmos. |

Primary references: [Figma plugin API](https://developers.figma.com/docs/plugins/api/api-reference/), [Unity GameObjects](https://docs.unity.com/en-us/engine/6000.3/manual/working-with-gameobjects), [VS Code extension capabilities](https://code.visualstudio.com/api/extension-capabilities/overview), [Three.js renderer](https://threejs.org/docs/pages/WebGLRenderer). The Vel architecture in the right column is our design inference from those concepts.

Core journeys:

1. Create a project from a template, add a design layer, change its appearance, and save.
2. Move or resize a layer, switch to Code, and inspect the updated values.
3. Add a 3D entity, change its transform/material, run its behavior, and stop without modifying the saved source.
4. Add an animation track, scrub it, and inspect both design and scene targets.
5. Ask a configured model for a source change, review it, apply to the original file, and save.
6. Export one HTML file and run its design interactions and 3D scene offline.
7. Register an HTTP tool, enable it, send explicit input, and inspect its output.

## 2. Inventory the existing code before changing it

The v0.1 baseline already supplied an Express backend, local Monaco editor, filesystem boundaries, API-key encryption, AI transports, HTTP tools, a small UI preview DSL, and an animation preview. Its Design mode was a preview layout, not a visual authoring tool; it had no 3D scene engine or desktop package.

The v0.2 implementation preserves that baseline and introduces a shared schema, visual authoring, scene runtime, and standalone export. New document files use a clear format marker so old DSL files keep working.

## 3. Choose the source of truth

The implementation language is JavaScript across frontend, backend, runtime and desktop shell. A declarative JSON dialect named **Vel Studio document** is saved in `.vel` files. It is data, not a general-purpose programming language or the official Vel compiler syntax.

The document holds design nodes, scene entities, animation tracks, and button actions. Visual editors produce the same document that Monaco edits and the runtime consumes. There is no independent hidden scene database to drift out of sync.

## 4. Specify contracts before implementing views

- `shared/studio.js`: validation, stable IDs, immutable edits, templates, animation sampling and button actions.
- `shared/engine.js`: scene creation, selection, transform edits, playback, seeking, reset and disposal.
- `src/studio/StudioWorkbench.jsx`: authoring interface that emits serialized source changes.
- `runtime/player.js`: standalone player using the same schema, animation and interaction logic.
- `/api/studio/templates`: source templates.
- `/api/studio/export`: validated self-contained HTML download.

See [STUDIO_LANGUAGE.md](STUDIO_LANGUAGE.md) and [ARCHITECTURE.md](ARCHITECTURE.md) for the concrete contracts.

## 5. Reimplement complete slices

The build sequence is source schema → deterministic helpers → authoring controls → runtime → export → desktop shell. Each slice has an end-to-end outcome, rather than a navigation button that implies unfinished functionality.

This approach keeps the narrow features useful while leaving explicit boundaries for future engines, importers, scripting, and extension systems.

## 6. Verify observable behavior

Automated checks cover schema validation, document roundtrips, stable IDs, reference cleanup, immutable edits, animation values, interactions, standalone export and existing backend flows. Browser checks cover authoring, scene rendering, code synchronization, save/reload and runtime controls. A Windows desktop package wraps the same tested frontend/backend.

The verification report records tested and untested behavior. Live third-party credentials and user-installed native compilers remain separate configuration steps.

## 7. Expand with evidence

Add advanced features behind explicit contracts: nested layout/constraints, real physics, script components, asset pipelines, LSP/debugger support, MCP, collaboration and platform exporters. Each requires an acceptance test and a useful user journey. See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).
