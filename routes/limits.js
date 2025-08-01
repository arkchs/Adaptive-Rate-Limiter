import { rateLimits } from "../services/adaptive_limits.js";
export async function handleGetLimits(req,res) {
    res.json(Object.fromEntries(rateLimits));
}