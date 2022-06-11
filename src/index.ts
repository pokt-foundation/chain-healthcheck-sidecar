import express from "express";
import pino from "pino";
import { register, collectDefaultMetrics } from "prom-client";
import { performChecks } from "./checks";
import { requireEnvar } from "./common";
import { currentHeightRequestStrategy } from "./height-strategies";
import { currentProbeStrategies } from "./probe-strategies";
import { sidecarState } from "./state";

const {
    INCLUDE_NODEJS_METRICS,
    INTERVAL_SECONDS,
    LOG_LEVEL,
    LISTEN_PORT,
} = process.env;

export const logger = pino({ level: LOG_LEVEL || 'info' })
const listenPort = Number(LISTEN_PORT || 9090);
const app = express();

// In case we want to troubleshoot the healthcheck sidecar itself.
if (INCLUDE_NODEJS_METRICS === "true") {
    collectDefaultMetrics({ register });
}

// Exposes metrics as Prometheus exporter
app.get("/metrics", async (_req, res) => {
    try {
        res.set("Content-Type", register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
});

// Set global sidecar settings
const chainID = requireEnvar('SIDECAR_CHAIN_ID')
const localRPCEndpoint = requireEnvar('LOCAL_RPC_ENDPOINT')
const remoteRPCEndpoints = (requireEnvar('REMOTE_RPC_ENDPOINTS') || '').split(',')
const performRemoteChecks = remoteRPCEndpoints.length != 0
Object.assign(sidecarState, { chainID, localRPCEndpoint, remoteRPCEndpoints, performRemoteChecks });

(async () => {
    // Configure probes
    const { readiness, liveness, startup } = currentProbeStrategies

    // Init probe strategies if they have any init code
    readiness.init ? await readiness.init() : null
    liveness.init ? await liveness.init() : null
    startup.init ? await startup.init() : null

    // Readiness probes determine whether or not a container is ready to serve requests.
    // If the readiness probe returns a non-200 response, Kubernetes removes the IP address of the container from the endpoints of all Services.
    app.get("/health/readiness", readiness.httpHandler);
    app.get("/health/liveness", liveness.httpHandler);
    app.get("/health/startup", startup.httpHandler);
    logger.info({
        readiness: readiness.name,
        liveness: liveness.name,
        startup: startup.name,
    }, 'checks/probes selected');

    // Configure height checks
    const { init } = currentHeightRequestStrategy
    init ? await init() : null

    // Do very first run
    performChecks();

    // Set up checks to run periodically
    const interval = Number(INTERVAL_SECONDS || 15) * 1000;
    const timer = setInterval(() => performChecks(), interval);
    logger.info(`Running checks every ${interval}ms`);

    // Start web server
    const server = app.listen(listenPort);
    logger.info(`Listening on :${listenPort}`);

    // Handle termination
    process.on("SIGTERM", () => {
        logger.info("SIGTERM signal received: stopping periodic checks");
        clearInterval(timer)

        logger.info("SIGTERM signal received: closing HTTP server");
        server.close(() => {
            logger.info("HTTP server closed");
        });
    });
})()

