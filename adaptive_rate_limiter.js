import express from 'express';
import cors from "cors";
import {handleGetLimits} from "./routes/limits.js"
import {handleGetService} from "./routes/mock_api.js"
import { rateLimitingMiddleware } from './middlewares/rate_limiting.js';
import { workers } from './workers/worker_pool.js';
import { handleWorkerMessage } from './services/adaptive_limits.js';
import "dotenv/config.js";
//Constants
const app = express();
const PORT = process.env.PORT || 5000;

// Listen for worker messages (adaptive logic)
workers.forEach((worker) => {
  worker.on('message', handleWorkerMessage);
});

//All the middlewares
app.set('trust proxy', true);//setting this to true (not recommended for prod grade applications)
//Without trust proxy, Express would derive the client's IP address from req.socket.remoteAddress, which would be the IP of the proxy server, not the actual client. With trust proxy enabled, req.ip will correctly reflect the client's IP address (typically the left-most entry in the X-Forwarded-For header).
app.use(express.json());
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false,
}));


//outputs the limits set for the current ips in the cache
const limitsRouter = express.Router();
limitsRouter.get("/limits", handleGetLimits);
//replace with the apis that need rate limiting
const serviceRouter = express.Router();
serviceRouter.get("/api", handleGetService)

//Routes
app.use(serviceRouter, rateLimitingMiddleware);

app.listen(PORT, () => {
  console.log(`Autonomous Adaptive Rate Limiter running on port ${PORT}`);
});
