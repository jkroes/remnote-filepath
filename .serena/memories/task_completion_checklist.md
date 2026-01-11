# Task Completion Checklist

When completing a task in this project, follow these steps:

## 1. Type Checking
```bash
npm run check-types
```
Ensure no TypeScript errors before committing.

## 2. Manual Testing
1. Run `npm run dev` to start the dev server
2. In RemNote, connect to localhost:8080
3. Test the "Create Path Hierarchy" command with:
   - Unix paths: `/Users/test/file.txt`
   - Windows paths: `C:\Users\test\file.txt`
   - file:// URLs: `file:///path/to/file`
4. Verify settings work (Path Tag Name, Filepaths Root Name)

## 3. Build Verification
```bash
npm run build
```
Ensure production build completes without errors.

## 4. Code Style
- Ensure Prettier formatting is applied (single quotes, no tabs, trailing commas)
- Follow existing naming conventions (UPPER_SNAKE_CASE for constants, camelCase for functions)

## 5. Git Commit
```bash
git add .
git commit -m "Descriptive commit message"
```

## Notes
- No automated test suite configured
- No linting command configured (only type checking)
- Format code manually or configure editor to use Prettier
