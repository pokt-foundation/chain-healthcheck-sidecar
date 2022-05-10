import axios from 'axios'
import { logger } from '../index';
import { Counter } from 'prom-client';

const {
    LOCAL_RPC_ENDPOINT,
    SIDECAR_CHAIN_ID,
} = process.env;

export const failedRpcChecks = new Counter({
    name: "blockchain_rpc_check_errors",
    help: "RPC checks errors",
    labelNames: ["destination", "chain_id"],
});

export const getHeightEVM = async (rpc: string, method = 'eth_blockNumber') => {
    const result = await axios({
        method: "POST",
        url: rpc,
        data: {
            jsonrpc: "2.0",
            id: 1,
            method,
            params: [],
        },
    })

    const { data } = result

    logger.debug({ data, rpc, method }, 'response from EVM RPC')

    return data.result as number
}

export const remoteRPCIterator = async (rpcs: string[], handler: (...any) => Promise<number>, ...args) => {
    for (let i = 0; i < rpcs.length; i++) {
        try {
            return await handler(rpcs[i], ...args)
        } catch {
            failedRpcChecks.labels({ chain_id: sidecarChainID(), destination: rpcs[i] }).inc()
            logger.error(`${rpcs[i]} is unavailable, trying next one..`)
        }
    }

    logger.error(`No remotes are available`)
    return -1
}

export const localRPCWrapper = async (handler: (...any) => Promise<number>, ...args) => {
    try {
        return await handler(...args)
    } catch {
        failedRpcChecks.labels({ chain_id: sidecarChainID(), destination: 'local' }).inc()
        logger.error(`Local blockchain node is unavailable`)
        return -1
    }
}

export const localRPCEndpoint = () => {
    if (!LOCAL_RPC_ENDPOINT) {
        logger.error(`LOCAL_RPC_ENDPOINT is not set.`)
    }
    return LOCAL_RPC_ENDPOINT
}

export const sidecarChainID = () => {
    if (!SIDECAR_CHAIN_ID) {
        logger.error(`SIDECAR_CHAIN_ID is not set.`)
    }
    return SIDECAR_CHAIN_ID
}