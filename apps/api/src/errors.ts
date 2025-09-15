export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details: any;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    details: any = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

export const errorHandler = (error: Error, request: any, reply: any) => {
  if (error instanceof AppError && error.isOperational) {
    reply.status(error.statusCode).send({
      status: 'error',
      message: error.message,
      details: error.details,
    });
  } else {
    // Log non-operational errors
    console.error(error);
    reply.status(500).send({
      status: 'error',
      message: 'An internal server error occurred',
    });
  }
};
