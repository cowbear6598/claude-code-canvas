export type GroupType = 'command' | 'output-style' | 'subagent';

export const GROUP_TYPES = {
  COMMAND: 'command',
  OUTPUT_STYLE: 'output-style',
  SUBAGENT: 'subagent',
} as const;

export interface Group {
  id: string;
  name: string;
  type: GroupType;
}
