# Suggested Commands

## Development

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server with hot reload at http://localhost:8080 |
| `npm run build` | Production build → creates `dist/` and `PluginZip.zip` |
| `npm run check-types` | Run TypeScript type checking (tsc) |

## Testing in RemNote
1. Run `npm run dev`
2. In RemNote: Settings → Plugins → Build → "Develop from Localhost" → `http://localhost:8080`

## Publishing
1. Run `npm run build`
2. Upload `PluginZip.zip` through RemNote's "Publish Plugin" flow

## Git Commands
| Command | Description |
|---------|-------------|
| `git status` | Check working tree status |
| `git add .` | Stage all changes |
| `git commit -m "message"` | Commit staged changes |
| `git push` | Push to remote |
| `git pull` | Pull from remote |
| `git log --oneline -10` | View recent commits |

## System Commands (macOS/Darwin)
| Command | Description |
|---------|-------------|
| `ls -la` | List files with details |
| `find . -name "*.ts"` | Find TypeScript files |
| `grep -r "pattern" src/` | Search for pattern in src |
