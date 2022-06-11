import { Gauge } from "prom-client";
import { logger } from ".."
import { sidecarState } from "../state"
import { ProbeStrategy } from "./index"

const {
    FAIL_ON_REMOTE_RPC_UNAVAILABLE,
    HEIGHT_DIFF_THRESHOLD
} = process.env;

export const state = {
    currentDiff: 0,

    // Default: false
    failOnRemoteRpcUnavailable: FAIL_ON_REMOTE_RPC_UNAVAILABLE === "true" ? true : false,

    // Default: 100
    diffThreshold: Number(HEIGHT_DIFF_THRESHOLD || 100),

    initialized: false,
}

export const localVsRemote: ProbeStrategy = {
    name: 'localVsRemote',
    backgroundProcessing: async () => {
        const { chainID } = sidecarState

        if (sidecarState.lastLocalNodeHeight > 0 && sidecarState.lastRemoteNodeHeight > 0) {
            state.currentDiff = sidecarState.lastRemoteNodeHeight - sidecarState.lastLocalNodeHeight;
            heightDiffMetric.set({ chainID, threshold: String(state.diffThreshold) }, state.currentDiff)
        }

        logger.debug({ sidecarState }, '[localVsRemote]: check finished')
    },
    httpHandler: (_req, res) => {
        const {
            localRpcAvailable,
            lastLocalNodeHeight,
            lastRemoteNodeHeight,
            remoteRpcUnstable
        } = sidecarState;

        const { currentDiff, diffThreshold, failOnRemoteRpcUnavailable } = state

        if (!localRpcAvailable) {
            logger.info({ lastLocalNodeHeight, localRpcAvailable }, '[localVsRemote]: Failing a health-check as local RPC is available')
            return res.status(503).send(`RPC not ready, reported height ${lastLocalNodeHeight}`);
        }

        if (remoteRpcUnstable) {
            if (failOnRemoteRpcUnavailable) {
                return res.status(503).send(`Remote RPC is unstable, and sidecar configured to fail checks when that happens.`);
            }
            return res.status(200).send(`Remote ${lastRemoteNodeHeight}, local ${lastLocalNodeHeight}, but ignoring the difference as remoteRpcUnstable`);
        }

        if (lastLocalNodeHeight >= lastRemoteNodeHeight) {
            return res.status(200).send("Local node is higher or the same as remote.");
        }


        if (currentDiff <= diffThreshold) {
            return res
                .status(200)
                .send(
                    `The height difference is ${currentDiff}, which is acceptable. Threshold: ${diffThreshold}.`
                );
        }

        logger.info({ lastLocalNodeHeight, lastRemoteNodeHeight, currentDiff, diffThreshold }, '[localVsRemote]: failing a health-check as node is behind')

        return res
            .status(503)
            .send(
                `The node is behind, the difference is ${currentDiff}, allowed threshold: ${diffThreshold}.`
            );
    },
    init: async () => {
        const { performRemoteChecks } = sidecarState

        if (!performRemoteChecks) {
            const err = new Error('Remote RPCs are required for localVsRemote strategy. Check configuration.')
            logger.error(err)
            throw err
        }

        const { failOnRemoteRpcUnavailable, diffThreshold } = state

        logger.info({ failOnRemoteRpcUnavailable, diffThreshold }, '[localVsRemote]: strategy configured')

        state.initialized = true
    }
}

export const heightDiffMetric = new Gauge({
    name: "blockchain_height_diff",
    help: "Difference between local and remote from sidecar point of view",
    labelNames: ["chainID", "threshold"],
});
