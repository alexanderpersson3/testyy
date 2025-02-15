import { EventEmitter } from 'events';

interface PerformanceThresholds {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

class PerformanceMonitor extends EventEmitter {
  public thresholds: PerformanceThresholds;

  constructor() {
    super();
    this.thresholds = {
      responseTime: 1000, // 1 second
      memoryUsage: 1024 * 1024 * 512, // 512MB
      cpuUsage: 80, // 80% CPU usage
    };
  }

  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  checkMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > this.thresholds.memoryUsage) {
      this.emit('highMemory', {
        type: 'memory_alert',
        usage: memoryUsage.heapUsed,
        threshold: this.thresholds.memoryUsage,
        timestamp: new Date(),
      });
    }
  }

  checkCpuUsage(): void {
    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    if (totalUsage > this.thresholds.cpuUsage) {
      this.emit('highCpu', {
        type: 'cpu_alert',
        usage: totalUsage,
        threshold: this.thresholds.cpuUsage,
        timestamp: new Date(),
      });
    }
  }

  startMonitoring(interval = 60000): void {
    setInterval(() => {
      this.checkMemoryUsage();
      this.checkCpuUsage();
    }, interval);
  }
}

const monitor = new PerformanceMonitor();
export default monitor; 