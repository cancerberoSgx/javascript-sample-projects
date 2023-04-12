export class AuthenticationError extends Error {
  constructor(...args) {
    super(...args);
    this.name = AuthenticationErrorName;
  }
}
export const AuthenticationErrorName = 'AuthenticationError'

export class NotFoundError extends Error {
  constructor(...args) {
    super(...args);
    this.name = NotFoundErrorName;
  }
}
export const NotFoundErrorName = 'NotFoundError'

export class InvalidParameterError extends Error {
  constructor(...args) {
    super(...args);
    this.name = InvalidParameterErrorName;
  }
}
export const InvalidParameterErrorName = 'InvalidParameterError'

