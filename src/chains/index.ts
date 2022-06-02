import harmony0 from './0040'
import ethMain from './0021'
import fuseMain from './0005'
import polygonMain from './0009'
import gnosis from './0027'

import { sidecarChainID } from '../common';
import { logger } from '..';

export interface Chain {
    id: string,
    name: string;
    getLocalHeight: () => Promise<number>;
    getRemoteHeight: () => Promise<number>;
}

const allChains: Chain[] = [harmony0, ethMain, fuseMain, polygonMain, gnosis]

export const chainByID = (id: string) => {
    const chain = allChains.find(ch => ch.id === id)
    if (chain) {
        return chain
    }

    logger.error({ id, supportedChains: allChains.map((c) => c.id) }, "current version of the sidecar container doesn't support this chain")
}

export const currentChain = chainByID(sidecarChainID())

export default allChains