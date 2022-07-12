import axios from "axios"
import { HeightStrategy } from "."
import { logger } from ".."
import { localRPCWrapper, remoteRPCIterator } from "../common"

const getHeight = async (url: string) => {
    const result = await axios({
        "method": "POST",
        "url": `${url}/v1/query/height`,
        "headers": {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        "data": {}
    })

    const { data } = result

    logger.debug({ data }, 'response from EVM RPC')

    const { height } = data

    if (typeof height === 'number') {
        return height
    } else {
        return parseInt(height)
    }
}

const evm: HeightStrategy = {
    name: 'pocket',
    getLocalHeight: () => localRPCWrapper(getHeight),
    getRemoteHeight: () => remoteRPCIterator(getHeight),
    init: async () => {
        logger.info(`Pocket height check strategy initiated`)
    }
}

export default evm