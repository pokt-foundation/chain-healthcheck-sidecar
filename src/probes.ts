import { sidecarStatus, logger } from ".";

const {
    HEIGHT_DIFF_THRESHOLD,
} = process.env;

const DEFAULT_HEIGHT_DIFF_THRESHOLD = 100
export const diffThreshold = Number(HEIGHT_DIFF_THRESHOLD || DEFAULT_HEIGHT_DIFF_THRESHOLD)


// Compares the diff between local vs oracle. Fails health check when behind. As a result no traffic goes to pod.
export const readinessProbe = async (_req, res) => {
    const {
        monitoringIsUnstable,
        localRPCAvailable,
        localHeight,
        remoteHeight,
        currentDiff,
    } = sidecarStatus;

    if (!localRPCAvailable) {
        logger.info({ localHeight, localRPCAvailable }, '[READINESS_PROBE]: Failing a health-check as local RPC is not ready')
        return res.status(503).send(`RPC not ready, reported height ${localHeight}`);
    }

    if (monitoringIsUnstable) {
        return res.status(200).send(`Remote ${remoteHeight}, local ${localHeight}, but ignoring the difference as monitoringIsUnstable`);
    }

    if (localHeight >= remoteHeight) {
        return res.status(200).send("Local node is higher or the same as remote.");
    }

    if (currentDiff <= diffThreshold) {
        return res
            .status(200)
            .send(
                `The height difference is ${currentDiff}, which is acceptable. Threshold: ${diffThreshold}.`
            );
    }

    logger.info({ localHeight, remoteHeight, currentDiff, diffThreshold }, '[READINESS_PROBE]: failing a health-check as node is behind')

    return res
        .status(503)
        .send(
            `The node is behind, the difference is ${currentDiff}, allowed threshold: ${diffThreshold}.`
        );
}

// Verifies the node is climbing. Fails liveness probe when it's not. The pod gets restarted as a result.
export const livenessProbe = async (_req, res) => {
    const {
        monitoringIsUnstable,
        localRPCAvailable,
        localHeight,
        currentDiff,
        isNotClimbing,
    } = sidecarStatus;

    if (!localRPCAvailable) {
        logger.info({ localHeight, localRPCAvailable }, '[LIVENESS_PROBE]: Failing a health-check as local RPC is not ready')
        return res.status(503).send(`RPC not ready, reported height ${localHeight}`);
    }

    if (isNotClimbing) {
        // Edge case: whole blockchain is halted. In that case the assumption is we don't want to restart the nodes.
        // For this to happen: monitoring should be stable, difference should be within threshold
        if (!monitoringIsUnstable && currentDiff <= diffThreshold) {
            logger.info('[LIVENESS_PROBE]: Even though the node is not climbing, the diff is OK - assuming network-wide issues.')
            return res.status(200).send(`The node is not climbing but this seems to be a network-wide issue.`);
        }

        return res.status(503).send(`The node is not climbing`);
    } else {
        return res.status(200).send('OK')
    }
}

export const startupProbe = async (_req, res) => {
    const {
        localNodeInitialized,
    } = sidecarStatus;

    if (!localNodeInitialized) {
        logger.info({ localNodeInitialized }, '[STARTUP_PROBE]: Failing a health-check as local node is not initialized yet')
        return res.status(503).send(`node is not initialized yet`);
    }

    return res.status(200).send('OK')
}
