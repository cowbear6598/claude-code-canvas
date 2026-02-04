export interface Canvas {
  id: string;
  name: string;
  createdAt: Date;
  sortIndex: number;
}

export interface PersistedCanvas {
  id: string;
  name: string;
  createdAt: string;
  sortIndex: number;
}
