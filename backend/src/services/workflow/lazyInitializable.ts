export abstract class LazyInitializable<TDeps> {
  protected deps?: TDeps;

  init(deps: TDeps): void {
    this.deps = deps;
  }

  protected ensureInitialized(): asserts this is this & { deps: TDeps } {
    if (!this.deps) {
      throw new Error(`${this.constructor.name} 尚未初始化，請先呼叫 init()`);
    }
  }
}
