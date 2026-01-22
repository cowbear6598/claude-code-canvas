# Claude Code Canvas - Backend

Backend server for Claude Code Canvas, providing Pod management and Claude Agent SDK integration.

## Overview

This backend server provides:

- **Pod Management**: Create and manage AI-powered Pods with isolated workspaces
- **Claude Agent Integration**: Real-time AI assistance via Claude Agent SDK
- **Git Operations**: Clone repositories into Pod workspaces
- **WebSocket Streaming**: Real-time message streaming and tool usage monitoring
- **REST API**: RESTful endpoints for all operations

## Prerequisites

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Anthropic API Key**: Get from [Anthropic Console](https://console.anthropic.com/)

## Installation

1. Clone the repository and navigate to backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Create environment configuration:

```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Workspace Configuration
WORKSPACE_ROOT=/workspaces

# CORS
CORS_ORIGIN=http://localhost:5173

# Optional: GitHub Token for private repos
GITHUB_TOKEN=ghp_xxxxx
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `ANTHROPIC_API_KEY` | **Yes** | - | Anthropic API key (must start with `sk-ant-`) |
| `WORKSPACE_ROOT` | No | /workspaces | Root directory for Pod workspaces |
| `CORS_ORIGIN` | No | http://localhost:5173 | Allowed CORS origin |
| `GITHUB_TOKEN` | No | - | GitHub token for private repository access |

## Development

### Running the Development Server

Start the server with hot-reload:

```bash
npm run dev
```

The server will start at `http://localhost:3001`.

### Building for Production

Compile TypeScript to JavaScript:

```bash
npm run build
```

Output will be in the `dist/` directory.

### Starting Production Server

```bash
npm start
```

### Linting

Check code quality with ESLint:

```bash
npm run lint
```

## Testing

### Running Tests

Execute all tests:

```bash
npm test
```

### Running Tests in Watch Mode

```bash
npm test -- --watch
```

### Running Specific Test File

```bash
npm test -- tests/services/podStore.test.ts
```

### Test Coverage

Generate coverage report:

```bash
npm test -- --coverage
```

## Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration loader
│   │   └── index.ts
│   ├── controllers/         # Request handlers
│   │   ├── chatController.ts
│   │   └── podController.ts
│   ├── middleware/          # Express middleware
│   │   ├── errorHandler.ts
│   │   ├── requestLogger.ts
│   │   └── validateRequest.ts
│   ├── routes/              # API routes
│   │   ├── index.ts
│   │   └── podRoutes.ts
│   ├── services/            # Business logic
│   │   ├── claude/
│   │   │   ├── queryService.ts
│   │   │   └── sessionManager.ts
│   │   ├── workspace/
│   │   │   ├── gitService.ts
│   │   │   └── index.ts
│   │   ├── podStore.ts
│   │   ├── socketHandlers.ts
│   │   └── socketService.ts
│   ├── types/               # TypeScript type definitions
│   │   ├── api.ts
│   │   ├── index.ts
│   │   ├── message.ts
│   │   ├── pod.ts
│   │   └── websocket.ts
│   ├── utils/               # Utility functions
│   │   ├── errors.ts
│   │   ├── schemas.ts
│   │   └── validators.ts
│   └── index.ts             # Server entry point
├── tests/                   # Test files
│   ├── helpers/
│   │   └── testUtils.ts
│   ├── routes/
│   │   └── pods.test.ts
│   └── services/
│       └── podStore.test.ts
├── .env.example             # Environment template
├── .eslintrc.json           # ESLint configuration
├── package.json             # NPM package configuration
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Vitest test configuration
├── API.md                   # API documentation
└── README.md                # This file
```

## API Documentation

See [API.md](./API.md) for complete API documentation including:

- REST API endpoints
- Request/response examples
- WebSocket events
- Data models
- Error codes

## Key Features

### Pod Management

Each Pod represents an isolated AI workspace with:

- Unique ID and workspace directory
- Claude Agent session with allowed tools
- Git repository support
- Status tracking (idle, busy, error)
- Customizable name, type, and color

### Claude Agent SDK Integration

- **Session Management**: One Claude session per Pod
- **Allowed Tools**: Read, Write, Edit, Bash, Glob, Grep
- **Permission Mode**: acceptEdits (auto-approve file edits)
- **Streaming Responses**: Real-time message streaming via WebSocket

### WebSocket Real-Time Updates

Clients can subscribe to Pod events:

- `pod:message` - Streamed text responses
- `pod:tool_use` - Tool usage notifications
- `pod:complete` - Processing completion
- `pod:error` - Error notifications

### Git Integration

- Clone repositories (HTTPS, SSH, GitHub shorthand)
- Branch selection support
- Workspace isolation per Pod

## Technology Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **WebSocket**: Socket.io
- **Git**: simple-git
- **AI**: @anthropic-ai/claude-agent-sdk
- **Testing**: Vitest + Supertest

## Architecture

### In-Memory Storage

The current implementation uses in-memory storage (Map) for Pod data. This means:

- ✅ Fast and simple for development
- ✅ No database setup required
- ⚠️ Data lost on server restart
- ⚠️ Not suitable for production

**For production**, consider migrating to:
- PostgreSQL (relational)
- MongoDB (document-based)
- Redis (for session data)

### Workspace Management

Each Pod gets its own workspace directory:

```
/workspaces/
  pod-123e4567-e89b.../  # Pod 1 workspace
  pod-789abcde-f012.../  # Pod 2 workspace
```

Workspaces are:
- Isolated per Pod
- Created on Pod creation
- Deleted on Pod deletion
- Scoped to prevent directory traversal attacks

### Claude Session Lifecycle

1. **Creation**: Session created lazily on first chat message
2. **Configuration**: Set working directory to Pod workspace
3. **Tool Access**: Granted access to file and shell tools
4. **Cleanup**: Destroyed when Pod is deleted

## Security Considerations

### Current Implementation

- ⚠️ No authentication/authorization
- ⚠️ CORS limited to configured origin
- ⚠️ File operations scoped to workspace
- ✅ Helmet security headers enabled
- ✅ Input validation on all endpoints

### Production Recommendations

1. **Authentication**: Add JWT or OAuth2
2. **Rate Limiting**: Prevent API abuse
3. **Input Sanitization**: Enhanced validation
4. **HTTPS**: Use SSL/TLS certificates
5. **Environment Secrets**: Use secret management (e.g., AWS Secrets Manager)
6. **Workspace Isolation**: Consider containerization (Docker)

## Troubleshooting

### Server won't start

**Error:** `ANTHROPIC_API_KEY is required`

**Solution:** Set valid API key in `.env` file

---

**Error:** `Port 3001 already in use`

**Solution:** Change `PORT` in `.env` or kill process using port 3001

---

### Tests failing

**Error:** Module import errors

**Solution:** Ensure all dependencies are installed:
```bash
npm install
```

---

**Error:** Workspace permission errors

**Solution:** Ensure `WORKSPACE_ROOT` directory exists and has write permissions:
```bash
mkdir -p /workspaces
chmod 755 /workspaces
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Run `npm run lint` and `npm test`
5. Submit a pull request

## License

ISC

## Support

For issues and questions:
- Check [API.md](./API.md) for API documentation
- Review [Project Structure](#project-structure)
- Search existing issues

---

**Version:** 0.1.0
**Last Updated:** 2026-01-23
