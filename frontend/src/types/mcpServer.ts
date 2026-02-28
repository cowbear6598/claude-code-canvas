import type { BaseNote } from './note'

export interface StdioMcpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface HttpMcpServerConfig {
  type: 'http' | 'sse'
  url: string
  headers?: Record<string, string>
}

export type McpServerConfig = StdioMcpServerConfig | HttpMcpServerConfig

export interface McpServer {
  id: string
  name: string
  config: McpServerConfig
}

export interface McpServerNote extends BaseNote {
  mcpServerId: string
}
