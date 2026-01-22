import type { Pod } from '@/types'

export const initialPods: Pod[] = [
  {
    id: '1',
    name: 'Code Helper',
    type: 'Code Assistant',
    x: 100,
    y: 150,
    color: 'blue',
    output: ['> Ready to help with code', '> Type your question...'],
    rotation: -1.5,
  },
  {
    id: '2',
    name: 'Creative Mind',
    type: 'Creative Writer',
    x: 400,
    y: 200,
    color: 'coral',
    output: ['> Creative writing mode', '> Let\'s create something!'],
    rotation: 1,
  },
  {
    id: '3',
    name: 'Data Expert',
    type: 'Data Analyst',
    x: 700,
    y: 180,
    color: 'pink',
    output: ['> Data analysis ready', '> Awaiting your data...'],
    rotation: -0.5,
  },
]
