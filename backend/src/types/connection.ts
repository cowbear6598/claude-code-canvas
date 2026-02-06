export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right';

export type TriggerMode = 'auto' | 'ai-decide';

export type DecideStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'error';

export interface Connection {
  id: string;
  sourcePodId: string;
  sourceAnchor: AnchorPosition;
  targetPodId: string;
  targetAnchor: AnchorPosition;
  triggerMode: TriggerMode;
  decideStatus: DecideStatus;
  decideReason: string | null;
  createdAt: Date;
}
