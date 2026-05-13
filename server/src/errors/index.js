class AppError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

class AuthError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class ValidationError extends AppError {
  constructor(message, detail) {
    super(message, 400, detail);
  }
}

module.exports = { AppError, NotFoundError, AuthError, ValidationError };
