export class Cache<T> {
  private items = new Map<string, { value: T; expiresAt: number }>();
  private ttlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(ttlMs = 10 * 60 * 1000) {
    this.ttlMs = ttlMs;
    // Run cleanup every minute to evict expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    // Don't block process exit
    if (typeof this.cleanupInterval.unref === "function") {
      this.cleanupInterval.unref();
    }
  }

  get(key: string): T | undefined {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.items.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: T): void {
    this.items.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.items) {
      if (now > item.expiresAt) {
        this.items.delete(key);
      }
    }
  }
}
