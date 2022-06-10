import express from "express";
import pino from "pino";
import { register, collectDefaultMetrics } from "prom-client";
import { performChecks } from "./checks";
import { chainID } from "./common";
import { currentHeightRequestStrategy } from "./height-strategies";
import { currentProbeStrategies } from "./probe-strategies";

const {
    INCLUDE_NODEJS_METRICS,
    INTERVAL_SECONDS,
    LOG_LEVEL,
    LISTEN_PORT,
} = process.env;

const listenPort = Number(LISTEN_PORT || 9090);
export const logger = pino({ level: LOG_LEVEL || 'info' })

// export const sidecarStatus = {
//     monitoringIsUnstable: false,
//     localRPCAvailable: false,
//     localNodeInitialized: false,
//     localHeight: -2,
//     remoteHeight: -2,
//     currentDiff: 0,
//     isNotClimbing: false,
// };

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


(async () => {
    const { readiness, liveness, startup } = currentProbeStrategies

    // Init probe strategies if they have any init code
    readiness.init ? readiness.init() : null
    liveness.init ? liveness.init() : null
    startup.init ? startup.init() : null

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

    const { name, init } = currentHeightRequestStrategy
    init ? init : null
    logger.info({ name, chainID }, 'height request strategy initiated');

    await performChecks();

    // Run the checks periodically
    const interval = Number(INTERVAL_SECONDS || 15) * 1000;
    const timer = setInterval(async () => {
        await performChecks();
    }, interval);
    logger.info(`Running checks every ${interval}ms`);


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
