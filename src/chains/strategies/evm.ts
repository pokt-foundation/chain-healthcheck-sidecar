import axios from "axios"
import { logger } from "../.."

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
        timeout: 5000
    })

    const { data } = result

    logger.debug({ data, rpc, method }, 'response from EVM RPC')

    if (typeof data.result === 'number') {
        return data.result
    } else {
        return parseInt(data.result, 16)
    }
}