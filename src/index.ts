import express from "express";
import pino from "pino";
import { register, collectDefaultMetrics, Gauge } from "prom-client";

const {
    INCLUDE_NODEJS_METRICS,
    INTERVAL_SECONDS,
    LOG_LEVEL,
    HEIGHT_DIFF_THRESHOLD,
    LISTEN_PORT,
} = process.env;

const listenPort = Number(LISTEN_PORT || 9090);

export const logger = pino({ level: LOG_LEVEL || 'info' })

import { currentChain } from "./chains";

const DEFAULT_HEIGHT_DIFF_THRESHOLD = 100

const sidecarStatus = {
    ignoreDifferenceBetweenLocalAndRemote: false,
    localRPCReady: false,
    localHeight: -2,
    remoteHeight: -2,
};

const localHeight = new Gauge({
    name: "blockchain_local_node_height",
    help: "Local blockchain node height",
    labelNames: ["chain_id"],
});

const remoteHeight = new Gauge({
    name: "blockchain_remote_node_height",
    help: "Remote blockchain node height",
    labelNames: ["chain_id"],
});

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
// If the readiness probe returns a failed state, then Kubernetes removes the IP address for the container from the endpoints of all Services.
// 
// TODO: Add liveness checks (that will kill/redeploy the container. Possibly when the node is stuck on some height?)
// TODO: startup checks (that must pass before the other checks start working);
app.get("/health/readiness", async (req, res) => {
    const {
        ignoreDifferenceBetweenLocalAndRemote,
        localRPCReady,
        localHeight,
        remoteHeight,
    } = sidecarStatus;

    logger.debug({ sidecarStatus }, 'readiness check')

    if (!localRPCReady) {
        return res.status(503).send(`RPC not ready, reported height ${localHeight}`);
    }

    if (ignoreDifferenceBetweenLocalAndRemote) {
        return res.status(200).send(`Remote ${remoteHeight}, local ${localHeight}, but ignoring the difference`);
    }

    if (localHeight >= remoteHeight) {
        return res.status(200).send("Local node is higher or the same as remote.");
    }

    const threshold = Number(HEIGHT_DIFF_THRESHOLD || DEFAULT_HEIGHT_DIFF_THRESHOLD);
    const diff = remoteHeight - localHeight;

    if (diff <= threshold) {
        return res
            .status(200)
            .send(
                `The height difference is ${diff}, which is acceptable. Threshold: ${threshold}.`
            );
    }

    return res
        .status(503)
        .send(
            `The node is behind, the difference is ${diff}, allowed threshold: ${threshold}.`
        );
});

// TODO: add an option to extend the check for chains that might require additional health-checks other than height comparison.
const performChecks = async () => {
    const { id: chain_id, getLocalHeight, getRemoteHeight } = currentChain

    sidecarStatus.localHeight = await getLocalHeight();
    if (typeof sidecarStatus.localHeight === 'number') {
        localHeight.labels({ chain_id }).set(sidecarStatus.localHeight);
    }

    // If the call was unsuccessful we get -1, and deem the node not ready.
    if (sidecarStatus.localHeight > 0) {
        sidecarStatus.localRPCReady = true;
    } else {
        sidecarStatus.localRPCReady = false;
    }

    sidecarStatus.remoteHeight = await getRemoteHeight()

    if (typeof sidecarStatus.remoteHeight === 'number') {
        remoteHeight.labels({ chain_id }).set(sidecarStatus.remoteHeight)
    }

    // If remote RPC call is not successful, we should probably ignore the difference between local & remote.
    // So we don't end up in a situation when oracles went bad and our service degrades because of that.
    if (sidecarStatus.remoteHeight < 0) {
        sidecarStatus.ignoreDifferenceBetweenLocalAndRemote = true;
    } else {
        sidecarStatus.ignoreDifferenceBetweenLocalAndRemote = false;
    }

    logger.debug({ sidecarStatus }, 'check finished')
};

// Run the check periodically
(async () => {
    if (!currentChain && !currentChain.id) {
        logger.error("Chain is not configured.")
    }

    const { id, name } = currentChain
    logger.info(`Starting checks for ${name} (${id})`)

    await performChecks();
    setInterval(() => {
        performChecks();
    }, Number(INTERVAL_SECONDS || 15) * 1000);
})();

// Start server
const server = app.listen(listenPort);

logger.info(`Listening on :${listenPort}`);
process.on("SIGTERM", () => {
    logger.info("SIGTERM signal received: closing HTTP server");
    server.close(() => {
        logger.info("HTTP server closed");
    });
});