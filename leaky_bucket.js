import { CronJob } from 'cron';
import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const BUCKET_CAPACITY = 2;
const LEAK_INTERVAL = 10 * 1000; // 10 seconds

const leakyBucket = [];

// Function to leak (remove) a token from the bucket
const leakBucket = () => {
  if (leakyBucket.length > 0) {
    const leaked = leakyBucket.shift();
    console.log(`Token ${leaked} leaked`);
  }
};

// API endpoint to check the bucket's status
app.get('/bucket', (req, res) => {
  res.json({
    bucketLimit: BUCKET_CAPACITY,
    currentBucketSize: leakyBucket.length,
    bucket: leakyBucket
  });
});

// Middleware for rate limiting using leaky bucket
const leakyBucketMiddleware = (req, res, next) => {
  if (leakyBucket.length < BUCKET_CAPACITY) {
    leakyBucket.push(Date.now());
    res.set('X-LeakyBucket-Remaining', BUCKET_CAPACITY - leakyBucket.length);
    next();
  } else {
    res.status(429).set('X-LeakyBucket-Remaining', 0).set('Retry-After', LEAK_INTERVAL / 1000).json({
      success: false,
      message: 'Too many requests'
    });
  }
};

app.use(leakyBucketMiddleware);

// Sample endpoint for testing leaky bucket rate limiting
app.get('/test', (req, res) => {
  const ROCK_PAPER_SCISSORS = ['rock 🪨', 'paper 📃', 'scissors ✂️'];
  const randomIndex = Math.floor(Math.random() * 3);
  const randomChoice = ROCK_PAPER_SCISSORS[randomIndex];
  res.json({
    success: true,
    message: `You got ${randomChoice}`
  });
});

// Cron job to periodically leak tokens from the bucket
const job = new CronJob('*/10 * * * * *', () => {
  leakBucket();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  job.start();
});
