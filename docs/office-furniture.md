# Office furniture: storage and editing

## Where furniture is stored

Furniture (office objects) are persisted as JSON so you can inspect or edit them by hand.

### Main data file

- **Path:** `office-objects.json` inside your OpenClaw state directory.
- **Resolved path:**
  - If `OPENCLAW_STATE_DIR` is set → `$OPENCLAW_STATE_DIR/office-objects.json`
  - Otherwise → `~/.openclaw/office-objects.json` (on Windows often `C:\Users\<you>\.openclaw\office-objects.json`)

Each entry has `_id`, `meshType` (e.g. `couch`, `plant`, `bookshelf`, `pantry`, `lamp`, `team-cluster`, `custom-mesh`), `position`, `rotation`, `scale`, and optional `metadata`.

### Custom 3D meshes (GLB/GLTF)

- **Default folder:** `$OPENCLAW_STATE_DIR/assets/meshes` or `~/.openclaw/assets/meshes`
- **Override:** In the UI, Furniture & Assets → Import tab → “Local Mesh Folder”. That path is stored in `office.json` (office settings) as `meshAssetDir`.

Put `.glb` or `.gltf` files in that folder; the UI can list them and place them as “custom mesh” objects.

## Move and remove furniture

1. Turn on **Builder Mode** in **Settings** (gear icon).
2. In the office view, **click a piece of furniture**. A context menu appears around it.
3. **Move:** Choose **Move**, then **drag** the object to a new spot (stays inside the room).
4. **Remove:** Choose **Delete** to remove it from the office (and from `office-objects.json`).

You can also **Rotate** and **Scale** from the same menu, and **Settings** opens the object config (label, embed URL, etc.).

## Adding more furniture

- **Built-in types:** Implemented in `ui/src/features/office-system/components/` (e.g. `couch.tsx`, `plant.tsx`, `lamp.tsx`). New types need a component, a prefab in `prefabs/built-in-furniture-prefabs.tsx`, and registration in `object-registry.ts`, `ghost-registry.tsx`, `office-object-renderer.tsx`, and the Furniture Shop catalog.
- **Custom meshes:** Add `.glb`/`.gltf` files to the mesh folder (see above) and use Furniture & Assets → Custom Library → Place Mesh.
