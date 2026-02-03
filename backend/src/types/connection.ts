export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right';

export interface Connection {
  id: string;
  sourceType: 'pod' | 'trigger';
  sourcePodId: string;
  sourceTriggerId: string | null;
  sourceAnchor: AnchorPosition;
  targetPodId: string;
  targetAnchor: AnchorPosition;
  autoTrigger: boolean;
  createdAt: Date;
}
