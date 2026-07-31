type ScanHandler = (code: string) => void;

class ScanBus {
  private handler: ScanHandler | null = null;

  register(fn: ScanHandler): () => void {
    this.handler = fn;
    return () => this.unregister(fn);
  }
  unregister(fn: ScanHandler) {
    if (this.handler === fn) this.handler = null;
  }
  emit(code: string) {
    this.handler?.(code);
  }
}

export const scanBus = new ScanBus();
