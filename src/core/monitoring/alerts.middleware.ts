import { Request, Response, NextFunction } from 'express';
import { AlertsService } from './alerts.service';
import { Logger } from '../logger/logger';

export class AlertsMiddleware {
  private readonly alertsService: AlertsService;
  private readonly logger: Logger;
  private readonly webhooks: Map<string, string> = new Map();
  private readonly emailConfig: {
    enabled: boolean;
    recipients: string[];
  } = {
    enabled: false,
    recipients: []
  };

  constructor() {
    this.alertsService = AlertsService.getInstance();
    this.logger = new Logger('AlertsMiddleware');

    // Setup alert handlers
    this.setupAlertHandlers();
  }

  private setupAlertHandlers(): void {
    this.alertsService.on('alert', async (alert) => {
      try {
        // Log alert
        this.logger.warn('Alert triggered', alert);

        // Send notifications based on severity
        if (alert.severity === 'critical' || alert.severity === 'error') {
          await this.sendNotifications(alert);
        }
      } catch (err) {
        this.logger.error('Failed to process alert', {
          error: err instanceof Error ? err : String(err),
          alertId: alert.id
        });
      }
    });
  }

  configureWebhook(name: string, url: string): void {
    this.webhooks.set(name, url);
    this.logger.info('Webhook configured', { name, url });
  }

  removeWebhook(name: string): void {
    this.webhooks.delete(name);
    this.logger.info('Webhook removed', { name });
  }

  configureEmail(recipients: string[]): void {
    this.emailConfig.enabled = true;
    this.emailConfig.recipients = recipients;
    this.logger.info('Email notifications configured', { recipients });
  }

  private async sendNotifications(alert: any): Promise<void> {
    const promises: Promise<any>[] = [];

    // Send webhook notifications
    for (const [name, url] of this.webhooks.entries()) {
      promises.push(
        this.sendWebhook(url, alert).catch(err => {
          this.logger.error('Failed to send webhook', {
            error: err instanceof Error ? err : String(err),
            webhook: name,
            alertId: alert.id
          });
        })
      );
    }

    // Send email notifications
    if (this.emailConfig.enabled) {
      promises.push(
        this.sendEmail(alert).catch(err => {
          this.logger.error('Failed to send email', {
            error: err instanceof Error ? err : String(err),
            alertId: alert.id
          });
        })
      );
    }

    await Promise.all(promises);
  }

  private async sendWebhook(url: string, alert: any): Promise<void> {
    const payload = {
      timestamp: new Date().toISOString(),
      alert: {
        ...alert,
        formattedMessage: this.formatAlertMessage(alert)
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  private async sendEmail(alert: any): Promise<void> {
    // Here you would implement your email sending logic
    // For example, using nodemailer or a third-party service
    this.logger.info('Sending email notification', {
      recipients: this.emailConfig.recipients,
      alertId: alert.id
    });
  }

  private formatAlertMessage(alert: any): string {
    const timestamp = new Date(alert.timestamp).toISOString();
    const value = typeof alert.value === 'number' 
      ? alert.value.toFixed(2)
      : alert.value;

    return `
      [${alert.severity.toUpperCase()}] ${alert.name}
      Time: ${timestamp}
      Metric: ${alert.metric}
      Value: ${value}
      Threshold: ${alert.threshold}
      Message: ${alert.message}
      ${alert.tags ? `Tags: ${JSON.stringify(alert.tags)}` : ''}
    `.trim().replace(/^\s+/gm, '');
  }

  // Middleware for handling alert-related routes
  handle() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Add alert-related data to the request
      req.alerts = {
        service: this.alertsService,
        getActive: () => this.alertsService.getAlerts({
          startTime: Date.now() - 3600000 // Last hour
        }),
        getRules: () => this.alertsService.getRules()
      };

      next();
    };
  }
} 