const PREDEFINED_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
];

class CursorColorManager {
  private canvasColors: Map<string, Map<string, string>> = new Map();
  private canvasAvailable: Map<string, Set<string>> = new Map();

  private ensureCanvas(canvasId: string): void {
    if (!this.canvasColors.has(canvasId)) {
      this.canvasColors.set(canvasId, new Map());
    }
    if (!this.canvasAvailable.has(canvasId)) {
      this.canvasAvailable.set(canvasId, new Set(PREDEFINED_COLORS));
    }
  }

  /** 顏色用盡時以 connectionId hash 產生 fallback 顏色 */
  private hashColor(connectionId: string): string {
    let hash = 0;
    for (let i = 0; i < connectionId.length; i++) {
      hash = (hash << 5) - hash + connectionId.charCodeAt(i);
      hash |= 0;
    }
    const r = (hash & 0xff0000) >> 16;
    const g = (hash & 0x00ff00) >> 8;
    const b = hash & 0x0000ff;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  assignColor(canvasId: string, connectionId: string): string {
    this.ensureCanvas(canvasId);

    const colors = this.canvasColors.get(canvasId)!;
    const available = this.canvasAvailable.get(canvasId)!;

    if (colors.has(connectionId)) {
      return colors.get(connectionId)!;
    }

    if (available.size === 0) {
      const fallback = this.hashColor(connectionId);
      colors.set(connectionId, fallback);
      return fallback;
    }

    const color = available.values().next().value as string;
    available.delete(color);
    colors.set(connectionId, color);
    return color;
  }

  releaseColor(canvasId: string, connectionId: string): void {
    const colors = this.canvasColors.get(canvasId);
    if (!colors) return;

    const color = colors.get(connectionId);
    if (!color) return;

    colors.delete(connectionId);

    if (PREDEFINED_COLORS.includes(color)) {
      this.canvasAvailable.get(canvasId)?.add(color);
    }

    if (colors.size === 0) {
      this.removeCanvas(canvasId);
    }
  }

  getColor(canvasId: string, connectionId: string): string | undefined {
    return this.canvasColors.get(canvasId)?.get(connectionId);
  }

  removeCanvas(canvasId: string): void {
    this.canvasColors.delete(canvasId);
    this.canvasAvailable.delete(canvasId);
  }
}

export const cursorColorManager = new CursorColorManager();
export { CursorColorManager };
