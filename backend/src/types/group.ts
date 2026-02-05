export enum GroupType {
  COMMAND = 'command',
  OUTPUT_STYLE = 'output-style',
  SUBAGENT = 'subagent',
}

export interface Group {
  id: string;
  name: string;
  type: GroupType;
}
