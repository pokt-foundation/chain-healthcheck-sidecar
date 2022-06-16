import { logger } from ".."
import { ProbeStrategy } from "./index"

const alwaysFailure: ProbeStrategy = {
    name: 'alwaysFailure',
    // backgroundProcessing: async () => { },
    httpHandler: (_req, res) => {
        return res.status(500).send('Returning alwaysFailure strategy result')
    },
    init: async () => {
        logger.info(`alwaysFailure strategy has been loaded. Is this intentional?`)
    }
}

export default alwaysFailure
