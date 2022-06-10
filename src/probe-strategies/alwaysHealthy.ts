import { ProbeStrategy } from "./index"

const alwaysHealthy: ProbeStrategy = {
    name: 'alwaysHealthy',
    // backgroundProcessing: async () => { },
    httpHandler: (_req, res) => {
        return res.status(200).send('Always healthy')
    }
}

export default alwaysHealthy
