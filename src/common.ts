import { logger } from '.';
import { sidecarState } from './state';
import { Counter } from "prom-client";

export const requireEnvar = (envar: string) => {
    if (!process.env[envar]) {
        logger.error(`${envar} is not set.`)
    }
    return process.env[envar]
}

export const chainID = requireEnvar('SIDECAR_CHAIN_ID')
export const localRPCEndpoint = requireEnvar('LOCAL_RPC_ENDPOINT')
export const remoteRPCEndpoints = (requireEnvar('REMOTE_RPC_ENDPOINTS') || '').split(',')
export const performRemoteChecks = remoteRPCEndpoints.length != 0

export const remoteRPCIterator = async (handler: (...any) => Promise<number>, ...args) => {
    const rpcs = remoteRPCEndpoints

    for (let i = 0; i < rpcs.length; i++) {
        try {
            return await handler(rpcs[i], ...args)
        } catch (error) {
            failedRpcChecks.labels({ chainID, destination: rpcs[i] }).inc()
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
        if (sidecarState.localRpcInitiated) {
            failedRpcChecks.labels({ chainID, destination: localRPCEndpoint }).inc()
        }
        logger.error({ error }, `Local blockchain node is unavailable`)
        return -1
    }
}

const failedRpcChecks = new Counter({
    name: "blockchain_rpc_check_errors",
    help: "RPC checks errors",
    labelNames: ["destination", "chainID"],
});