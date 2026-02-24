[繁體中文](README.md)

# Claude Code Canvas

- A canvas tool for visually designing and executing AI Agent workflows
- Powered by Claude Agent SDK for agent execution

## Important Notes

- This project is currently in **Alpha**. Features and UI may change significantly.
- Recommended for **local environment** use only, not recommended for cloud deployment (no user authentication is implemented).
- Since it uses the **Claude Agent SDK**, make sure the service runs in an environment where **Claude is already logged in**. Otherwise, you will need to configure an API Key.
- Currently **only tested on macOS**. Other operating systems may have unknown issues.

## Installation & Getting Started

**Prerequisites:** Bun

**Frontend**

```bash
cd frontend && bun install && bun run dev
```

Runs on port 5173.

**Backend**

```bash
cd backend && bun install && bun run dev
```

Runs on port 3001.

**Production**

```bash
cd backend && bun run prod
```

Builds the frontend and serves everything together from the backend.
