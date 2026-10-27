
export interface AuthUser {
  readonly id: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface AuthResult {
  readonly user: AuthUser;
}

export interface AuthStrategy {
  readonly name: string;

  authenticate(
    credentials: unknown,
  ): Promise<AuthResult | null>;
}
