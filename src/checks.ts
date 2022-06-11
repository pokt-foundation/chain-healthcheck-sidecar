import { logger } from ".";
import { currentHeightRequestStrategy } from "./height-strategies";
import { sidecarState } from "./state";
import { Gauge } from "prom-client";
import { currentProbeStrategies } from "./probe-strategies";

export const performChecks = async () => {
    await updateHeightLocal()
    if (sidecarState.performRemoteChecks) {
        await updateHeightRemote()
    }

    const { readiness, liveness, startup } = currentProbeStrategies
    const strategies = [readiness, liveness, startup]
    const uniq = new Set<string>()

    strategies.forEach((st) => {
        const { name } = st
        if (uniq.has(name)) {
            logger.debug({ name }, 'background job for this strategy has already been executed/scheduled, skip')
            // background job for this strategy has already been executed/scheduled, skip
            return
        }
        uniq.add(name)
        st.backgroundProcessing ? st.backgroundProcessing() : null
    })
}

export const updateHeightLocal = async () => {
    const { getLocalHeight } = currentHeightRequestStrategy
    const { chainID } = sidecarState
    sidecarState.lastLocalNodeHeight = await getLocalHeight();

    // Negative height means RPC is not available.
    if (sidecarState.lastLocalNodeHeight > 0) {
        localHeightMetric.labels({ chainID }).set(sidecarState.lastLocalNodeHeight);

        if (!sidecarState.localRpcAvailable) {
            logger.info('[UPDATE_HEIGHT]: local RPC became available - setting localRpcAvailable to true')
        }
        sidecarState.localRpcAvailable = true;

        // If rpc ever got available - mark node as initialized.
        sidecarState.localRpcInitiated = true;
    } else {
        if (sidecarState.localRpcAvailable) {
            logger.info('[UPDATE_HEIGHT]: local RPC is unavailable - setting localRpcAvailable to false')
        }
        sidecarState.localRpcAvailable = false;
    }
}

export const updateHeightRemote = async () => {
    const { getRemoteHeight } = currentHeightRequestStrategy
    const { chainID } = sidecarState
    sidecarState.lastRemoteNodeHeight = await getRemoteHeight()
    if (sidecarState.lastRemoteNodeHeight > 0) {
        remoteHeightMetric.labels({ chainID }).set(sidecarState.lastRemoteNodeHeight)

        if (sidecarState.remoteRpcUnstable) {
            logger.info({ sidecarState }, '[UPDATE_HEIGHT]: remote RPC became available - setting remoteRpcUnstable to false')
        }
        sidecarState.remoteRpcUnstable = false;
    } else {
        if (!sidecarState.remoteRpcUnstable) {
            logger.info({ sidecarState }, '[UPDATE_HEIGHT]: remote RPC is no longer available - setting remoteRpcUnstable to true')
        }
        sidecarState.remoteRpcUnstable = true;
    }
}

export const localHeightMetric = new Gauge({
    name: "blockchain_local_node_height",
    help: "Local blockchain node height",
    labelNames: ["chainID"],
});

export const remoteHeightMetric = new Gauge({
    name: "blockchain_remote_node_height",
    help: "Remote blockchain node height",
    labelNames: ["chainID"],
});
