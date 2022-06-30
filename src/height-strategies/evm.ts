import axios, { AxiosResponse } from "axios"
import { HeightStrategy } from "."
import { logger } from ".."
import { localRPCWrapper, remoteRPCIterator } from "../common"

const {
    // use `hmyv2_blockNumber` for Harmony
    EVM_BLOCK_NUMBER_METHOD_NAME,
    EVM_BLOCK_NUMBER_FIELD_PATH
} = process.env;

const method = EVM_BLOCK_NUMBER_METHOD_NAME || 'eth_blockNumber'
const fieldPath = EVM_BLOCK_NUMBER_FIELD_PATH || 'result'

/** Gets an object value from a period-delimited string path. eg. "result.healthy" */
const resolvePath = (response: AxiosResponse, path: string) =>
    path.split('.').reduce((p, c) => (p && p[c]) ?? null, response);

const getHeightEVM = async (url: string) => {
    const result = await axios({
        method: "POST",
        url,
        data: {
            jsonrpc: "2.0",
            id: 1,
            method,
            params: [],
        },
        timeout: 5000
    })

    const { data } = result
    const blockNumber = resolvePath(data, fieldPath)

    logger.debug({ data, url, method }, 'response from EVM RPC')

    if (typeof blockNumber === 'number') {
        return blockNumber
    } else {
        return parseInt(blockNumber, 16)
    }
}

const evm: HeightStrategy = {
    name: 'evm',
    getLocalHeight: () => localRPCWrapper(getHeightEVM),
    getRemoteHeight: () => remoteRPCIterator(getHeightEVM),
    init: async () => {
        logger.info(`EVM height check strategy initiated with "${method}" RPC method`)
    }
}

export default evm