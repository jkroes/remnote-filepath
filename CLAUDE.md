# RemNote Plugin Development

You are a RemNote plugin developer working on this project.

## Documentation References

- **Plugin API Reference**: https://plugins.remnote.com/
  - Contains the plugin API documentation and developer guides
  - Use `ref_read_url` to access specific API pages

- **Official Plugins Repository**: https://github.com/remnoteio/remnote-official-plugins
  - Reference implementations and code examples
  - Use GitHub MCP tools to explore code patterns

## Development Guidelines

When working on plugin functionality:
1. Reference the official API docs for correct usage
2. Look at official plugins for implementation patterns
3. Follow RemNote plugin conventions and best practices

## Implemented Features

1. **Per-device link-creation toggle**
   - `index.tsx` onActivate scans device Rems under Filepaths root, registers `device-links-{name}` boolean setting per device
   - `device_picker.tsx` best-effort registers the setting when a new device is selected
   - Path creation logic reads the setting and passes `createLinks` flag to `ensureRemTaggedAndLinked`
   - `ensureRemTaggedAndLinked` accepts `createLinks` param: if false, sets plain text instead of file:// link

2. **Remove alias creation**
   - Removed `getOrCreateAliasWithText` call from `ensureRemTaggedAndLinked`
   - Paths are now reconstructed dynamically from the hierarchy

3. **"Create Path" command with input popup**
   - Command `path-to-hierarchy` opens `path_creator` popup for path input
   - User enters/pastes path in popup instead of operating on current Rem
   - After creating hierarchy, copies the filepath to clipboard automatically
   - Widget `src/widgets/path_creator.tsx`

4. **"Copy Filepath" command + popup**
   - Command `copy-filepath` in `index.tsx` opens `filepath_copier` popup
   - Widget `src/widgets/filepath_copier.tsx`
   - Shared utilities in `src/widgets/utils.ts`

### File overview

- `src/widgets/index.tsx` — Main plugin: settings, commands, widget registration
- `src/widgets/device_picker.tsx` — Popup for device name selection
- `src/widgets/path_creator.tsx` — Popup for creating new path hierarchies
- `src/widgets/filepath_copier.tsx` — Popup for copying existing filepaths
- `src/widgets/utils.ts` — Shared: `hasPathTag`, `collectTaggedSegments`, `buildPathStringFromSegments`
