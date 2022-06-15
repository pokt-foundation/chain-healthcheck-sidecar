import { logger } from ".."
import { sidecarState } from "../state"
import { ProbeStrategy } from "./index"
import { state as localVsRemoteState } from "./localVsRemote";

const {
    COUNT_LOCAL_RPC_FAILS_AS_STALE_HEIGHT,
    STALE_HEIGHT_CHECK_HISTORY_LENGTH,
    IGNORE_HALTED_BLOCKCHAIN,
} = process.env;

export const state = {
    heightHistory: [],

    // Length of block height history to maintain. Each check is an element in the array.
    // So if length is 100, and we perform check each 15 seconds,
    // it will take 25 minutes to populate the history and determine whether the node is not climbing.
    // Default: 70 (with 15s interval eq. 1050 seconds)
    staleHeightCheckHistoryLength: Number(STALE_HEIGHT_CHECK_HISTORY_LENGTH || 70),

    // If local RPC is unavailable, count it as stale height as well
    // Default: false
    countLocalRpcFailsAsStaleHeight: COUNT_LOCAL_RPC_FAILS_AS_STALE_HEIGHT === "true" ? true : false,

    // Ignore an edge-case when the node is stalled, but the whole blockchain, according to oracle(s),
    // is having issues.
    ignoreHaltedBlockchain: IGNORE_HALTED_BLOCKCHAIN === "true" ? true : false,

    isNotClimbing: false
}

const heightNotClimbing: ProbeStrategy = {
    name: 'heightNotClimbing',
    backgroundProcessing: async () => {
        const { lastLocalNodeHeight } = sidecarState
        const { countLocalRpcFailsAsStaleHeight, heightHistory, staleHeightCheckHistoryLength, isNotClimbing } = state

        if (sidecarState.lastLocalNodeHeight < 0 && !countLocalRpcFailsAsStaleHeight) {
            logger.info("[STALE_HEIGHT_CHECK]: Skipped - local height is negative, meaning local node is not available, and COUNT_LOCAL_RPC_FAILS_AS_STALE_HEIGHT is false.")
            return
        }

        if (heightHistory.length >= staleHeightCheckHistoryLength) {
            // Remove first (oldest) result from history
            heightHistory.shift()

            // If all elements in `heightHistory` are the same, set `isNotClimbing` to true.
            if (heightHistory.every(val => val === heightHistory[0])) {
                logger.debug({ heightHistory, isNotClimbing, staleHeightCheckHistoryLength })
                logger.warn("[STALE_HEIGHT_CHECK]: All block heights in history are the same - the node is not climbing")
                state.isNotClimbing = true
            } else {
                state.isNotClimbing = false
            }
        }

        // Add new result to the end of the array
        heightHistory.push(lastLocalNodeHeight)

        logger.debug({ sidecarState }, '[heightNotClimbing]: Check finished')
    },
    httpHandler: (_req, res) => {
        const {
            localRpcAvailable,
            lastLocalNodeHeight,
            remoteRpcUnstable
        } = sidecarState;

        const { isNotClimbing, ignoreHaltedBlockchain } = state

        if (!localRpcAvailable) {
            logger.info({ lastLocalNodeHeight, localRpcAvailable }, '[heightNotClimbing]: Failing a health-check as local RPC is not ready')
            return res.status(503).send(`RPC not ready, lastLocalNodeHeight: ${lastLocalNodeHeight}`);
        }

        if (isNotClimbing) {
            // Edge case: whole blockchain is halted. In that case the assumption is we don't want to restart the nodes.
            // For this to happen: monitoring should be stable, difference should be within threshold
            const { initialized: localVsRemoteInitialized, currentDiff, diffThreshold } = localVsRemoteState
            const canIgnoreStaledNode = remoteRpcUnstable && ignoreHaltedBlockchain && localVsRemoteInitialized && currentDiff <= diffThreshold

            if (canIgnoreStaledNode) {
                logger.info('[LIVENESS_PROBE]: Even though the node is not climbing, the diff is OK - assuming network-wide issues.')
                return res.status(200).send(`The node is not climbing but this seems to be a network-wide issue.`);
            }

            return res.status(503).send(`The node is not climbing`);
        } else {
            return res.status(200).send('OK')
        }

    },
    init: async () => {
        const { performRemoteChecks, checkIntervalMs } = sidecarState

        if (!performRemoteChecks) {
            const err = new Error('Remote RPCs are required for heightNotClimbing strategy. Check configuration.')
            logger.error(err)
            throw err
        }

        logger.info({ state }, `[heightNotClimbing]: strategy configured. Approximate time from first block stuck to failing the check: ${checkIntervalMs / 1000 * state.staleHeightCheckHistoryLength} seconds. Make sure this number is larger than block time, otherwise check will always fail thinking the node is not climbing.`)
    }
}

export default heightNotClimbing
