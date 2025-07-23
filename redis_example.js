import express from 'express';
import { createClient } from 'redis';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Create Redis client
const redisClient = createClient();
redisClient.on('error', (err) => console.error('Redis Client Error', err));
await redisClient.connect();

// Set a value in Redis
app.post('/set', async (req, res) => {
  const { key, value } = req.body;
  await redisClient.set(key, value);
  res.json({ success: true, message: `Set ${key} = ${value}` });
});

// Get a value from Redis
app.get('/get/:key', async (req, res) => {
  const { key } = req.params;
  const value = await redisClient.get(key);
  res.json({ success: true, key, value });
});m

app.listen(PORT, () => {
  console.log(`Redis example server running on port ${PORT}`);
});
