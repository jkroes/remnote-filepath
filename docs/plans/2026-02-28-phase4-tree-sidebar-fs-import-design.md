# Phase 4 Design: File Tree Sidebar & Directory Import

## Context

Phase 4 of the roadmap contains two "ambitious bets":
- **#14**: File tree sidebar widget
- **#15**: Filesystem integration (read directory listings)

### Research Findings

**Native API (Feature #15 as originally spec'd):** `requestNative: true` in the manifest only controls rendering mode (main DOM vs iframe). RemNote exposes **zero filesystem APIs** — no readdir, stat, exec, or Node.js access. The SDK is entirely focused on RemNote's data model. This matches what the official `text-to-speech` and `smart-blocks` plugins do: they use `requestNative` for performance only.

**Sidebar widgets (Feature #14):** `WidgetLocation.RightSidebar` is well-supported. The official `history` plugin provides a working reference. Sidebar widgets persist across navigation, receive no document context (must self-track), and render in a tab with customizable icon/title.

---

## Feature 14: File Tree Sidebar

### Problem
The flat storage model means users never see the "big picture" of their path hierarchy. The existing `child_paths` widget only shows immediate children and ancestors of the current path.

### Design

A `RightSidebar` widget renders all paths as a collapsible tree grouped by device. Clicking a node navigates to that path Rem. The currently viewed path is highlighted.

**Data flow:**
1. On mount, load all devices under Filepaths root
2. For each device, call `getChildrenRem()` once to get all path Rems
3. Build a tree structure by parsing paths (reuse existing `isDirectChild` logic)
4. Render recursively with expand/collapse toggles

**Tree structure (in-memory):**
```typescript
interface TreeNode {
  path: string;
  label: string;    // last segment
  remId: string;
  children: TreeNode[];
}
```

Built from the flat path list by:
1. Sort all paths alphabetically
2. For each path, find its parent path (longest prefix in the set that is a direct parent)
3. Attach as child of that parent node
4. Root-level paths (those with no parent in the set) become device-level children

**Component hierarchy:**
```
FileTreeSidebar
├── DeviceSection[] (one per device)
│   ├── DeviceHeader (device name, collapse toggle)
│   └── TreeNode[] (recursive)
│       ├── ExpandToggle (chevron, only if has children)
│       ├── NodeLabel (folder/file icon + last segment)
│       └── TreeNode[] (children, if expanded)
└── EmptyState ("No paths yet")
```

**Expand/collapse state:**
- Stored in React component state (resets on plugin reload)
- Device sections default to expanded
- Path nodes default to collapsed
- Auto-expand ancestors of the currently viewed path

**Current path highlighting:**
- Listen to `AppEvents.URLChange` to track which document is open
- Check if current document is a path Rem
- Highlight matching node with a distinct background color
- Auto-expand tree to show the current path
- Auto-scroll to keep the highlighted node visible

**Navigation:**
- Single click on any path node calls `rem.openRemAsPage()`

**Reactivity:**
- Use `useTracker` with device Rem IDs as deps so the tree updates when paths are added/deleted
- Wrap device loading in `useTracker` so new devices appear automatically

**Registration:**
```typescript
await plugin.app.registerWidget('file_tree', WidgetLocation.RightSidebar, {
  dimensions: { height: '100%', width: '100%' },
  widgetTabTitle: 'Filepaths',
});
```

**Styling:**
- Indentation via `padding-left` proportional to depth
- Chevron icons for expand/collapse (inline SVG, rotates on expand)
- Folder icon for paths with children, file icon for leaf paths
- Highlighted node: blue background tint (light mode) / slate background (dark mode)
- All colors in `style.css` using the explicit-color pattern (avoiding Tailwind dark: classes)

---

## Feature 15: Directory Import (Revised)

### Problem
All paths must be manually entered. Users want to import real directory contents.

### Revised approach
Since native filesystem APIs are unavailable, use the **browser File System Access API** or the **`<input webkitdirectory>`** fallback to let users pick a directory from their actual filesystem.

**How `<input webkitdirectory>` works:**
- The `<input type="file" webkitdirectory>` HTML attribute opens a native directory picker
- Returns a `FileList` where each `File` has a `.webkitRelativePath` property (e.g., `project/src/index.ts`)
- Works in Chromium (which RemNote's Electron app uses)
- Works in iframes (unlike `showDirectoryPicker()` which requires secure context + user activation in top frame)
- Only returns files (not empty directories)

**UX flow:**
1. User runs command "FP: Import Directory" or clicks import button in sidebar
2. Popup opens with:
   - A text field for the **base path** (the absolute path to the directory being imported, e.g., `/Users/john/project`)
   - A "Choose Directory" button that triggers the file input
3. After directory selection, popup shows:
   - Count of discovered paths
   - Preview list of paths that will be created (scrollable, first ~20 shown)
   - "Import" button to confirm
4. On confirm:
   - Combines base path + relative paths from the file input
   - Extracts all unique directory prefixes
   - Creates path Rems for all (deduplicating against existing)
   - Toast: "Imported N paths"

**Path construction:**
```
basePath = "/Users/john/project"    (user-entered)
relativePath = "project/src/index.ts"    (from webkitRelativePath)

// Strip the top-level directory name (it duplicates the last segment of basePath)
strippedRelative = "src/index.ts"

// Combine
fullPath = "/Users/john/project/src/index.ts"

// Generate all prefixes
prefixes = ["/Users/john", "/Users/john/project", "/Users/john/project/src", "/Users/john/project/src/index.ts"]
```

**Edge cases:**
- If `webkitdirectory` is not supported (unlikely in Electron), show a toast explaining incompatibility and suggest using "FP: Bulk Add Paths" instead
- Empty directories won't appear (limitation of the browser API — only files are listed). Note this in the UI.
- Large directories (>1000 files): Show progress feedback, batch Rem creation

**Graceful degradation:**
- If the file picker fails or returns empty, show informative toast
- The "FP: Bulk Add Paths" command remains available as a manual alternative

**Registration:**
- New command: `import-directory` / "FP: Import Directory"
- New popup widget: `directory_importer`
- Device-picker chaining (same pattern as other commands)

---

## Implementation Order

1. **File Tree Sidebar** — standalone widget, no dependencies on new features
2. **Directory Import** — new command + popup widget, reuses existing path creation utils

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/widgets/file_tree.tsx` | Create | RightSidebar widget |
| `src/widgets/directory_importer.tsx` | Create | Import popup widget |
| `src/widgets/utils.ts` | Modify | Add `buildTreeFromPaths` helper |
| `src/widgets/index.tsx` | Modify | Register new widgets + commands |
| `src/style.css` | Modify | Tree sidebar styles |
| `src/widgets/utils.test.ts` | Modify | Tests for `buildTreeFromPaths` |

## Out of Scope

- Drag-to-reorder in tree (mentioned in roadmap as "nice to have" — too complex for first pass)
- Right-click context menu on tree nodes (can add later)
- File System Access API (`showDirectoryPicker`) — blocked in iframes, `webkitdirectory` is more reliable
- Importing empty directories (browser API limitation)
