import express from "express";
import pino from "pino";
import { register, collectDefaultMetrics, Gauge } from "prom-client";
import { currentChain } from "@chains";

export const logger = pino()

const {
    INCLUDE_NODEJS_METRICS,
    INTERVAL_SECONDS,
    HEIGHT_DIFF_THRESHOLD,
} = process.env;

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
const { id: chain_id, getLocalHeight, getRemoteHeight } = currentChain()

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

app.get("/health/readiness", async (req, res) => {
    const { ignoreDifferenceBetweenLocalAndRemote,
        localRPCReady,
        localHeight,
        remoteHeight, } =
        sidecarStatus;

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

const performChecks = async () => {
    sidecarStatus.localHeight = await getLocalHeight();
    localHeight.labels({ chain_id }).set(sidecarStatus.localHeight);
    // If the call was unsuccessful we get -1, and deem the node not ready.
    if (sidecarStatus.localHeight > 0) {
        sidecarStatus.localRPCReady = true;
    } else {
        sidecarStatus.localRPCReady = false;
    }

    sidecarStatus.remoteHeight = await getRemoteHeight()
    remoteHeight.labels({ chain_id }).set(sidecarStatus.remoteHeight)
    // If remote RPC call is not successful, we should probably ignore the difference between local & remote.
    // So we don't end up in a situation when oracles went bad and our service degrades because of that.
    if (sidecarStatus.remoteHeight < 0) {
        sidecarStatus.ignoreDifferenceBetweenLocalAndRemote = true;
    } else {
        sidecarStatus.ignoreDifferenceBetweenLocalAndRemote = false;
    }
};

(async () => {
    performChecks();
    setInterval(() => {
        performChecks();
    }, Number(INTERVAL_SECONDS || 15) * 1000);
})();

// Start server
const server = app.listen(9090);

logger.info("Listening on :9090");
process.on("SIGTERM", () => {
    logger.info("SIGTERM signal received: closing HTTP server");
    server.close(() => {
        logger.info("HTTP server closed");
    });
});