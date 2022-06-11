import { logger } from '.';
import { sidecarState } from './state';
import { Counter } from "prom-client";

export const requireEnvar = (envar: string) => {
    if (!process.env[envar]) {
        logger.error(`${envar} is not set.`)
    }
    return process.env[envar]
}

export const remoteRPCIterator = async (handler: (...any) => Promise<number>, ...args) => {
    const { remoteRPCEndpoints: rpcs, chainID } = sidecarState

    for (let i = 0; i < rpcs.length; i++) {
        const destination = rpcs[i]
        try {
            return await handler(rpcs[i], ...args)
        } catch (error) {
            failedRpcChecks.labels({ chainID, destination }).inc()
            logger.error({ error, destination }, `unavailable, trying next one..`)
        }
    }

    logger.error(`No remotes are available`)
    return -1
}

export const localRPCWrapper = async (handler: (...any) => Promise<number>, ...args) => {
    const { localRPCEndpoint: destination, chainID } = sidecarState

    try {
        return await handler(...args)
    } catch (error) {
        // Only count errors after the node has been initialized.
        if (sidecarState.localRpcInitiated) {
            failedRpcChecks.labels({ chainID, destination }).inc()
        }
        logger.error({ error, destination }, `Local blockchain node is unavailable`)
        return -1
    }
}

const failedRpcChecks = new Counter({
    name: "blockchain_rpc_check_errors",
    help: "RPC checks errors",
    labelNames: ["destination", "chainID"],
});