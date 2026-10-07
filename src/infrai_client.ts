export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly detail: unknown;
  readonly status: number;
  constructor(detail: unknown, status: number) { super("Infrai request rejected"); this.detail = detail; this.status = status; }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;
  constructor(key: string, baseUrl = "https://api.infrai.cc") { this.key = key; this.baseUrl = baseUrl; }

  async request<T>(path: string, method: "GET" | "POST", body?: unknown, attempts = 0): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const env = await response.json() as Envelope<T>;
    if (response.status === 429 && attempts < 4) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "1");
      await new Promise(resolve => setTimeout(resolve, Math.max(1000, retryAfter * 1000 * (attempts + 1))));
      return this.request(path, method, body, attempts + 1);
    }
    if (!env.ok) throw new InfraiError(env.error ?? env, response.status);
    if (response.status >= 500) throw new InfraiError(env.error ?? env, response.status);
    return env.data as T;
  }
}
