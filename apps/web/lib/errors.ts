/** Signed in, but not an approved police officer / not an admin. */
export class NotAllowedError extends Error {
  constructor(message = 'not_allowed') {
    super(message);
    this.name = 'NotAllowedError';
  }
}

/** The one-time code was wrong or has expired. */
export class OtpError extends Error {
  constructor(message = 'bad_code') {
    super(message);
    this.name = 'OtpError';
  }
}
