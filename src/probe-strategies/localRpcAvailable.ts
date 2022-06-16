import { logger } from ".."
import { sidecarState } from "../state"
import { ProbeStrategy } from "./index"

export const localRpcAvailable: ProbeStrategy = {
    name: 'localRpcAvailable',
    httpHandler: (_req, res) => {
        const {
            localRpcAvailable,
        } = sidecarState;

        if (!localRpcAvailable) {
            logger.info({ localRpcAvailable }, '[localRpcAvailable]: Failing a health-check as local RPC is available')
            return res.status(503).send(`[localRpcAvailable]: Failing a health-check as local RPC is available`);
        }

        return res
            .status(200)
            .send(
                `Local RPC is available.`
            );
    },
    init: async () => {
        logger.info('[localRpcAvailable]: strategy configured')
    }
}

export default localRpcAvailable