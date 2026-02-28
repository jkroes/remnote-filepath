# RemNote Filepath

A RemNote plugin for managing filesystem paths as navigable knowledge base entries. Create, browse, and reference file paths directly within your RemNote knowledge base.

## Features

### Create Path Hierarchies

Run the **Filepath: Create Path** command to open an input popup. Paste or type any absolute file path (e.g., `/Users/john/Documents/report.pdf`) and the plugin creates a Rem for each path segment. Segments are stored flat under a per-device parent Rem and identified by their structural position (direct children of a device Rem under the Filepaths root).

After creation, the full path is automatically copied to your clipboard.

### Navigate Child Paths

When viewing a path Rem, a widget below the page title displays its direct child paths as clickable buttons (showing just the final segment, e.g., "Documents" instead of the full path). This lets you browse your filesystem hierarchy without leaving RemNote.

### Copy Filepath

Run **Filepath: Copy Path** while viewing any document. The plugin scans the current document for references to path Rems, extracts the full path, and copies it to your clipboard.

### Multi-Device Support

Run **Filepath: Set Device Name** to name the current machine. Each device gets its own container Rem, so paths from different machines stay organized and don't collide.

### Per-Device Link Toggle

A boolean setting per device controls whether path segments are created with `file://` links (clickable in some environments) or as plain text.

## Commands

| Command | Description |
|---|---|
| `Filepath: Create Path` | Open popup to create a new path hierarchy |
| `Filepath: Copy Path` | Copy a filepath referenced in the current document |
| `Filepath: Set Device Name` | Set or change the device name for this machine |

## Settings

| Setting | Default | Description |
|---|---|---|
| Filepaths Root Name | `Filepaths` | Name of the top-level Rem that stores all path hierarchies |
| Enable links for "{device}" | `true` | Per-device toggle for `file://` link creation |

## How It Works

All path Rems are stored flat as direct children of a device Rem (not nested). Each Rem's text contains the full absolute path. Child relationships are determined dynamically by parsing path strings.

```
Filepaths
└── MacBook
    ├── /Users
    ├── /Users/john
    ├── /Users/john/Documents
    │   └── [your notes here]
    └── /Users/john/Documents/report.pdf
```

Your own notes appear as normal children of any path Rem, keeping personal annotations separate from the generated hierarchy.

## Permissions

The manifest requests the `All` scope with `ReadCreateModifyDelete` access so the plugin can create, update, and delete Rems anywhere in your knowledge base (needed to maintain a shared Filepaths root and reuse existing hierarchy nodes).

## Development

```bash
npm install
npm run dev
```

Load the plugin in RemNote via **Settings > Plugins > Build > Develop from local server**.

### Build

```bash
npm run build
```

Produces a `PluginZip.zip` ready for distribution.

## Author

Justin Kroes

## License

MIT
