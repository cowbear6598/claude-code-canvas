// Selection Types

// 可選取的元素類型
export interface SelectableElement {
  type: 'pod' | 'outputStyleNote' | 'skillNote' | 'repositoryNote' | 'subAgentNote' | 'commandNote'
  id: string
}

// 框選框座標
export interface SelectionBox {
  startX: number  // 框選起點 X（畫布座標）
  startY: number  // 框選起點 Y（畫布座標）
  endX: number    // 框選終點 X（畫布座標）
  endY: number    // 框選終點 Y（畫布座標）
}

// 選取狀態
export interface SelectionState {
  isSelecting: boolean           // 是否正在框選中
  box: SelectionBox | null       // 框選框座標
  selectedElements: SelectableElement[]  // 被選中的元素
}
