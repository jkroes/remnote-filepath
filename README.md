# File Path Hierarchy Plugin for RemNote

This plugin turns a pasted file path into a structured hierarchy of Rems. Each segment of the path becomes its own Rem, tagged for reuse, linked with the correct `file://` URL, and stored beneath a shared “Filepaths” root (or any custom name you provide). The original “raw path” Rem is removed once the hierarchy is created, so you are left with a clean, navigable structure that mirrors your filesystem.

## Features

- `Create Path Hierarchy` command parses absolute or relative paths from macOS or Windows (including `file:///` links or paths with spaces and parentheses).
- Reuses any existing tagged Rems, allowing you to build up a library of frequently used paths without duplication.
- Automatically links every node using the full path that node represents, so clicking a Rem opens the correct file or folder via the OS.
- Tags each Rem with a configurable “path” tag so you can search/filter or build queries around your filesystem references.
- Configurable names for the tag and the top-level root Rem (default: `path` tag under a `Filepaths` root).
- Can be triggered from the Omnibar/Command Palette and bound to a keyboard shortcut through RemNote’s plugin shortcut UI.

## Installation

### Development Installation

1. Clone this repository or download the files
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. In RemNote, go to Settings > Plugins > Build tab
5. Click "Develop from localhost"
   6. Enter `http://localhost:8080`

## Usage

1. Paste any file or folder path into the Rem you want to convert (examples: `/Users/jkroes/remnote`, `file:///C:/Users/Alice/Documents/report.docx`).
2. Run the command palette (`Cmd/Ctrl + P`), search for **Create Path Hierarchy**, and execute it. You can also bind this command to a shortcut from Settings ▸ Keyboard ▸ Plugins.
3. The plugin will:
   - Create (or reuse) Rems for every path segment under the `Filepaths` root.
   - Tag each Rem with the configured path tag.
   - Replace the text with a `file://` link pointing to that node’s full path.
   - Delete the original Rem you ran the command on, leaving only the hierarchical structure.

### Settings

Find these under the plugin’s Settings tab:

| Setting | Default | Description |
| --- | --- | --- |
| Path Tag Name | `path` | Tag applied to every Rem that participates in a file path hierarchy. |
| Filepaths Root Name | `Filepaths` | Name of the top-level Rem that stores all generated paths. |

Change these to align with your workspace conventions; the plugin will honor the new names immediately.

## File Structure

```
file-link-converter/
├── public/
│   └── manifest.json
├── src/
│   └── widgets/
│       └── index.tsx
├── package.json
├── tsconfig.json
└── README.md
```

## Requirements

- RemNote desktop app with plugin support.
- Node.js 18+ (for development) and npm.

## Permissions

The manifest requests the `All` scope with `ReadCreateModifyDelete` access so the plugin can create/update/delete Rems anywhere in your knowledge base (needed to maintain a shared Filepaths root and reuse existing hierarchy nodes).

## Development Workflow

1. Install dependencies: `npm install`
2. Start the dev server (with hot reload): `npm start`
3. In RemNote: Settings ▸ Plugins ▸ Build ▸ “Develop from Localhost” → `http://localhost:8080`
4. Make edits in `src/widgets/index.tsx`; the dev server rebuilds automatically.

To publish, run your production build (e.g., `npm run build`), zip the `dist` output alongside `public/manifest.json`, and upload that archive through RemNote’s “Publish Plugin” flow.

## License

MIT

## Author

Your Name (replace with your actual contact info before publishing)
