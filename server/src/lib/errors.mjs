export class HttpError extends Error {
  constructor(status, message, code = "request_error", details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
