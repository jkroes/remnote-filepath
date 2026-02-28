# RemNote Plugin Development

You are a RemNote plugin developer working on this project.

## Documentation References

- **RemNote Concepts Guide**: `~/.claude/projects/-Users-jkroes-repos-remnote-filepath/memory/remnote-concepts.md`
  - Comprehensive guide covering architecture, patterns, and best practices
  - Compiled from official RemNote plugin documentation
  - **READ THIS FIRST** before implementing new features

- **Plugin API Reference**: https://plugins.remnote.com/
  - Contains the plugin API documentation and developer guides
  - Use `ref_read_url` to access specific API pages

- **Official Plugins Repository**: https://github.com/remnoteio/remnote-official-plugins
  - Reference implementations and code examples
  - Use GitHub MCP tools to explore code patterns

## Development Guidelines

**CRITICAL: Research Before Coding**

Before implementing any RemNote plugin feature, you MUST research in this order:

1. **Read RemNote Concepts Guide** (`~/.claude/projects/-Users-jkroes-repos-remnote-filepath/memory/remnote-concepts.md`)
   - Understand architecture patterns and best practices
   - Learn about widget system, rich text, events, Rem API
   - Check for relevant patterns before coding

2. **Check SDK source code** (`node_modules/@remnote/plugin-sdk/dist/*.d.ts`)
   - TypeScript definitions are the definitive API reference
   - Check `interfaces.d.ts` for types, enums, widget locations, context maps
   - Check `name_spaces/*.d.ts` for API method signatures
   - DO NOT guess or assume API behavior without checking the source

3. **Look at official plugins** for working examples
   - Use GitHub MCP tools to search: `https://github.com/remnoteio/remnote-official-plugins`
   - Find similar functionality and study the implementation

4. **Test empirically** only after understanding the API from source
   - If documentation is unclear, refer to SDK source
   - Only guess as a last resort after exhausting all references

When working on plugin functionality:
1. Consult the Concepts Guide for patterns and architecture
2. Research the SDK source code for API details
3. Reference official plugins for implementation examples
4. Follow RemNote plugin conventions and best practices

## Architecture: Flat Hierarchy with Structural Identification

**Current Design:** All path Rems are stored flat as direct children of the device Rem. Each Rem contains the full absolute path in its text (e.g., `/Users/john/Documents/file.txt`). Path Rems are identified by structural position (direct child of device Rem, grandchild of Filepaths root) — no powerup or tag needed. Child relationships are determined dynamically by parsing path strings.

**Hierarchy structure:**
```
Filepaths (root)
└── DeviceName
    ├── /Users
    ├── /Users/john
    ├── /Users/john/Documents
    │   └── [user notes]  ← real children
    └── /Users/john/Documents/file.txt
```

**Widget:** A `DocumentBelowTitle` widget displays navigable child paths (showing just the final segment) below the page title when viewing a path Rem. Uses `AppEvents.URLChange` to track navigation since document-level widgets are single reused instances. User notes appear as normal children beneath the path Rem.

## Implemented Features

1. **Flat hierarchy with structural identification**
   - All path Rems stored flat under device Rem (no nesting)
   - Each Rem's text = full absolute path (with optional `file://` link)
   - Path Rems identified by position: direct child of device Rem, grandchild of Filepaths root
   - Widget shows child paths dynamically via path parsing

2. **Per-device link-creation toggle**
   - `index.tsx` onActivate scans device Rems, registers `device-links-{name}` boolean setting per device
   - `device_picker.tsx` best-effort registers the setting when new device is selected
   - Path creation logic reads the setting and passes `createLinks` flag to `ensureSegmentRem`
   - If false, creates plain text instead of `file://` link

3. **"Create Path" command with input popup**
   - Command `path-to-hierarchy` opens `path_creator` popup for path input
   - User enters/pastes path in popup
   - Creates flat path Rems for each accumulated segment
   - After creating hierarchy, copies the filepath to clipboard automatically

4. **"Copy Filepath" command + popup**
   - Command `copy-filepath` opens `filepath_copier` popup
   - Scans document for Rem references to path Rems (via structural check)
   - Reads full path directly from referenced Rem's text
   - Widget `src/widgets/filepath_copier.tsx`

5. **Child paths navigation widget**
   - `DocumentBelowTitle` widget shows child paths below page title on path Rems
   - Listens to `AppEvents.URLChange` to re-fetch widget context on navigation (document-level widgets are single reused instances)
   - Uses `useTracker` with `[documentId]` dep for reactive data fetching
   - Filters out non-path Rems by structural check (is Rem a grandchild of Filepaths root?)
   - Displays just the final segment (e.g., "file.txt" instead of full path)
   - Clickable buttons navigate to child path Rems
   - Returns null for non-path Rems or leaf nodes with no children

## File Overview

- `src/widgets/index.tsx` — Main plugin: settings, commands, widget registration
- `src/widgets/device_picker.tsx` — Popup for device name selection
- `src/widgets/path_creator.tsx` — Popup for creating new path hierarchies (flat structure)
- `src/widgets/filepath_copier.tsx` — Popup for copying existing filepaths
- `src/widgets/child_paths.tsx` — DocumentBelowTitle widget displaying navigable child paths
- `src/widgets/utils.ts` — Shared utilities:
  - Constants: `DEVICE_NAME_STORAGE_KEY`, `FILEPATH_ROOT_SETTING_ID`, etc.
  - Path helpers: `normalizePath`, `toFileUrl`, `getPathPrefixes`
  - Path identification: `isPathRem` (structural check), `getPathFromRem`, `getLastSegment`, `isDirectChild`
  - Rem management: `ensurePathRem`, `findExistingPathRem`, `ensureFilepathsRoot`, `ensureDeviceRem`

## SDK Gotchas

- **Document-level widget locations (`DocumentBelowTitle`, etc.) are single reused instances** — not one per document. Must listen to `AppEvents.URLChange` to detect navigation and re-fetch widget context.
- **`getWidgetContext` is not tracked by `useTracker`** — fetch it via `useState` + `useEffect` with a URLChange listener, then pass the ID as a dep to `useTracker` for data fetching.
- **`powerupFilter` only works with per-Rem locations** (`UnderRemEditor`, `RightSideOfEditor`) — document-level widgets must filter themselves manually.

## Sandbox

This project runs in a sandboxed environment.

**Filesystem:** Writes restricted to `.` (current directory) and `$TMPDIR`. `.git/` is within `.` so all git commands work without bypass.

**Network:** Only `plugins.remnote.com`, `raw.githubusercontent.com`, `github.com` are allowed.

### Commands that need `dangerouslyDisableSandbox: true`

- `npm install` / `npm ci` — needs network access to `registry.npmjs.org`

### General patterns

- Use relative paths, not absolute paths or `git -C`. The sandbox is scoped to `.`.
- Use `$TMPDIR` for temp files, never `/tmp` directly.
- Use multiple `-m` flags for git commit messages, not heredocs (heredocs create temp files that may fail in sandbox).
