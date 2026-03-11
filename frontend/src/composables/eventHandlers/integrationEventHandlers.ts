import { WebSocketResponseEvents } from '@/services/websocket'
import { usePodStore } from '@/stores/pod/podStore'
import { useIntegrationStore } from '@/stores/integrationStore'
import type { Pod } from '@/types'
import type { IntegrationConnectionStatus } from '@/types/integration'
import { createUnifiedHandler } from './sharedHandlerUtils'
import type { BasePayload } from './sharedHandlerUtils'

const handleIntegrationAppCreated = createUnifiedHandler<BasePayload & { app?: Record<string, unknown>; provider?: string }>(
  (payload) => {
    if (payload.app && payload.provider) {
      useIntegrationStore().addAppFromEvent(payload.provider, payload.app)
    }
  },
  { skipCanvasCheck: true }
)

const handleIntegrationAppDeleted = createUnifiedHandler<BasePayload & { appId?: string; provider?: string }>(
  (payload) => {
    if (payload.appId && payload.provider) {
      useIntegrationStore().removeAppFromEvent(payload.provider, payload.appId)
    }
  },
  { skipCanvasCheck: true }
)

const handlePodIntegrationBound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

const handlePodIntegrationUnbound = createUnifiedHandler<BasePayload & { pod?: Pod; canvasId: string }>(
  (payload) => {
    if (payload.pod) {
      usePodStore().updatePod(payload.pod)
    }
  }
)

export const handleIntegrationConnectionStatusChanged = (payload: { provider: string; appId: string; connectionStatus: IntegrationConnectionStatus; resources?: Array<{ id: string; name: string }> }): void => {
  useIntegrationStore().updateAppStatus(payload.provider, payload.appId, payload.connectionStatus, payload.resources)
}

export function getIntegrationEventListeners(): Array<{ event: string; handler: (payload: unknown) => void }> {
  return [
    { event: WebSocketResponseEvents.INTEGRATION_APP_CREATED, handler: handleIntegrationAppCreated as (payload: unknown) => void },
    { event: WebSocketResponseEvents.INTEGRATION_APP_DELETED, handler: handleIntegrationAppDeleted as (payload: unknown) => void },
    { event: WebSocketResponseEvents.POD_INTEGRATION_BOUND, handler: handlePodIntegrationBound as (payload: unknown) => void },
    { event: WebSocketResponseEvents.POD_INTEGRATION_UNBOUND, handler: handlePodIntegrationUnbound as (payload: unknown) => void },
  ]
}
