export class HttpError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}
/** Thrown by repositories for business-rule failures (always safe to show as a code). */
export class RepoError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
