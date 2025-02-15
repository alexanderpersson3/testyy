import type { Application, Request, Response, NextFunction } from '../types/express.js';
import * as Sentry from '@sentry/node';
import logger from './logger.js';

const setupSentry = (app: Application) => {
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN || '',
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
      ],
      tracesSampleRate: 1.0,
      enabled: !!process.env.SENTRY_DSN,
      beforeSend(
        event: Sentry.Event,
        hint?: Sentry.EventHint
      ): Sentry.Event | null {
        // Remove sensitive headers
        const sensitiveHeaders = ['authorization', 'cookie', 'x-auth-token'];
        if (event.request?.headers) {
          sensitiveHeaders.forEach(header => {
            if (event.request?.headers) {
              delete event.request.headers[header];
            }
          });
        }
        return event;
      },
    });

    // RequestHandler creates a separate execution context using domains
    app.use(Sentry.Handlers.requestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
  } catch (error) {
    logger.error('Error in Sentry setup:', error);
  }
};

const setupErrorHandling = (app: Application) => {
  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());

  // Optional fallthrough error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    });
  });
};

const setupProcessHandlers = () => {
  process.on('unhandledRejection', (reason: any, promise: any) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', error => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

const instrument = (app: Application): void => {
  try {
    setupSentry(app);
    setupErrorHandling(app);
    setupProcessHandlers();
  } catch (error) {
    logger.error('Failed to initialize instrumentation:', error);
  }
};

export default instrument;
