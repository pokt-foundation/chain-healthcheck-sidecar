import express from "express";
import pino from "pino";
import { register, collectDefaultMetrics, Gauge } from "prom-client";
import { currentChain } from "./chains";
import { performChecks } from "./checks";
import { livenessProbe, readinessProbe, startupProbe } from "./probes";

const {
    INCLUDE_NODEJS_METRICS,
    INTERVAL_SECONDS,
    LOG_LEVEL,
    LISTEN_PORT,
} = process.env;

const listenPort = Number(LISTEN_PORT || 9090);

export const logger = pino({ level: LOG_LEVEL || 'info' })

export const sidecarStatus = {
    monitoringIsUnstable: false,
    localRPCAvailable: false,
    localNodeInitialized: false,
    localHeight: -2,
    remoteHeight: -2,
    currentDiff: 0,
    isNotClimbing: false,
};

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

// Readiness probes determine whether or not a container is ready to serve requests.
// If the readiness probe returns a non-200 response, Kubernetes removes the IP address of the container from the endpoints of all Services.
// 
// TODO: startup checks (that must pass before the other checks start working);

app.get("/health/readiness", readinessProbe);
app.get("/health/liveness", livenessProbe);
app.get("/health/startup", startupProbe);

(async () => {
    if (!currentChain && !currentChain.id) {
        logger.error("Chain is not configured.")
    }

    const { id, name } = currentChain
    logger.info(`Starting checks for ${name} (${id})`)
    await performChecks();

    // Run the check periodically
    const interval = Number(INTERVAL_SECONDS || 15) * 1000;
    const timer = setInterval(async () => {
        await performChecks();
    }, interval);
    logger.info(`Running check every ${interval}ms`);


    // Start server
    const server = app.listen(listenPort);
    logger.info(`Listening on :${listenPort}`);

    process.on("SIGTERM", () => {
        logger.info("SIGTERM signal received: stopping periodic checks");
        clearInterval(timer)

        logger.info("SIGTERM signal received: closing HTTP server");
        server.close(() => {
            logger.info("HTTP server closed");
        });
    });
})();
