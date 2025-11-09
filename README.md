# File Link Converter Plugin for RemNote

This RemNote plugin converts the text of a focused rem into a clickable link with a `file://` prefix. This is useful for creating links to local files on your computer.

## Features

- Converts rem text into a file:// link
- Preserves the original text as the link's display text
- Accessible via command palette or slash commands

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

1. Focus on a rem that contains the file path text (e.g., `/Users/username/Documents/file.pdf`)
2. Open the command palette (Ctrl/Cmd + P) or use slash command (/)
3. Type "Convert to File Link" and press Enter
4. The rem text will be converted to a clickable file:// link

## Example

**Before:**
```
/Users/username/Documents/important.pdf
```

**After:**
A clickable link displaying `/Users/username/Documents/important.pdf` that opens `file:///Users/username/Documents/important.pdf` when clicked.

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

- RemNote with plugin support
- Node.js (for development)
- npm or yarn

## Notes

- The plugin requires "FocusedSubtree" ReadWrite permissions
- Works with local file paths
- The `file://` protocol behavior depends on your operating system and browser

## License

MIT

## Author

Your Name