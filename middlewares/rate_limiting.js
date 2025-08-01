import { redisClient } from "../utils/redis_client.js";
import { rateLimits, DEFAULT_LIMIT, WINDOW_SIZE } from "../services/adaptive_limits.js";
import { sendToWorker } from "../workers/worker_pool.js";
// Middleware: Rate Limiting & Adaptive Control
export async function rateLimitingMiddleware(req, res, next) {
  const ip = req.ip;
  const endpoint = req.path;
  const now = Date.now();//now is the time elapsed since 1 jan 1970 in milliseconds

  // Check ban status
  const banKey = `ban:${ip}`;
  const banned = await redisClient.get(banKey);
  if (banned) {
    return res.status(429).json({ success: false, message: 'IP temporarily banned for suspicious activity.' });
  }

  // Get current rate limit
  let limit = rateLimits.get(ip) || DEFAULT_LIMIT;



  // Sliding window key
  const windowKey = `rate:${ip}:${Math.floor(now / 1000 / WINDOW_SIZE)}`;//outputs a key based on current time and window size to uniquely identify a window
  
  
  const count = await redisClient.incr(windowKey);//number of requests in the current window
  if (count === 1) {//if its is the first request in the current window
    await redisClient.expire(windowKey, WINDOW_SIZE);//so expire the current request information in the time of window size (seconds)
    //this allows to 
  }
  
  // Send log to worker for analysis
  sendToWorker({ ip, timestamp: now, endpoint });

  if (count > limit) {
    return res.status(429).json({ success: false, message: 'Rate limit exceeded.' });
  }

  res.set('X-RateLimit-Limit', limit);
  res.set('X-RateLimit-Remaining', Math.max(0, limit - count));
  next();
}
