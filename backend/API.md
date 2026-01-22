# Claude Code Canvas Backend API Documentation

Version: 0.1.0
Base URL: `http://localhost:3001`

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [REST API Endpoints](#rest-api-endpoints)
  - [Pod Management](#pod-management)
  - [Git Operations](#git-operations)
  - [Chat Operations](#chat-operations)
- [WebSocket Events](#websocket-events)
- [Data Models](#data-models)

---

## Overview

The Claude Code Canvas Backend API provides endpoints for managing AI-powered Pods, each with its own workspace and Claude Agent session. The API supports:

- Creating and managing Pods
- Cloning Git repositories into Pod workspaces
- Real-time chat with Claude Agent via WebSocket
- Tool usage monitoring and streaming responses

---

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

**Note:** For production deployment, implement proper authentication mechanisms.

---

## Error Handling

All errors follow a consistent JSON structure:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required or failed |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## REST API Endpoints

### Pod Management

#### Create Pod

Creates a new Pod with an isolated workspace.

**Endpoint:** `POST /api/pods`

**Request Body:**
```json
{
  "name": "My Code Assistant",
  "type": "Code Assistant",
  "color": "blue"
}
```

**Valid Types:**
- `Code Assistant`
- `Chat Companion`
- `Creative Writer`
- `Data Analyst`
- `General AI`

**Valid Colors:**
- `blue`
- `coral`
- `pink`
- `yellow`
- `green`

**Response:** `201 Created`
```json
{
  "pod": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Code Assistant",
    "type": "Code Assistant",
    "color": "blue",
    "status": "idle",
    "workspacePath": "/workspaces/pod-123e4567-e89b-12d3-a456-426614174000",
    "gitUrl": null,
    "createdAt": "2026-01-23T00:00:00.000Z",
    "lastActiveAt": "2026-01-23T00:00:00.000Z"
  }
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Invalid or missing fields

---

#### Get All Pods

Retrieves all existing Pods.

**Endpoint:** `GET /api/pods`

**Response:** `200 OK`
```json
{
  "pods": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "My Code Assistant",
      "type": "Code Assistant",
      "color": "blue",
      "status": "idle",
      "workspacePath": "/workspaces/pod-123e4567-e89b-12d3-a456-426614174000",
      "gitUrl": null,
      "createdAt": "2026-01-23T00:00:00.000Z",
      "lastActiveAt": "2026-01-23T00:00:00.000Z"
    }
  ]
}
```

---

#### Get Pod by ID

Retrieves a specific Pod by its ID.

**Endpoint:** `GET /api/pods/:id`

**URL Parameters:**
- `id` (string) - Pod UUID

**Response:** `200 OK`
```json
{
  "pod": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Code Assistant",
    "type": "Code Assistant",
    "color": "blue",
    "status": "idle",
    "workspacePath": "/workspaces/pod-123e4567-e89b-12d3-a456-426614174000",
    "gitUrl": "https://github.com/user/repo.git",
    "createdAt": "2026-01-23T00:00:00.000Z",
    "lastActiveAt": "2026-01-23T00:00:00.000Z"
  }
}
```

**Errors:**
- `404 NOT_FOUND` - Pod not found

---

#### Delete Pod

Deletes a Pod, its workspace, and Claude session.

**Endpoint:** `DELETE /api/pods/:id`

**URL Parameters:**
- `id` (string) - Pod UUID

**Response:** `204 No Content`

**Errors:**
- `404 NOT_FOUND` - Pod not found

---

### Git Operations

#### Clone Repository

Clones a Git repository into the Pod's workspace.

**Endpoint:** `POST /api/pods/:id/git/clone`

**URL Parameters:**
- `id` (string) - Pod UUID

**Request Body:**
```json
{
  "repoUrl": "https://github.com/user/repo.git",
  "branch": "main"
}
```

**Supported URL Formats:**
- HTTPS: `https://github.com/user/repo.git`
- SSH: `git@github.com:user/repo.git`
- GitHub shorthand: `user/repo`

**Response:** `200 OK`
```json
{
  "pod": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "My Code Assistant",
    "type": "Code Assistant",
    "color": "blue",
    "status": "idle",
    "workspacePath": "/workspaces/pod-123e4567-e89b-12d3-a456-426614174000",
    "gitUrl": "https://github.com/user/repo.git",
    "createdAt": "2026-01-23T00:00:00.000Z",
    "lastActiveAt": "2026-01-23T00:00:00.000Z"
  }
}
```

**Errors:**
- `404 NOT_FOUND` - Pod not found
- `400 VALIDATION_ERROR` - Invalid Git URL

---

### Chat Operations

#### Send Message

Sends a message to the Claude Agent associated with the Pod. The response streams via WebSocket.

**Endpoint:** `POST /api/pods/:id/chat`

**URL Parameters:**
- `id` (string) - Pod UUID

**Request Body:**
```json
{
  "message": "Please explain the code in main.ts"
}
```

**Response:** `202 Accepted`
```json
{
  "messageId": "msg-123e4567-e89b-12d3-a456-426614174000"
}
```

**Notes:**
- The actual response streams via WebSocket events (see WebSocket Events section)
- Pod status changes to `busy` during processing
- Connect to WebSocket and join the pod room to receive streaming updates

**Errors:**
- `404 NOT_FOUND` - Pod not found
- `400 VALIDATION_ERROR` - Invalid or empty message
- `409 CONFLICT` - Pod is already busy

---

## WebSocket Events

Connect to WebSocket server at: `ws://localhost:3001`

### Client Events

#### Join Pod Room

Join a Pod's room to receive its events.

**Event:** `join:pod`

**Payload:**
```json
{
  "podId": "123e4567-e89b-12d3-a456-426614174000"
}
```

---

#### Leave Pod Room

Leave a Pod's room.

**Event:** `leave:pod`

**Payload:**
```json
{
  "podId": "123e4567-e89b-12d3-a456-426614174000"
}
```

---

### Server Events

#### Pod Message

Streamed text response from Claude Agent.

**Event:** `pod:message`

**Payload:**
```json
{
  "podId": "123e4567-e89b-12d3-a456-426614174000",
  "messageId": "msg-123e4567-e89b-12d3-a456-426614174000",
  "content": "Based on the code in main.ts...",
  "isPartial": true
}
```

**Notes:**
- `isPartial: true` indicates more content is coming
- `isPartial: false` indicates this is the final chunk

---

#### Pod Tool Use

Emitted when Claude Agent uses a tool.

**Event:** `pod:tool_use`

**Payload:**
```json
{
  "podId": "123e4567-e89b-12d3-a456-426614174000",
  "messageId": "msg-123e4567-e89b-12d3-a456-426614174000",
  "toolName": "Read",
  "input": {
    "file_path": "/workspaces/pod-123/main.ts"
  }
}
```

---

#### Pod Complete

Emitted when Claude Agent completes processing.

**Event:** `pod:complete`

**Payload:**
```json
{
  "podId": "123e4567-e89b-12d3-a456-426614174000",
  "messageId": "msg-123e4567-e89b-12d3-a456-426614174000"
}
```

---

#### Pod Error

Emitted when an error occurs during processing.

**Event:** `pod:error`

**Payload:**
```json
{
  "podId": "123e4567-e89b-12d3-a456-426614174000",
  "error": "Failed to process message",
  "code": "INTERNAL_ERROR"
}
```

---

## Data Models

### Pod

```typescript
interface Pod {
  id: string;                 // UUID v4
  name: string;               // Pod name (max 100 chars)
  type: PodTypeName;          // Pod type
  color: PodColor;            // UI color
  status: 'idle' | 'busy' | 'error';
  workspacePath: string;      // Absolute path to workspace
  gitUrl: string | null;      // Cloned repository URL
  createdAt: Date;            // Creation timestamp
  lastActiveAt: Date;         // Last activity timestamp
}
```

### Message

```typescript
interface Message {
  id: string;                 // Message UUID
  podId: string;              // Associated Pod ID
  role: 'user' | 'assistant'; // Message sender
  content: string;            // Message text
  toolUse: ToolUseInfo | null;// Tool usage info
  createdAt: Date;            // Message timestamp
}
```

### ToolUseInfo

```typescript
interface ToolUseInfo {
  toolName: string;           // Name of tool used
  input: Record<string, unknown>;  // Tool input parameters
  output: string | null;      // Tool output result
}
```

---

## Health Check

**Endpoint:** `GET /api/health`

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-01-23T00:00:00.000Z"
}
```

---

## Rate Limiting

Currently not implemented. For production, consider implementing rate limiting to prevent abuse.

---

## CORS Configuration

Default CORS origin: `http://localhost:5173`

Configure via `CORS_ORIGIN` environment variable.

---

**Last Updated:** 2026-01-23
**API Version:** 0.1.0
