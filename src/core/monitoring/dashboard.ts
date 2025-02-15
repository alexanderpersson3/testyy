import express, { Request, Response } from 'express';
import { PerformanceService } from './performance.service';
import { Logger } from '../logger/logger';

export class PerformanceDashboard {
  private readonly performanceService: PerformanceService;
  private readonly logger: Logger;
  private readonly router = express.Router();

  constructor() {
    this.performanceService = PerformanceService.getInstance();
    this.logger = new Logger('PerformanceDashboard');
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Dashboard home
    this.router.get('/', (req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Performance Dashboard</title>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .dashboard { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
              .card { 
                border: 1px solid #ddd; 
                border-radius: 4px; 
                padding: 15px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .metric { font-size: 24px; font-weight: bold; }
              .chart { height: 300px; }
            </style>
          </head>
          <body>
            <h1>Performance Dashboard</h1>
            <div class="dashboard">
              <div class="card">
                <h2>Request Latency</h2>
                <div id="latencyChart" class="chart"></div>
              </div>
              <div class="card">
                <h2>Error Rate</h2>
                <div id="errorChart" class="chart"></div>
              </div>
              <div class="card">
                <h2>Database Operations</h2>
                <div id="dbChart" class="chart"></div>
              </div>
              <div class="card">
                <h2>Response Size</h2>
                <div id="sizeChart" class="chart"></div>
              </div>
            </div>
            <script>
              function fetchMetrics() {
                fetch('/monitoring/api/metrics')
                  .then(res => res.json())
                  .then(data => {
                    updateCharts(data);
                  });
              }

              function updateCharts(data) {
                // Latency Chart
                const latencyData = {
                  x: data.latency.timestamps,
                  y: data.latency.values,
                  type: 'scatter',
                  name: 'Request Latency (ms)'
                };
                Plotly.newPlot('latencyChart', [latencyData]);

                // Error Rate Chart
                const errorData = {
                  labels: data.errors.paths,
                  datasets: [{
                    data: data.errors.counts,
                    backgroundColor: [
                      '#FF6384',
                      '#36A2EB',
                      '#FFCE56',
                      '#4BC0C0'
                    ]
                  }]
                };
                new Chart('errorChart', {
                  type: 'pie',
                  data: errorData
                });

                // Database Operations Chart
                const dbData = {
                  x: data.database.timestamps,
                  y: data.database.counts,
                  type: 'bar',
                  name: 'DB Operations'
                };
                Plotly.newPlot('dbChart', [dbData]);

                // Response Size Chart
                const sizeData = {
                  x: data.size.timestamps,
                  y: data.size.values,
                  type: 'scatter',
                  name: 'Response Size (bytes)'
                };
                Plotly.newPlot('sizeChart', [sizeData]);
              }

              // Update every 30 seconds
              fetchMetrics();
              setInterval(fetchMetrics, 30000);
            </script>
          </body>
        </html>
      `);
    });

    // API endpoints
    this.router.get('/api/metrics', async (req: Request, res: Response) => {
      try {
        const endTime = Date.now();
        const startTime = endTime - 3600000; // Last hour

        const latencyMetrics = this.performanceService.getMetrics({
          name: 'http_request_duration',
          startTime,
          endTime
        });

        const errorMetrics = this.performanceService.getMetrics({
          name: 'errors',
          startTime,
          endTime
        });

        const dbMetrics = this.performanceService.getMetrics({
          name: 'database_operations',
          startTime,
          endTime
        });

        const sizeMetrics = this.performanceService.getMetrics({
          name: 'http_response_size',
          startTime,
          endTime
        });

        // Process metrics for visualization
        const response = {
          latency: {
            timestamps: latencyMetrics.map(m => m.timestamp),
            values: latencyMetrics.map(m => m.value)
          },
          errors: {
            paths: Array.from(new Set(errorMetrics.map(m => m.tags.path))),
            counts: errorMetrics.reduce((acc: Record<string, number>, m) => {
              acc[m.tags.path] = (acc[m.tags.path] || 0) + 1;
              return acc;
            }, {})
          },
          database: {
            timestamps: dbMetrics.map(m => m.timestamp),
            counts: dbMetrics.map(m => m.value)
          },
          size: {
            timestamps: sizeMetrics.map(m => m.timestamp),
            values: sizeMetrics.map(m => m.value)
          }
        };

        res.json(response);
      } catch (err) {
        this.logger.error('Failed to fetch metrics', {
          error: err instanceof Error ? err : String(err)
        });
        res.status(500).json({ error: 'Failed to fetch metrics' });
      }
    });

    // Trace viewer
    this.router.get('/traces/:traceId', (req: Request, res: Response) => {
      const trace = this.performanceService.getTrace(req.params.traceId);
      if (!trace) {
        return res.status(404).json({ error: 'Trace not found' });
      }
      res.json(trace);
    });

    // Recent traces
    this.router.get('/api/traces', (req: Request, res: Response) => {
      const traces = this.performanceService.getTraces({
        startTime: Date.now() - 3600000 // Last hour
      });
      res.json(traces);
    });
  }

  getRouter() {
    return this.router;
  }
} 