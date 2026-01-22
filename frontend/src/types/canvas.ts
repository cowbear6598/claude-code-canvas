// 座標位置
export interface Position {
  x: number
  y: number
}

// 類型選單狀態
export interface TypeMenuState {
  visible: boolean
  position: Position | null
}

// 視口狀態
export interface ViewportState {
  offset: Position
  zoom: number
}
