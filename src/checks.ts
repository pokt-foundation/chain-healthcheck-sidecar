import { logger } from ".";
import { performRemoteChecks, chainID } from "./common";
import { currentHeightRequestStrategy } from "./height-strategies";
import { sidecarState } from "./state";
import { Gauge } from "prom-client";
import { currentProbeStrategies, ProbeStrategy } from "./probe-strategies";

// const {
//     STALE_HEIGHT_CHECK_ENABLED,
//     STALE_HEIGHT_CHECK_HISTORY_LENGTH,
// } = process.env;

// // Whether to turn off stale height check
// export const staleHeightCheckEnabled = STALE_HEIGHT_CHECK_ENABLED === "false" ? false : true
// // Length of block height history to maintain. Each check is an element in the array.
// // So if length is 100, and we perform check each 15 seconds,
// // it will take 25 minutes to populate the history and determine whether the node is not climbing.
// export const staleHeightCheckHistoryLength = Number(STALE_HEIGHT_CHECK_HISTORY_LENGTH || 70)
// const heightHistory = []

export const performChecks = async () => {
    await updateHeightLocal()
    if (performRemoteChecks) {
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

        // If remote RPC call is not successful, we should probably ignore the difference between local & remote.
        // So we don't end up in a situation when oracles went bad and our service degrades because of that.
        // if (sidecarState.localRpcInitiated) {
        sidecarState.remoteRpcUnstable = true;
        // }
    }
}

// export const staleHeightCheck = async () => {
//     if (sidecarStatus.localHeight < 0) {
//         logger.info("[STALE_HEIGHT_CHECK]: Skipped - local height is negative, meaning local node is not available")
//         return
//     }

//     if (heightHistory.length >= staleHeightCheckHistoryLength) {
//         // Remove first (oldest) result from history
//         heightHistory.shift()

//         // Add new result to the end of the array
//         heightHistory.push(sidecarStatus.localHeight)

//         // If all elements in `heightHistory` are the same, set `isNotClimbing` to true.
//         if (heightHistory.every(val => val === heightHistory[0])) {
//             logger.debug({ heightHistory, isNotClimbing: sidecarStatus.isNotClimbing, staleHeightCheckHistoryLength })
//             logger.warn("[STALE_HEIGHT_CHECK]: All block heights in history are the same - the node is not climbing")
//             sidecarStatus.isNotClimbing = true
//         } else {
//             sidecarStatus.isNotClimbing = false
//         }
//     } else {
//         // Add new result to the end of the array
//         heightHistory.push(sidecarStatus.localHeight)
//     }
// }



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
