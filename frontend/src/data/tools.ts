import { Search, FileText, Database, Lightbulb, Image, Terminal } from 'lucide-vue-next'
import type { Tool } from '@/types'

export const tools: Tool[] = [
  {
    icon: Search,
    label: 'Search',
    color: 'bg-doodle-blue',
  },
  {
    icon: FileText,
    label: 'Docs',
    color: 'bg-doodle-green',
  },
  {
    icon: Database,
    label: 'Data',
    color: 'bg-doodle-pink',
  },
  {
    icon: Lightbulb,
    label: 'Ideas',
    color: 'bg-doodle-yellow',
  },
  {
    icon: Image,
    label: 'Images',
    color: 'bg-doodle-coral',
  },
  {
    icon: Terminal,
    label: 'Code',
    color: 'bg-doodle-blue',
  },
]
