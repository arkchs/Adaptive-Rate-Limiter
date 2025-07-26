// traffic_worker.js
// Worker thread for anomaly detection (basic Z-score logic)
import { parentPort } from 'worker_threads';

const trafficStats = new Map(); // { ip: [timestamps] }
const WINDOW = 60 * 1000; // 1 minute
const Z_THRESHOLD = 1.8;

function detectAnomaly(ip, timestamp) {
  const now = Date.now();
  const arr = trafficStats.get(ip) || [];
  const filtered = arr.filter(t => now - t < WINDOW);
  filtered.push(timestamp);
  trafficStats.set(ip, filtered);

  const count = filtered.length;
  const allCounts = Array.from(trafficStats.values()).map(a => a.length);
  const mean = allCounts.reduce((a, b) => a + b, 0) / allCounts.length;
  const std = Math.sqrt(allCounts.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / allCounts.length);
  const z = std ? (count - mean) / std : 0;

  // Add this console.log to see the values
  console.log(`Worker processing IP: ${ip}, Count: ${count}, Mean: ${mean.toFixed(2)}, Std: ${std.toFixed(2)}, Z-score: ${z.toFixed(2)}`);

  if (z > Z_THRESHOLD && count > 20) {
    console.log(`Anomaly detected for ${ip}: BAN (Z=${z.toFixed(2)}, Count=${count})`);
    return { anomaly: true, action: 'ban' };
  } else if (z > 1) {
    console.log(`Anomaly detected for ${ip}: DECREASE (Z=${z.toFixed(2)}, Count=${count})`);
    return { anomaly: true, action: 'decrease' };
  } else if (z < -1 && count < 5) { // This condition is less likely to be hit during an attack
    console.log(`Anomaly detected for ${ip}: INCREASE (Z=${z.toFixed(2)}, Count=${count})`);
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
