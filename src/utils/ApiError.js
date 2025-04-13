// Tum ek custom error class bana rahi ho jiska naam hai ApiError.
// Ye class Error class ko extend kar rahi hai.
class ApiError extends Error {
  constructor(statusCode, message = "something went wrong", errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.success = false;
    this.errors = errors;
  }
}

export {ApiError}