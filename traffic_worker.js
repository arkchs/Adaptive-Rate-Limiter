// traffic_worker.js
// Worker thread for anomaly detection (basic Z-score logic)
import { parentPort } from 'worker_threads';

const trafficStats = new Map(); // { ip: [timestamps] }
const WINDOW = 60 * 1000; // 1 minute
const Z_THRESHOLD = 3;

function detectAnomaly(ip, timestamp) {
  const now = Date.now();
  const arr = trafficStats.get(ip) || [];
  // Remove old timestamps
  const filtered = arr.filter(t => now - t < WINDOW);
  filtered.push(timestamp);
  trafficStats.set(ip, filtered);
 
  // Calculate stats
  const count = filtered.length;
  const allCounts = Array.from(trafficStats.values()).map(a => a.length);
  const mean = allCounts.reduce((a, b) => a + b, 0) / allCounts.length;
  const std = Math.sqrt(allCounts.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / allCounts.length);
  const z = std ? (count - mean) / std : 0;

  if (z > Z_THRESHOLD && count > 20) {
    return { anomaly: true, action: 'ban' };
  } else if (z > 2) {
    return { anomaly: true, action: 'decrease' };
  } else if (z < -1 && count < 5) {
    return { anomaly: true, action: 'increase' };
  }
  return { anomaly: false };
}

parentPort.on('message', (log) => {
  const { ip, timestamp } = log;
  const result = detectAnomaly(ip, timestamp);
  if (result.anomaly) {
    parentPort.postMessage({ ip, ...result });
  }
});
