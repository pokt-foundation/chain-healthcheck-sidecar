import { logger, sidecarStatus } from ".";
import { currentChain } from "./chains";
import { heightDiffMetric, localHeightMetric, remoteHeightMetric } from "./metrics";
import { diffThreshold } from "./probes";

const {
    STALE_HEIGHT_CHECK_ENABLED,
    STALE_HEIGHT_CHECK_HISTORY_LENGTH,
} = process.env;

// Whether to turn off stale height check
export const staleHeightCheckEnabled = STALE_HEIGHT_CHECK_ENABLED === "false" ? false : true
// Length of block height history to maintain. Each check is an element in the array.
// So if length is 100, and we perform check each 15 seconds,
// it will take 25 minutes to populate the history and determine whether the node is not climbing.
export const staleHeightCheckHistoryLength = Number(STALE_HEIGHT_CHECK_HISTORY_LENGTH || 70)
const heightHistory = []

export const performChecks = async () => {
    await updateHeight()
    await diffCheck()
    await staleHeightCheck()
}

export const updateHeight = async () => {
    const { id: chain_id, getLocalHeight, getRemoteHeight } = currentChain
    sidecarStatus.localHeight = await getLocalHeight();

    if (sidecarStatus.localHeight > 0) {
        localHeightMetric.labels({ chain_id }).set(sidecarStatus.localHeight);
    }

    sidecarStatus.remoteHeight = await getRemoteHeight()

    if (sidecarStatus.localHeight > 0) {
        remoteHeightMetric.labels({ chain_id }).set(sidecarStatus.remoteHeight)
    }
}

export const diffCheck = async () => {
    const { id: chain_id } = currentChain

    // Negative height means node is not ready.
    if (sidecarStatus.localHeight > 0) {
        if (!sidecarStatus.localRPCReady) {
            logger.info('[DIFF_CHECK]: local RPC became available - setting localRPCReady to true')
        }
        sidecarStatus.localRPCReady = true;
    } else {
        if (sidecarStatus.localRPCReady) {
            logger.info('[DIFF_CHECK]: local RPC is unavailable - setting localRPCReady to false')
        }
        sidecarStatus.localRPCReady = false;
    }

    // If remote RPC call is not successful, we should probably ignore the difference between local & remote.
    // So we don't end up in a situation when oracles went bad and our service degrades because of that.
    if (sidecarStatus.remoteHeight < 0) {
        if (!sidecarStatus.monitoringIsUnstable) {
            logger.info({ sidecarStatus }, '[DIFF_CHECK]: remote RPC is no longer available - setting monitoringIsUnstable to true')
        }
        sidecarStatus.monitoringIsUnstable = true;
    } else {
        if (sidecarStatus.monitoringIsUnstable) {
            logger.info({ sidecarStatus }, '[DIFF_CHECK]: remote RPC became available - setting monitoringIsUnstable to false')
        }
        sidecarStatus.monitoringIsUnstable = false;
    }

    if (sidecarStatus.localHeight > 0 && sidecarStatus.remoteHeight > 0) {
        sidecarStatus.currentDiff = sidecarStatus.remoteHeight - sidecarStatus.localHeight;
        heightDiffMetric.set({ chain_id, threshold: String(diffThreshold) }, sidecarStatus.currentDiff)
    }

    logger.debug({ sidecarStatus }, '[DIFF_CHECK]: check finished')
}

export const staleHeightCheck = async () => {
    if (sidecarStatus.localHeight < 0) {
        logger.info("[STALE_HEIGHT_CHECK]: Skipped - local height is negative, meaning local node is not available")
        return
    }

    if (heightHistory.length >= staleHeightCheckHistoryLength) {
        // Remove first (oldest) result from history
        heightHistory.shift()

        // Add new result to the end of the array
        heightHistory.push(sidecarStatus.localHeight)

        // If all elements in `heightHistory` are the same, set `isNotClimbing` to true.
        if (heightHistory.every(val => val === heightHistory[0])) {
            logger.debug({ heightHistory, isNotClimbing: sidecarStatus.isNotClimbing, staleHeightCheckHistoryLength })
            logger.warn("[STALE_HEIGHT_CHECK]: All block heights in history are the same - the node is not climbing")
            sidecarStatus.isNotClimbing = true
        } else {
            sidecarStatus.isNotClimbing = false
        }
    } else {
        // Add new result to the end of the array
        heightHistory.push(sidecarStatus.localHeight)
    }
}