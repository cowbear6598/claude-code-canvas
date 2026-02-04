export interface BaseNote {
  id: string
  name: string
  x: number
  y: number
  boundToPodId: string | null
  originalPosition: { x: number; y: number } | null
}
