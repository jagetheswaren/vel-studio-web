# Vel Studio document language, schema 1

The application implementation uses JavaScript. Its unified project source is a JSON document in a `.vel` file with `kind: "vel-studio"`. This declarative format is distinct from the older indented preview DSL and the official Vel language. It is designed to be authored by visual tools, code editing or reviewed AI suggestions.

## Minimal document

```json
{
  "kind": "vel-studio",
  "version": 1,
  "name": "My studio",
  "design": {
    "width": 960,
    "height": 640,
    "background": "#111b25",
    "nodes": []
  },
  "scene": {
    "background": "#101924",
    "camera": { "position": [7, 5, 9], "target": [0, 1, 0], "fov": 45 },
    "lighting": { "ambient": 0.8, "directional": 2 },
    "physics": { "gravity": -9.8, "groundY": 0 },
    "entities": []
  },
  "animations": []
}
```

## Design nodes

Supported types are `frame`, `rect`, `ellipse`, `text`, and `button`. Layers are ordered back-to-front in the node array and use flat artboard coordinates. Frames are visual surfaces in this version, not nested layout containers.

```json
{
  "id": "headline",
  "type": "text",
  "name": "Hero headline",
  "x": 56,
  "y": 160,
  "width": 600,
  "height": 150,
  "rotation": 0,
  "scale": 1,
  "fill": "#000000",
  "color": "#f1f6fa",
  "text": "Design it.\nBring it to life.",
  "fontSize": 58,
  "radius": 0,
  "opacity": 1,
  "visible": true,
  "locked": false
}
```

IDs, type, name, position and dimensions are required. Other values have sensible rendering defaults. IDs start with a letter and may contain letters, numbers, dashes and underscores. IDs are unique across design and scene. Colors are six-digit hex strings. Angles are degrees; design positions and dimensions are pixels.

## Button actions

A button may reference another design node:

```json
{ "type": "setText", "target": "status", "value": "Ready to build." }
```

Supported actions:

- `toggle`: toggle target visibility.
- `setText`: replace a text/button target's text.
- `increment`: increase a text/button target's numeric value by one.

Actions execute in the runtime preview/export. The visual authoring canvas uses clicks for selection instead. Actions are declarative; arbitrary JavaScript is not evaluated from the document.

## Scene entities

```json
{
  "id": "player",
  "type": "box",
  "name": "Player",
  "position": [0, 1, 0],
  "rotation": [0, 25, 0],
  "scale": [1, 1, 1],
  "color": "#6fe4bb",
  "opacity": 1,
  "visible": true,
  "physics": { "enabled": true, "mass": 1, "restitution": 0.1 },
  "behavior": { "type": "player", "speed": 4 }
}
```

Types: `box`, `sphere`, `plane`, `cylinder`, `torus`. Position/scale use scene units, rotation uses degrees. A primitive plane lies in the XY plane; use rotation `[-90,0,0]` for a horizontal floor. Camera and lights are scene settings.

Behaviors: `none`, `spin`, `bob`, `player`. Play mode activates simulation; focus the canvas for WASD/arrows and Space jumping. Physics uses gravity and one infinite ground plane. Objects do not collide with one another. Stop/reset returns to source transforms.

## Animation tracks

```json
{
  "id": "fade-headline",
  "target": "headline",
  "property": "opacity",
  "from": 0,
  "to": 1,
  "duration": 900,
  "delay": 0,
  "loop": false
}
```

Durations and delays are milliseconds. Easing is deterministic smoothstep. Design targets support `x`, `y`, `rotation`, `opacity`, `scale`. Scene targets support `x`, `y`, `z`, `rotation`, `rotationX`, `rotationY`, `rotationZ`, `opacity`, `scale`. Scene `rotation` aliases Y rotation; scale is uniform.

Values before delay use `from`; values after a non-looping track use `to`. Looping tracks restart each duration. When tracks address the same target/property, later tracks take precedence. Scrubbing samples a copy and does not change source values.

## Bounds and validation

Files are bounded to 500 KB of source, with at most 500 design nodes, 200 entities and 500 tracks. Runtime performance depends on the device and scene complexity. Invalid references, duplicate IDs, unsupported types, non-finite transforms and invalid colors produce actionable errors. Deleting a node through the editor removes its animation references and button actions pointing to it.

## Extending the language

Add a schema version or explicitly backward-compatible optional property. Update validation, authoring, runtime, AI schema guidance and tests together. Never add a visual inspector field unless the runtime consumes it, and never execute untrusted source as a system command.
