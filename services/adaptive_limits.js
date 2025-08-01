import { redisClient } from '../utils/redis_client.js';

export const DEFAULT_LIMIT = 100;
export const BAN_DURATION = 60 * 5;
export const WINDOW_SIZE = 60;
export const rateLimits = new Map(); // { ip: limit }

export async function handleWorkerMessage(msg) {
  const { ip, anomaly, action } = msg;
  console.log(`Anomaly detected for IP ${ip}: ${action}`);
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
}
