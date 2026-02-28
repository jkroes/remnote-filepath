# File Path Hierarchy Plugin for RemNote

This plugin turns a pasted file path into a structured hierarchy of Rems. Each segment of the path becomes a tagged Rem, linked with a `file://` URL, and stored beneath a shared “Filepaths” root (or any custom name you provide). The original “raw path” Rem is removed once the hierarchy is created, so you are left with a clean, navigable structure that mirrors your filesystem and can be referenced throughout your notes.

## Usage

1. Paste any file or folder path into the Rem you want to convert (examples: `/Users/jkroes/remnote`, `file:///C:/Users/Alice/Documents/report.docx`).
2. Run the command palette (`Cmd/Ctrl + P`), search for **Create Path Hierarchy**, and execute it. You can also bind this command to a shortcut from Settings ▸ Keyboard ▸ Plugins.
3. The command will:
   - Create (or reuse) a hierarchy of Rems for every path segment under a configurable top-level Rem (default: `Filepaths`).
   - Tag each Rem with a configurable tag (default: `path`).
   - Replace the text with a `file://` link pointing to that node’s full path.
   - Delete the original Rem you ran the command on, leaving only the hierarchical structure. 

### Settings

| Setting | Default | Description |
| --- | --- | --- |
| Path Tag Name | `path` | Tag applied to every Rem that participates in a file path hierarchy. |
| Filepaths Root Name | `Filepaths` | Name of the top-level Rem that stores all generated paths. |

## Permissions

The manifest requests the `All` scope with `ReadCreateModifyDelete` access so the plugin can create/update/delete Rems anywhere in your knowledge base (needed to maintain a shared Filepaths root and reuse existing hierarchy nodes).

## Development Workflow

1. Install dependencies: `npm install`
2. Start the dev server (with hot reload): `npm run dev`
3. In RemNote: Settings ▸ Plugins ▸ Build ▸ “Develop from Localhost” → `http://localhost:8080`
4. Make edits in `src/widgets/index.tsx`; the dev server rebuilds automatically.

To publish, run your production build (e.g., `npm run build`), zip the `dist` output alongside `public/manifest.json`, and upload that archive through RemNote’s “Publish Plugin” flow.

## License

MIT

## Author

Justin Kroes
