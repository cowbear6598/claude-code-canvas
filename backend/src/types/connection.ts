// Connection Type Definitions
// Represents connections between Pods

export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Connection {
  id: string;
  sourcePodId: string;
  sourceAnchor: AnchorPosition;
  targetPodId: string;
  targetAnchor: AnchorPosition;
  createdAt: Date;
}
