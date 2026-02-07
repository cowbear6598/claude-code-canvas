export type AnchorPosition = 'top' | 'bottom' | 'left' | 'right';

export type TriggerMode = 'auto' | 'ai-decide' | 'direct';

export type DecideStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'error';

export type ConnectionStatus = 'idle' | 'active' | 'queued' | 'waiting' | 'ai-deciding' | 'ai-approved' | 'ai-rejected' | 'ai-error';

export interface Connection {
  id: string;
  sourcePodId: string;
  sourceAnchor: AnchorPosition;
  targetPodId: string;
  targetAnchor: AnchorPosition;
  triggerMode: TriggerMode;
  decideStatus: DecideStatus;
  decideReason: string | null;
  connectionStatus: ConnectionStatus;
  createdAt: Date;
}
