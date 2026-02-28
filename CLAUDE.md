# RemNote Plugin Development

You are a RemNote plugin developer working on this project.

## Documentation References

- **RemNote Concepts Guide**: `~/.claude/projects/-Users-jkroes-repos-remnote-filepath/memory/remnote-concepts.md`
  - Comprehensive guide covering architecture, patterns, and best practices
  - Compiled from official RemNote plugin documentation
  - **READ THIS FIRST** before implementing new features

- **Plugin API Reference**: https://plugins.remnote.com/
  - Contains the plugin API documentation and developer guides
  - Use `WebFetch` to access specific API pages

- **Official Plugins Repository**: https://github.com/remnoteio/remnote-official-plugins
  - Reference implementations and code examples
  - Use GitHub MCP tools to explore code patterns

## Commands

- `npm run dev` — Start webpack dev server on port 8080 (load in RemNote as localhost plugin)
- `npm run build` — Validate manifest, build production bundle, create PluginZip.zip
- `npm run check-types` — Run TypeScript compiler (no emit)
- `npm test` — Run Vitest tests (single run)
- `npm run test:watch` — Run Vitest in watch mode
- `npm install` — Requires `dangerouslyDisableSandbox: true` (needs registry.npmjs.org)

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

**Widget:** A `DocumentBelowTitle` widget displays breadcrumb navigation, a copy-to-clipboard button, and navigable child paths below the page title when viewing any path Rem. Uses `AppEvents.URLChange` to track navigation since document-level widgets are single reused instances. User notes appear as normal children beneath the path Rem.

## Implemented Features

1. **Flat hierarchy with structural identification**
   - All path Rems stored flat under device Rem (no nesting)
   - Each Rem's text = full absolute path (with optional `file://` link)
   - Path Rems identified by position: direct child of device Rem, grandchild of Filepaths root
   - Widget shows child paths dynamically via path parsing

2. **Per-device link-creation toggle**
   - `index.tsx` onActivate scans device Rems, registers `device-links-{name}` boolean setting per device
   - `device_picker.tsx` best-effort registers the setting when new device is selected
   - Path creation logic reads the setting and passes `createLinks` flag to `ensurePathRem`
   - If false, creates plain text instead of `file://` link

3. **"FP: Add Path" command with input popup**
   - Command `path-to-hierarchy` detects current path Rem context, checks device name
   - If no device name set, auto-opens device picker first, then chains to path creator
   - User enters/pastes path in popup
   - Pre-fills with current path + `/` when invoked from a path Rem
   - Rejects relative paths with an error toast
   - Normalizes input, generates all path prefixes, creates a Rem for each
   - After creating hierarchy, copies the filepath to clipboard automatically

4. **"FP: Copy Referenced Path" command + popup**
   - Command `copy-filepath` opens `filepath_copier` popup
   - Scans document for Rem references to path Rems (via structural check)
   - Reads full path directly from referenced Rem's text
   - Widget `src/widgets/filepath_copier.tsx`

5. **Child paths navigation widget**
   - `DocumentBelowTitle` widget shows breadcrumbs, copy button, and child paths on path Rems
   - Breadcrumb trail shows clickable ancestor path segments for upward navigation
   - Copy button copies current path to clipboard with toast feedback
   - Widget renders on all path Rems (not just those with children)
   - Listens to `AppEvents.URLChange` to re-fetch widget context on navigation
   - Uses `useTracker` with `[documentId]` dep for reactive data fetching
   - Returns null for non-path Rems only

6. **Performance indexing (per-operation Map)**
   - `buildPathIndex(deviceRem)` builds `Map<string, Rem>` from single `getChildrenRem()` call
   - `findExistingPathRem` and `ensurePathRem` accept optional index parameter
   - `child_paths.tsx` and `path_creator.tsx` build index once per operation

7. **Fuzzy matching**
   - `fuzzyMatch(query, target)` scores non-contiguous character matches
   - Scoring: +1 per match, +2 consecutive bonus, +3 path-separator bonus
   - Used in filepath_copier and global path search

8. **"FP: Search All Paths" global path search**
   - Command `search-paths` opens `path_search` popup
   - Scans all devices, fuzzy-filtered list with device labels
   - Enter navigates to path Rem, Cmd/Ctrl+Enter copies path
   - Widget `src/widgets/path_search.tsx`

9. **"FP: Bulk Add Paths" bulk path creation**
   - Command `bulk-create-paths` opens `bulk_path_creator` popup
   - Textarea accepts multiple paths (one per line)
   - Deduplicates prefixes across all paths, skips invalid (relative) paths
   - Shows summary toast: "Created N paths, skipped M invalid"
   - Auto-prompts device picker if no device set (chains via `returnTo`)
   - Widget `src/widgets/bulk_path_creator.tsx`

10. **"FP: Delete This Path" command**
    - Command `delete-path` validates current document is a path Rem
    - Finds all descendants via path index, sorts deepest-first
    - Opens `delete_confirm` popup with path, descendant count, and Rem IDs
    - Cascade deletes all descendants then the target path
    - Navigates to parent path Rem (or device Rem) after deletion
    - Widget `src/widgets/delete_confirm.tsx`

11. **Unit tests**
    - Vitest test runner with minimal config (`vitest.config.ts`)
    - Tests for pure functions in `utils.ts`: `normalizePath`, `getPathPrefixes`, `toFileUrl`, `fuzzyMatch`, `isDirectChild`, `getLastSegment`
    - Test file: `src/widgets/utils.test.ts`
    - Run with `npm test` or `npm run test:watch`

## Testing

- **Vitest** configured in `vitest.config.ts`, tests in `src/widgets/utils.test.ts`
- Pure functions in `utils.ts` are directly testable — `import type { RNPlugin }` is stripped by esbuild at compile time
- SDK-dependent functions (`ensurePathRem`, `isPathRem`, `buildPathIndex`, etc.) require mocking and are not currently tested

## File Overview

- `src/widgets/index.tsx` — Main plugin: settings, commands, widget registration
- `src/widgets/device_picker.tsx` — Popup for device name selection
- `src/widgets/path_creator.tsx` — Popup for creating new path hierarchies (flat structure)
- `src/widgets/filepath_copier.tsx` — Popup for copying existing filepaths
- `src/widgets/child_paths.tsx` — DocumentBelowTitle widget displaying navigable child paths
- `src/widgets/path_search.tsx` — Popup for searching all paths across devices with fuzzy matching
- `src/widgets/bulk_path_creator.tsx` — Popup for bulk creating multiple path hierarchies
- `src/widgets/delete_confirm.tsx` — Confirmation popup for path deletion with cascade
- `src/widgets/utils.ts` — Shared utilities:
  - Constants: `DEVICE_NAME_STORAGE_KEY`, `FILEPATH_ROOT_SETTING_ID`, etc.
  - Path helpers: `normalizePath`, `toFileUrl`, `getPathPrefixes`
  - Path identification: `isPathRem` (structural check), `getPathFromRem`, `getLastSegment`, `isDirectChild`
  - Performance: `buildPathIndex` (per-operation Map index), `fuzzyMatch` (non-contiguous character matching)
  - Rem management: `ensurePathRem`, `findExistingPathRem`, `ensureFilepathsRoot`, `ensureDeviceRem`

## SDK Gotchas

- **Document-level widget locations (`DocumentBelowTitle`, etc.) are single reused instances** — not one per document. Must listen to `AppEvents.URLChange` to detect navigation and re-fetch widget context.
- **`getWidgetContext` is not tracked by `useTracker`** — fetch it via `useState` + `useEffect` with a URLChange listener, then pass the ID as a dep to `useTracker` for data fetching.
- **`powerupFilter` only works with per-Rem locations** (`UnderRemEditor`, `RightSideOfEditor`) — document-level widgets must filter themselves manually.
- **RemNote overrides Tailwind color classes in dark mode** — Host CSS redefines classes like `.dark .dark\:text-white` using CSS variables (`--rn-colors-white-val`) that invert semantically (white becomes black). Avoid `dark:text-white`, `dark:text-gray-*`, etc. on form elements. Use explicit CSS rules (e.g., `.dark input { color: #fff; }`) instead.
- **`plugin.settings.getSetting` throws on unregistered settings** — If a setting ID was never registered (e.g., device deleted, plugin reactivated), `getSetting` throws `TypeError: Cannot read properties of undefined (reading 'defaultValue')`. Always wrap in try/catch with a sensible default.
- **`registerBooleanSetting` outside `onActivate` is unreliable** — Best-effort registration in popup widgets may silently fail. Code that reads dynamically-registered settings must handle the unregistered case.
- **`rem.remove()`** — deletes a Rem and its children. Used in `delete_confirm.tsx` for cascade path deletion.
- **`isDirectChild('/', '/Users')` returns false** — the `parent + '/'` check produces `'//'` which never matches. Root path Rems cannot have direct children via this function.

## Patterns

- **Popup chaining**: Pass `{ returnTo: 'widget_name', ...forwardedData }` in `contextData` when opening a popup that should chain to another. The receiving popup calls `openPopup(returnTo, forwardedData)` instead of `closePopup()`. Used by device_picker → path_creator flow.

- **Command naming**: All commands use "FP:" prefix. Context-dependent commands include hints in the name (e.g., "Delete **This** Path" = must be on a path Rem, "Copy **Referenced** Path" = operates on references in a document).

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
