# Project Overview: RemNote Filepath Plugin

## Purpose
A RemNote plugin that converts pasted file paths into structured hierarchies of Rems. Each path segment becomes a tagged Rem with a clickable `file://` URL, stored under a shared "Filepaths" root.

## Author
Justin Kroes

## Tech Stack
- **Language**: TypeScript
- **Framework**: React 17
- **Build Tool**: Webpack 5
- **Styling**: Tailwind CSS 3, PostCSS
- **Platform**: RemNote Plugin SDK (`@remnote/plugin-sdk`)
- **Package Manager**: npm

## Project Structure
```
remnote-filepath/
├── src/
│   ├── widgets/
│   │   └── index.tsx      # Main plugin logic (single file)
│   ├── index.css          # CSS imports
│   └── style.css          # Custom styles
├── public/
│   └── manifest.json      # Plugin manifest
├── package.json           # Dependencies & scripts
├── tsconfig.json          # TypeScript config (strict mode)
├── webpack.config.js      # Build configuration
├── tailwind.config.js     # Tailwind CSS config
├── postcss.config.js      # PostCSS config
└── .prettierrc            # Code formatting rules
```

## Main Functionality
- Single command: "Create Path Hierarchy" (id: `path-to-hierarchy`)
- Configurable settings:
  - `path-tag-name`: Tag for path Rems (default: "path")
  - `filepath-root-name`: Root Rem name (default: "Filepaths")
- Supports Windows (`C:\...`) and Unix (`/...`) paths
- Handles `file://` protocol prefix
