const PREDEFINED_COLORS = [
  '#E05252',  // 深紅
  '#2BA89E',  // 深青綠
  '#2E8CB5',  // 深藍
  '#D16B3A',  // 深橘
  '#C24B8A',  // 深桃紅
  '#7B4BC2',  // 深紫
  '#3A8F5C',  // 深綠
  '#B5892E',  // 深金
  '#8C3AB5',  // 紫羅蘭
  '#4A7DC2',  // 鈷藍
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

  private toHexChannel(n: number): string {
    return n.toString(16).padStart(2, '0');
  }

  /** 修正 RGB 加總超出上界 */
  private fixOverflow(r: number, g: number, b: number, overflow: number): [number, number, number] {
    if (r >= g && r >= b) return [Math.max(0, r - overflow), g, b];
    if (g >= r && g >= b) return [r, Math.max(0, g - overflow), b];
    return [r, g, Math.max(0, b - overflow)];
  }

  /** 修正 RGB 加總低於下界 */
  private fixDeficit(r: number, g: number, b: number, deficit: number): [number, number, number] {
    if (r <= g && r <= b) return [Math.min(255, r + deficit), g, b];
    if (g <= r && g <= b) return [r, Math.min(255, g + deficit), b];
    return [r, g, Math.min(255, b + deficit)];
  }

  private clampColor(hex: string): string {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    const sum = r + g + b;

    if (sum === 0) return '#555555';
    if (sum >= 150 && sum <= 450) return hex;

    const factor = sum > 450 ? 450 / sum : 150 / sum;
    const round = sum > 450 ? Math.floor : Math.ceil;
    let nr = Math.min(255, round(r * factor));
    let ng = Math.min(255, round(g * factor));
    let nb = Math.min(255, round(b * factor));

    // 浮點精度安全檢查：Math.floor/ceil 仍可能因浮點誤差導致總和超出範圍
    const newSum = nr + ng + nb;
    if (newSum > 450) {
      [nr, ng, nb] = this.fixOverflow(nr, ng, nb, newSum - 450);
    } else if (newSum < 150) {
      [nr, ng, nb] = this.fixDeficit(nr, ng, nb, 150 - newSum);
    }

    return `#${this.toHexChannel(nr)}${this.toHexChannel(ng)}${this.toHexChannel(nb)}`;
  }

  /** 顏色用盡時以 connectionId hash 產生 fallback 顏色 */
  private hashColor(connectionId: string): string {
    let hash = 0;
    for (let i = 0; i < connectionId.length; i++) {
      hash = (hash << 5) - hash + connectionId.charCodeAt(i);
      hash |= 0;
    }
    // hash 可為負數，但 bitwise AND 保證 r/g/b 皆在 [0, 255]
    const r = (hash & 0xff0000) >> 16;
    const g = (hash & 0x00ff00) >> 8;
    const b = hash & 0x0000ff;
    const hex = `#${this.toHexChannel(r)}${this.toHexChannel(g)}${this.toHexChannel(b)}`;
    return this.clampColor(hex);
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
