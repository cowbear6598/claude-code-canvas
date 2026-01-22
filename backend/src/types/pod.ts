// Pod Type Definitions

export type PodColor = 'blue' | 'coral' | 'pink' | 'yellow' | 'green';

export type PodTypeName =
  | 'Code Assistant'
  | 'Chat Companion'
  | 'Creative Writer'
  | 'Data Analyst'
  | 'General AI';

export type PodStatus = 'idle' | 'busy' | 'error';

export interface Pod {
  id: string; // UUID
  name: string;
  type: PodTypeName;
  color: PodColor;
  status: PodStatus;
  workspacePath: string; // path to git repo
  gitUrl: string | null; // cloned repository URL
  createdAt: Date;
  lastActiveAt: Date;
  // Canvas-specific fields
  x: number; // Canvas X position
  y: number; // Canvas Y position
  rotation: number; // Rotation angle
  output: string[]; // Output lines for display
}
