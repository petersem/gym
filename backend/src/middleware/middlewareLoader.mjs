// custom middleware
export { sanitiser } from './sanitiser.mjs';
export { errorMiddleware } from './errorMiddleware.mjs';
export { idempotencyMiddleware } from './idempotency.mjs';
export { rateLimit } from 'express-rate-limit'
export { swaggerSpec } from '../swagger.config.mjs';
export { fileURLToPath } from "url";
import { logDanger, logWarning, logInfo } from "../utilities/logger.mjs";

// express limiter
// if prod, 200 calls per 15 minutes
let period = 15 * 60 * 1000;
let limit = 500;
// if dev, 500 calls per 15 minutes
if (process.env?.NODE_ENV === "development") {
    period = 15 * 60 * 1000;
    limit = 500;
}

const allowList = ['localhost', '127.0.0.1', '::1']; // whitelist for local address calls
export const limiterOptions = {
    windowMs: period, // 15 minutes
    limit: limit, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
    handler: (req, res, next, options) => { // custom message for limit exceeded
        console.log(logWarning, `Rate limit execeeded for ${req.ip.replace('::ffff:','')} ${req.path}`);
        return res.status(options.statusCode).send(`Rate limit execeeded for ${req.ip.replace('::ffff:','')}. ${options.message} (after ${options.windowMs/60/1000} minutes)`);
    },
    skip: (req, res) => allowList.includes(req.ip.replace('::ffff:','')) // use whitelist
    // TODO - store: ... , // Redis, Memcached, etc.
}

// cors
const PORT = process.env.PORT || 3000;
export const corsOptions = {
  origin: [`http://localhost:${PORT}`]
}

// idempotency options
export let devOptions;
if (process.env?.NODE_ENV === "development") {
    devOptions = { ttlMs: 3 * 60 * 1000, cleanupIntervalM: 1 }
}
