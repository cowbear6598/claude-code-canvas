import { defineStore } from 'pinia'
import type { Trigger, TriggerType, TimeTriggerConfig } from '@/types/trigger'
import {
  createWebSocketRequest,
  WebSocketRequestEvents,
  WebSocketResponseEvents
} from '@/services/websocket'
import type {
  TriggerCreatedPayload,
  TriggerListResultPayload,
  TriggerUpdatedPayload,
  TriggerDeletedPayload,
  TriggerFiredPayload,
  TriggerCreatePayload,
  TriggerListPayload,
  TriggerUpdatePayload,
  TriggerDeletePayload
} from '@/types/websocket'
import { useConnectionStore } from './connectionStore'
import { useCanvasStore } from './canvasStore'

interface TriggerState {
  triggers: Trigger[]
  editingTriggerId: string | null
  triggeringIds: Set<string>
}

export const useTriggerStore = defineStore('trigger', {
  state: (): TriggerState => ({
    triggers: [],
    editingTriggerId: null,
    triggeringIds: new Set<string>(),
  }),

  getters: {
    triggerCount: (state): number => state.triggers.length,

    getTriggerById: (state) => (triggerId: string): Trigger | undefined => {
      return state.triggers.find(t => t.id === triggerId)
    },

    editingTrigger: (state): Trigger | null => {
      if (!state.editingTriggerId) return null
      return state.triggers.find(t => t.id === state.editingTriggerId) || null
    },

    isTriggerFiring: (state) => (triggerId: string): boolean => {
      return state.triggeringIds.has(triggerId)
    },
  },

  actions: {
    async loadTriggersFromBackend(): Promise<void> {
      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        console.warn('[TriggerStore] Cannot load triggers: no active canvas')
        return
      }

      const response = await createWebSocketRequest<TriggerListPayload, TriggerListResultPayload>({
        requestEvent: WebSocketRequestEvents.TRIGGER_LIST,
        responseEvent: WebSocketResponseEvents.TRIGGER_LIST_RESULT,
        payload: {
          canvasId: canvasStore.activeCanvasId
        }
      })

      if (response.triggers) {
        this.triggers = response.triggers.map(trigger => ({
          ...trigger,
        }))
      }
    },

    async createTrigger(payload: {
      name: string
      type: TriggerType
      config: TimeTriggerConfig
      x: number
      y: number
      rotation: number
    }): Promise<Trigger | null> {
      const canvasStore = useCanvasStore()

      if (!canvasStore.activeCanvasId) {
        throw new Error('Cannot create trigger: no active canvas')
      }

      const response = await createWebSocketRequest<TriggerCreatePayload, TriggerCreatedPayload>({
        requestEvent: WebSocketRequestEvents.TRIGGER_CREATE,
        responseEvent: WebSocketResponseEvents.TRIGGER_CREATED,
        payload: {
          canvasId: canvasStore.activeCanvasId,
          name: payload.name,
          type: payload.type,
          config: payload.config,
          x: payload.x,
          y: payload.y,
          rotation: payload.rotation,
        }
      })

      if (!response.trigger) {
        return null
      }

      const trigger: Trigger = {
        ...response.trigger,
      }

      this.triggers.push(trigger)

      return trigger
    },

    async updateTrigger(
      triggerId: string,
      payload: {
        name?: string
        config?: TimeTriggerConfig
        x?: number
        y?: number
        rotation?: number
        enabled?: boolean
      }
    ): Promise<void> {
      const canvasStore = useCanvasStore()

      const response = await createWebSocketRequest<TriggerUpdatePayload, TriggerUpdatedPayload>({
        requestEvent: WebSocketRequestEvents.TRIGGER_UPDATE,
        responseEvent: WebSocketResponseEvents.TRIGGER_UPDATED,
        payload: {
          canvasId: canvasStore.activeCanvasId!,
          triggerId,
          ...payload,
        }
      })

      if (response.trigger) {
        const index = this.triggers.findIndex(t => t.id === triggerId)
        if (index !== -1) {
          this.triggers[index] = {
            ...response.trigger,
          }
        }
      }
    },

    async deleteTrigger(triggerId: string): Promise<void> {
      const canvasStore = useCanvasStore()

      const response = await createWebSocketRequest<TriggerDeletePayload, TriggerDeletedPayload>({
        requestEvent: WebSocketRequestEvents.TRIGGER_DELETE,
        responseEvent: WebSocketResponseEvents.TRIGGER_DELETED,
        payload: {
          canvasId: canvasStore.activeCanvasId!,
          triggerId,
        }
      })

      if (response.success && response.triggerId) {
        this.triggers = this.triggers.filter(t => t.id !== triggerId)

        if (response.deletedConnectionIds && response.deletedConnectionIds.length > 0) {
          const connectionStore = useConnectionStore()
          connectionStore.deleteConnectionsByIds(response.deletedConnectionIds)
        }
      }
    },

    moveTrigger(triggerId: string, x: number, y: number): void {
      const trigger = this.triggers.find(t => t.id === triggerId)
      if (trigger) {
        trigger.x = x
        trigger.y = y
      }
    },

    setEditingTrigger(triggerId: string | null): void {
      this.editingTriggerId = triggerId
    },

    async toggleTriggerEnabled(triggerId: string): Promise<void> {
      const trigger = this.triggers.find(t => t.id === triggerId)
      if (!trigger) return

      await this.updateTrigger(triggerId, {
        enabled: !trigger.enabled
      })
    },

    fireTriggerAnimation(triggerId: string): void {
      this.triggeringIds.add(triggerId)
      setTimeout(() => {
        this.triggeringIds.delete(triggerId)
      }, 1500)
    },

    handleTriggerFired(payload: TriggerFiredPayload): void {
      this.fireTriggerAnimation(payload.triggerId)

      const trigger = this.triggers.find(t => t.id === payload.triggerId)
      if (trigger) {
        trigger.lastTriggeredAt = payload.timestamp
      }
    },

    addTriggerFromBroadcast(trigger: Trigger): void {
      const exists = this.triggers.some(t => t.id === trigger.id)
      if (!exists) {
        this.triggers.push(trigger)
      }
    },

    updateTriggerFromBroadcast(trigger: Trigger): void {
      const index = this.triggers.findIndex(t => t.id === trigger.id)
      if (index !== -1) {
        this.triggers.splice(index, 1, trigger)
      }
    },

    removeTriggerFromBroadcast(triggerId: string, deletedConnectionIds?: string[]): void {
      this.triggers = this.triggers.filter(t => t.id !== triggerId)

      if (deletedConnectionIds && deletedConnectionIds.length > 0) {
        const connectionStore = useConnectionStore()
        connectionStore.deleteConnectionsByIds(deletedConnectionIds)
      }
    },
  },
})
