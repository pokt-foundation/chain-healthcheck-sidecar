import axios from "axios"
import { HeightStrategy } from "."
import { logger } from ".."
import { localRPCWrapper, remoteRPCIterator } from "../common"

const {
    // use `hmyv2_blockNumber` for Harmony
    EVM_BLOCK_NUMBER_METHOD_NAME
} = process.env;

const method = EVM_BLOCK_NUMBER_METHOD_NAME || 'eth_blockNumber'

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

    logger.debug({ data, url, method }, 'response from EVM RPC')

    if (typeof data.result === 'number') {
        return data.result
    } else {
        return parseInt(data.result, 16)
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