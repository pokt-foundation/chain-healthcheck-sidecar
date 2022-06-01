import { logger } from '.';

const {
    SIDECAR_CHAIN_ID,
} = process.env;

export const sidecarChainID = () => {
    if (!SIDECAR_CHAIN_ID) {
        logger.error(`SIDECAR_CHAIN_ID is not set.`)
    }
    return SIDECAR_CHAIN_ID
}