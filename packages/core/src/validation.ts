export type ValidationSource =
  | "body"
  | "query"
  | "params";

export interface ValidationIssue {
  source: ValidationSource;
  path: string;
  message: string;
  code?: string;
}

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      issues: ValidationIssue[];
    };

export type Validator<TInput, TOutput> = (
  input: TInput,
) => ValidationResult<TOutput>;

export interface ValidatedData<
  TBody = unknown,
  TQuery = Record<string, string>,
  TParams = Record<string, string>,
> {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
}