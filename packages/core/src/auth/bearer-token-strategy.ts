
import type { AuthResult, AuthStrategy } from "./types.js";

export type BearerTokenVerifier = (
  token: string,
) => AuthResult | null | Promise<AuthResult | null>;

export class BearerTokenStrategy implements AuthStrategy {
  readonly name = "bearer-token";

  constructor(
    private readonly verifyToken: BearerTokenVerifier,
  ) {}

  async authenticate(
    credentials: unknown,
  ): Promise<AuthResult | null> {
    if (typeof credentials !== "string" || credentials.length === 0) {
      return null;
    }

    return this.verifyToken(credentials);
  }
}
