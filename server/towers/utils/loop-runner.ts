export class LoopRunner {
  private timeoutId: NodeJS.Timeout | null = null;
  private running: boolean = false;

  public start(fn: () => Promise<void>, getDelayMs: () => number): void {
    if (this.running) return;
    this.running = true;

    const step = async (): Promise<void> => {
      if (!this.running) return;

      try {
        await fn();
      } finally {
        if (!this.running) return;
        this.timeoutId = setTimeout(step, getDelayMs());
      }
    };

    void step();
  }

  public stop(): void {
    this.running = false;
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }
}
