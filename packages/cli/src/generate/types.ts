export interface GeneratorContext {
  /**
   * Absolute path to the project root.
   */
  cwd: string;

  /**
   * Normalized resource name.
   *
   * Example:
   *   "user-profile"
   */
  name: string;

  /**
   * Original name supplied by the user.
   *
   * Example:
   *   "UserProfile"
   */
  originalName: string;

  /**
   * Whether files should actually be written.
   *
   * false when --dry-run is used.
   */
  write: boolean;

  /**
   * Whether existing files may be overwritten.
   */
  force: boolean;
}

export interface GeneratedFile {
  /**
   * Absolute path of the generated file.
   */
  path: string;

  /**
   * Whether the file already existed before generation.
   */
  existed: boolean;

  /**
   * Whether the file was actually written.
   */
  written: boolean;
}

export interface GenerateResult {
  /**
   * Whether generation completed successfully.
   */
  success: boolean;

  /**
   * Generator name.
   *
   * Example:
   *   "controller"
   */
  generator: string;

  /**
   * Normalized resource name.
   */
  name: string;

  /**
   * Files considered by the generator.
   */
  files: GeneratedFile[];

  /**
   * Optional human-readable message.
   */
  message?: string;
}

export interface Generator {
  /**
   * Unique generator name used by the CLI.
   */
  readonly name: string;

  /**
   * Human-readable description.
   */
  readonly description: string;
}