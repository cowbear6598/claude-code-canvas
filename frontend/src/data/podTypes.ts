import { Code, MessageCircle, Palette, Brain, Bot } from 'lucide-vue-next'
import type { PodTypeConfig } from '@/types'

export const podTypes: PodTypeConfig[] = [
  {
    type: 'Code Assistant',
    icon: Code,
    color: 'blue',
  },
  {
    type: 'Chat Companion',
    icon: MessageCircle,
    color: 'green',
  },
  {
    type: 'Creative Writer',
    icon: Palette,
    color: 'coral',
  },
  {
    type: 'Data Analyst',
    icon: Brain,
    color: 'pink',
  },
  {
    type: 'General AI',
    icon: Bot,
    color: 'yellow',
  },
]
