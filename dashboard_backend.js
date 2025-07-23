import express from 'express';
import Redis from 'ioredis';
import { CronJob } from 'cron';
import axios from 'axios';
import http from 'http';
import { Server as SocketServer } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: '*' } });
app.use(express.json());

const PORT = process.env.PORT || 5000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5001/anomaly';
const BUCKET_CAPACITY = 100;
const LEAK_INTERVAL = 10 * 1000;

const redisClient = new Redis(REDIS_URL);
const leakyBucket = [];
const blockedRequests = [];
const requestLogs = [];
const rateLimits = new Map();

// Function to leak (remove) a token from the bucket
const leakBucket = () => {
  if (leakyBucket.length > 0) {
    const leaked = leakyBucket.shift();
    // ...existing code...
  }
};

// Real-time traffic logging
function logRequest(ip, endpoint, status) {
  const log = { ip, endpoint, status, timestamp: Date.now() };
  requestLogs.push(log);
  io.emit('traffic', log);
}

// API endpoint to check the bucket's status
app.get('/bucket', (req, res) => {
  res.json({
    bucketLimit: BUCKET_CAPACITY,
    currentBucketSize: leakyBucket.length,
    bucket: leakyBucket
  });
});

// API endpoint for blocked requests
app.get('/blocked', (req, res) => {
  res.json({ blockedRequests });
});

// API endpoint for current rate limits
app.get('/limits', (req, res) => {
  res.json(Object.fromEntries(rateLimits));
});

// API endpoint for recent traffic logs
app.get('/logs', (req, res) => {
  res.json({ requestLogs });
});

// API endpoint for anomalies
app.get('/anomalies', async (req, res) => {
  // Send moving average data to Flask microservice
  const trafficCounts = requestLogs.map(log => log.ip).reduce((acc, ip) => {
    acc[ip] = (acc[ip] || 0) + 1;
    return acc;
  }, {});
  try {
    const response = await axios.post(FLASK_URL, { trafficCounts });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Flask anomaly service unavailable' });
  }
});

// Middleware for rate limiting using leaky bucket
const leakyBucketMiddleware = (req, res, next) => {
  const ip = req.ip;
  if (leakyBucket.length < BUCKET_CAPACITY) {
    leakyBucket.push(Date.now());
    rateLimits.set(ip, BUCKET_CAPACITY);
    logRequest(ip, req.path, 'allowed');
    next();
  } else {
    blockedRequests.push({ ip, endpoint: req.path, timestamp: Date.now() });
    logRequest(ip, req.path, 'blocked');
    res.status(429).set('X-LeakyBucket-Remaining', 0).set('Retry-After', LEAK_INTERVAL / 1000).json({
      success: false,
      message: 'Too many requests'
    });
  }
};

app.use(leakyBucketMiddleware);

// Sample endpoint for testing leaky bucket rate limiting
app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Request allowed.' });
});

// Cron job to periodically leak tokens from the bucket
const job = new CronJob('*/10 * * * * *', () => {
  leakBucket();
});

server.listen(PORT, () => {
  console.log(`Dashboard backend running on port ${PORT}`);
  job.start();
});

io.on('connection', (socket) => {
  console.log('WebSocket client connected');
});
