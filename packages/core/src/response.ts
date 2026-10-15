export interface ResponseResult {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export class AKSResponse {
  private statusCode = 200;
  private headers: Record<string, string> = {};

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  header(name: string, value: string): this {
    this.headers[name] = value;
    return this;
  }

  json(body: unknown): ResponseResult {
    return {
      statusCode: this.statusCode,
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body,
    };
  }

  text(body: string): ResponseResult {
    return {
      statusCode: this.statusCode,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...this.headers,
      },
      body,
    };
  }
}