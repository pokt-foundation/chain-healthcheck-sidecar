import { logger, sidecarStatus } from "../.."
import { sidecarChainID } from "../../common"
import { failedRpcChecks } from "../../metrics"

const {
    LOCAL_RPC_ENDPOINT,
} = process.env;

export const remoteRPCIterator = async (rpcs: string[], handler: (...any) => Promise<number>, ...args) => {
    for (let i = 0; i < rpcs.length; i++) {
        try {
            return await handler(rpcs[i], ...args)
        } catch (error) {
            failedRpcChecks.labels({ chain_id: sidecarChainID(), destination: rpcs[i] }).inc()
            logger.error({ error }, `${rpcs[i]} is unavailable, trying next one..`)
        }
    }

    logger.error(`No remotes are available`)
    return -1
}

export const localRPCWrapper = async (handler: (...any) => Promise<number>, ...args) => {
    try {
        return await handler(...args)
    } catch (error) {
        // Only count errors after the node has been initialized.
        if (sidecarStatus.localNodeInitialized) {
            failedRpcChecks.labels({ chain_id: sidecarChainID(), destination: 'local' }).inc()
        }
        logger.error({ error }, `Local blockchain node is unavailable`)
        return -1
    }
}

export const localRPCEndpoint = () => {
    if (!LOCAL_RPC_ENDPOINT) {
        logger.error(`LOCAL_RPC_ENDPOINT is not set.`)
    }
    return LOCAL_RPC_ENDPOINT
}