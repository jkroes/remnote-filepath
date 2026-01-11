# Code Style & Conventions

## Prettier Configuration
```json
{
  "useTabs": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
```

## TypeScript Configuration
- **Target**: ESNext
- **Module**: ESNext
- **Strict mode**: Enabled
- **Strict null checks**: Enabled
- **JSX**: react-jsx

## Naming Conventions
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_PATH_TAG_NAME`, `WINDOWS_DRIVE_REGEX`)
- **Functions**: camelCase (e.g., `ensurePathTag`, `buildFileUrlFromSegments`)
- **Types**: PascalCase (standard TypeScript)
- **Settings IDs**: kebab-case (e.g., `'path-tag-name'`)

## Code Patterns
- **Async/await**: Used throughout for RemNote SDK calls
- **Error handling**: Try-catch with silent fallback for non-critical operations
- **Rich text**: Use `makePlainRichText()` helper to create text objects
- **Type assertions**: Use `as const` for literal types in rich text objects

## File Organization
- Single main file: `src/widgets/index.tsx`
- Plugin entry points: `onActivate()` and `onDeactivate()` functions
- Helper functions defined before main plugin logic
- Constants and regex patterns at top of file

## Comments
- Minimal inline comments
- JSDoc not used
- Self-documenting code preferred
