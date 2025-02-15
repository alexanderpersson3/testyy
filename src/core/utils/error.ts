export class AppError extends Error {
  status: string;
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, status: string | number) {
    super(message);
    this.status = status.toString();
    this.statusCode = typeof status === 'string' ? parseInt(status, 10) : status;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err: Error | AppError) => {
  if (err instanceof AppError && err.isOperational) {
    return {
      status: err.status,
      message: err.message,
    };
  }

  // Programming or other unknown errors: don't leak error details
  console.error('ERROR 💥', err);
  return {
    status: '500',
    message: 'Something went very wrong!',
  };
};
