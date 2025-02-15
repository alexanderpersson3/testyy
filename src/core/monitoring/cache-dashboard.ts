import express, { Request, Response } from 'express';
import { CacheService } from '../cache/cache.service';

export class CacheDashboard {
  private readonly router = express.Router();
  private readonly cacheService: CacheService;

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Dashboard home
    this.router.get('/', (req: Request, res: Response) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cache Dashboard</title>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
              .dashboard { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; }
              .card { 
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .metric { 
                font-size: 24px; 
                font-weight: bold;
                color: #2c3e50;
              }
              .chart { height: 300px; }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
              }
              .header h1 { margin: 0; color: #2c3e50; }
              .status {
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
              }
              .status.healthy { background: #27ae60; color: white; }
              .status.warning { background: #f1c40f; color: white; }
              .status.error { background: #e74c3c; color: white; }
              .alerts {
                grid-column: 1 / -1;
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .alert {
                padding: 10px;
                margin-bottom: 10px;
                border-radius: 4px;
                border-left: 4px solid;
              }
              .alert.error { background: #fde8e8; border-color: #e74c3c; }
              .alert.warning { background: #fef6e7; border-color: #f1c40f; }
              .refresh {
                background: #3498db;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
              }
              .refresh:hover { background: #2980b9; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Cache Dashboard</h1>
              <div>
                <span id="status" class="status">Checking status...</span>
                <button class="refresh" onclick="refreshData()">Refresh</button>
              </div>
            </div>
            <div class="dashboard">
              <div class="card">
                <h2>Hit Rate</h2>
                <div id="hitRateChart" class="chart"></div>
              </div>
              <div class="card">
                <h2>Memory Usage</h2>
                <div id="memoryChart" class="chart"></div>
              </div>
              <div class="card">
                <h2>Latency</h2>
                <div id="latencyChart" class="chart"></div>
              </div>
              <div class="card">
                <h2>Error Rate</h2>
                <div id="errorChart" class="chart"></div>
              </div>
              <div class="card">
                <h2>Compression</h2>
                <div id="compressionChart" class="chart"></div>
              </div>
              <div class="card">
                <h2>Operations</h2>
                <div id="operationsChart" class="chart"></div>
              </div>
              <div class="alerts">
                <h2>Active Alerts</h2>
                <div id="alertsList"></div>
              </div>
            </div>
            <script>
              let historicalData = {
                hitRate: [],
                memory: [],
                latency: [],
                errorRate: [],
                compression: [],
                operations: []
              };

              function updateStatus(stats) {
                const status = document.getElementById('status');
                if (stats.errorRate > 0.05) {
                  status.className = 'status error';
                  status.textContent = 'Error';
                } else if (stats.memoryUsagePercent > 80 || stats.hitRate < 0.6) {
                  status.className = 'status warning';
                  status.textContent = 'Warning';
                } else {
                  status.className = 'status healthy';
                  status.textContent = 'Healthy';
                }
              }

              function updateAlerts(stats) {
                const alertsList = document.getElementById('alertsList');
                alertsList.innerHTML = '';
                
                if (stats.errorRate > 0.05) {
                  alertsList.innerHTML += \`
                    <div class="alert error">
                      High error rate: \${(stats.errorRate * 100).toFixed(2)}%
                    </div>
                  \`;
                }
                
                if (stats.memoryUsagePercent > 80) {
                  alertsList.innerHTML += \`
                    <div class="alert warning">
                      High memory usage: \${stats.memoryUsagePercent.toFixed(2)}%
                    </div>
                  \`;
                }
                
                if (stats.hitRate < 0.6) {
                  alertsList.innerHTML += \`
                    <div class="alert warning">
                      Low hit rate: \${(stats.hitRate * 100).toFixed(2)}%
                    </div>
                  \`;
                }

                if (stats.averageLatency > 100) {
                  alertsList.innerHTML += \`
                    <div class="alert warning">
                      High latency: \${stats.averageLatency.toFixed(2)}ms
                    </div>
                  \`;
                }

                if (alertsList.innerHTML === '') {
                  alertsList.innerHTML = '<p>No active alerts</p>';
                }
              }

              function updateCharts(stats) {
                const now = new Date();
                
                // Update historical data
                historicalData.hitRate.push({ x: now, y: stats.hitRate });
                historicalData.memory.push({ x: now, y: stats.memoryUsagePercent });
                historicalData.latency.push({ x: now, y: stats.averageLatency });
                historicalData.errorRate.push({ x: now, y: stats.errorRate });
                historicalData.compression.push({ x: now, y: stats.compressionRatio });
                historicalData.operations.push({ x: now, y: stats.totalOperations });

                // Keep last 60 data points (10 minutes at 10s intervals)
                const maxPoints = 60;
                Object.values(historicalData).forEach(array => {
                  if (array.length > maxPoints) {
                    array.shift();
                  }
                });

                // Hit Rate Chart
                const hitRateData = {
                  x: historicalData.hitRate.map(d => d.x),
                  y: historicalData.hitRate.map(d => d.y * 100),
                  type: 'scatter',
                  name: 'Hit Rate (%)'
                };
                Plotly.newPlot('hitRateChart', [hitRateData], {
                  margin: { t: 0, r: 0, l: 40, b: 40 }
                });

                // Memory Usage Chart
                const memoryData = {
                  x: historicalData.memory.map(d => d.x),
                  y: historicalData.memory.map(d => d.y),
                  type: 'scatter',
                  name: 'Memory Usage (%)'
                };
                Plotly.newPlot('memoryChart', [memoryData], {
                  margin: { t: 0, r: 0, l: 40, b: 40 }
                });

                // Latency Chart
                const latencyData = {
                  x: historicalData.latency.map(d => d.x),
                  y: historicalData.latency.map(d => d.y),
                  type: 'scatter',
                  name: 'Average Latency (ms)'
                };
                Plotly.newPlot('latencyChart', [latencyData], {
                  margin: { t: 0, r: 0, l: 40, b: 40 }
                });

                // Error Rate Chart
                const errorData = {
                  x: historicalData.errorRate.map(d => d.x),
                  y: historicalData.errorRate.map(d => d.y * 100),
                  type: 'scatter',
                  name: 'Error Rate (%)'
                };
                Plotly.newPlot('errorChart', [errorData], {
                  margin: { t: 0, r: 0, l: 40, b: 40 }
                });

                // Compression Chart
                const compressionData = {
                  labels: ['Compressed', 'Uncompressed'],
                  datasets: [{
                    data: [
                      stats.totalCompressedSize,
                      stats.totalUncompressedSize - stats.totalCompressedSize
                    ],
                    backgroundColor: ['#27ae60', '#e74c3c']
                  }]
                };
                new Chart('compressionChart', {
                  type: 'pie',
                  data: compressionData,
                  options: {
                    responsive: true,
                    maintainAspectRatio: false
                  }
                });

                // Operations Chart
                const operationsData = {
                  x: historicalData.operations.map(d => d.x),
                  y: historicalData.operations.map(d => d.y),
                  type: 'scatter',
                  name: 'Total Operations'
                };
                Plotly.newPlot('operationsChart', [operationsData], {
                  margin: { t: 0, r: 0, l: 40, b: 40 }
                });
              }

              async function refreshData() {
                try {
                  const response = await fetch('/cache/api/stats');
                  const stats = await response.json();
                  
                  updateStatus(stats);
                  updateAlerts(stats);
                  updateCharts(stats);
                } catch (error) {
                  console.error('Failed to fetch cache stats:', error);
                }
              }

              // Initial load
              refreshData();

              // Refresh every 10 seconds
              setInterval(refreshData, 10000);
            </script>
          </body>
        </html>
      `);
    });

    // API endpoints
    this.router.get('/api/stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.cacheService.getStats();
        res.json(stats);
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cache stats' });
      }
    });
  }

  getRouter() {
    return this.router;
  }
} 