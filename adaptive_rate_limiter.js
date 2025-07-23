import express from 'express';
import Redis from 'ioredis';
import { Worker } from 'worker_threads';    
import os from 'os';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WINDOW_SIZE = 60; // seconds
const DEFAULT_LIMIT = 100; // requests per minute
const BAN_DURATION = 60 * 5; // seconds

const redisClient = new Redis(REDIS_URL);
redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Adaptive rate limits per IP
const rateLimits = new Map(); // { ip: limit }

// Worker pool for anomaly detection
const numWorkers = Math.max(2, os.cpus().length - 1);
const workers = [];
for (let i = 0; i < numWorkers; i++) {
  workers.push(new Worker('./traffic_worker.js'));
}
let nextWorker = 0;

// Helper: send log to worker
function sendToWorker(log) {
  workers[nextWorker].postMessage(log);
  nextWorker = (nextWorker + 1) % workers.length;
}

// Middleware: Rate Limiting & Adaptive Control
app.use(async (req, res, next) => {
  const ip = req.ip;
  const endpoint = req.path;
  const now = Date.now();

  // Check ban status
  const banKey = `ban:${ip}`;
  const banned = await redisClient.get(banKey);
  if (banned) {
    return res.status(429).json({ success: false, message: 'IP temporarily banned for suspicious activity.' });
  }

  // Get current rate limit
  let limit = rateLimits.get(ip) || DEFAULT_LIMIT;

  // Sliding window key
  const windowKey = `rate:${ip}:${Math.floor(now / 1000 / WINDOW_SIZE)}`;
  const count = await redisClient.incr(windowKey);
  if (count === 1) {
    await redisClient.expire(windowKey, WINDOW_SIZE);
  }

  // Send log to worker for analysis
  sendToWorker({ ip, timestamp: now, endpoint });

  if (count > limit) {
    return res.status(429).json({ success: false, message: 'Rate limit exceeded.' });
  }

  res.set('X-RateLimit-Limit', limit);
  res.set('X-RateLimit-Remaining', Math.max(0, limit - count));
  next();
});

// Endpoint for testing
app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Request allowed.' });
});

// Endpoint to view current rate limits
app.get('/limits', (req, res) => {
  res.json(Object.fromEntries(rateLimits));
});

// Listen for worker messages (adaptive logic)
workers.forEach(worker => {
  worker.on('message', async (msg) => {
    const { ip, anomaly, action } = msg;
    if (anomaly) {
      if (action === 'ban') {
        await redisClient.setex(`ban:${ip}`, BAN_DURATION, '1');
        rateLimits.set(ip, Math.max(10, Math.floor(DEFAULT_LIMIT / 5)));
      } else if (action === 'decrease') {
        rateLimits.set(ip, Math.max(10, Math.floor((rateLimits.get(ip) || DEFAULT_LIMIT) / 2)));
      } else if (action === 'increase') {
        rateLimits.set(ip, Math.min(200, (rateLimits.get(ip) || DEFAULT_LIMIT) * 2));
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`Autonomous Adaptive Rate Limiter running on port ${PORT}`);
});
