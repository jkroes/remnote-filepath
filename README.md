# RemNote Filepath

A RemNote plugin for managing filesystem paths as navigable knowledge base entries.

## Features

### Add Paths

Run **FP: Add Path** to create a Rem for a file path and each of its ancestor directories. When invoked from an existing path Rem, the input pre-fills with that path. The full path is copied to your clipboard after creation.

Supports Unix absolute paths, Windows drive paths, UNC paths, and `file://` URLs.

### Bulk Add Paths

Run **FP: Bulk Add Paths** to create multiple paths at once. Paste one path per line — the plugin deduplicates shared ancestors and reports results in a summary toast.

### Browse Paths

When viewing a path Rem, a widget below the title displays:

- **Breadcrumb trail** — clickable ancestors for upward navigation
- **Copy button** — copies the path to your clipboard
- **Child paths** — clickable child entries showing the final path segment

### Search All Paths

Run **FP: Search All Paths** for fuzzy search across all devices. Press Enter to navigate, or Cmd/Ctrl+Enter to copy.

### Copy Referenced Path

Run **FP: Copy Referenced Path** to scan the current document for path Rem references and copy the resolved path to your clipboard.

### Delete a Path

Run **FP: Delete This Path** to remove the current path Rem and all its descendants, with a confirmation prompt. Navigates to the parent path afterward.

### Multi-Device Support

Run **FP: Set Device** to name the current machine. Each device has its own namespace, keeping paths from different machines separate. The device picker opens automatically if no device is set.

### Per-Device Link Toggle

A per-device setting controls whether paths are created with clickable `file://` links or as plain text.

## Commands

| Command | Description |
|---|---|
| `FP: Add Path` | Create a path and its ancestors |
| `FP: Bulk Add Paths` | Create multiple paths at once |
| `FP: Search All Paths` | Fuzzy search across all devices |
| `FP: Copy Referenced Path` | Copy a referenced path from the current document |
| `FP: Delete This Path` | Delete the current path and its descendants |
| `FP: Set Device` | Set or change the device name |

## Settings

| Setting | Default | Description |
|---|---|---|
| Filepaths Root Name | `Filepaths` | Name of the top-level container Rem |
| Enable links for "{device}" | `true` | Per-device `file://` link toggle |

## How It Works

The plugin organizes paths under a root Rem, grouped by device. Each path Rem stores the full absolute path in its text. The browsing widget resolves parent and child relationships by parsing these path strings.

```
Filepaths
└── MacBook
    ├── /Users
    ├── /Users/john
    ├── /Users/john/Documents
    │   └── [your notes]
    └── /Users/john/Documents/report.pdf
```

Your notes appear as children of any path Rem, separate from the generated paths.

## Permissions

Requires `All` scope with `ReadCreateModifyDelete` access to manage path Rems across your knowledge base.

## Development

```bash
npm install
npm run dev
```

Load the plugin via **Settings > Plugins > Build > Develop from local server**.

### Build

```bash
npm run build
```

Produces `PluginZip.zip` for distribution.

### Test

```bash
npm test
npm run test:watch
```

## Author

Justin Kroes

## License

MIT
