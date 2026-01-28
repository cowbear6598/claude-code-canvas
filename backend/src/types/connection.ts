export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Connection {
  id: string;
  sourcePodId: string;
  sourceAnchor: AnchorPosition;
  targetPodId: string;
  targetAnchor: AnchorPosition;
  autoTrigger: boolean;
  createdAt: Date;
}
