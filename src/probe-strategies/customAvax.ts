import axios from "axios";
import { logger } from ".."
import { sidecarState } from "../state"
import { ProbeStrategy } from "./index"

const {
    AVAX_HEALTH_ENDPOINT,
} = process.env;

export const state = {
    endpoint: AVAX_HEALTH_ENDPOINT || "http://127.0.0.1:9650/ext/health",
    lastResponseSuccess: false,
    lastResponse: null,
}

const customAvax: ProbeStrategy = {
    name: 'customAvax',
    backgroundProcessing: async () => {
        const { endpoint: url } = state
        try {
            const result = await axios({
                method: "POST",
                url,
                data: {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "health.health",
                },
                timeout: 5000
            })

            const { data } = result
            state.lastResponse = data
            state.lastResponseSuccess = true

            logger.debug({ data, url }, '[customAvax]: response from Avax')

        } catch (error) {
            state.lastResponseSuccess = false
            logger.error({ error: error.message }, '[customAvax]: Check failed')
        }

        logger.debug({ sidecarState }, '[customAvax]: Check finished')
    },
    httpHandler: (_req, res) => {
        const { lastResponseSuccess, lastResponse } = state
        const isHealthy = lastResponseSuccess && lastResponse && lastResponse.result && lastResponse.result.healthy

        if (!lastResponseSuccess) {
            const msg = `Node does not respond successfully on health endpoint`
            logger.error(msg)
            return res.status(503).send(msg);
        }

        if (!isHealthy) {
            const msg = `Node is not healthy`
            logger.error(msg)
            return res.status(503).send(msg);
        }

        return res.status(200).send('OK')
    },
    init: async () => {
        logger.info({ state }, `[customAvax]: strategy configured.`)
    }
}

export default customAvax
