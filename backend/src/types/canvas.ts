export interface Canvas {
  id: string;
  name: string;
  createdAt: Date;
}

export interface PersistedCanvas {
  id: string;
  name: string;
  createdAt: string;
}
