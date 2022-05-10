import harmony0 from './0040'
import etherium from './0021'
import { sidecarChainID } from './common';

export interface Chain {
    id: string,
    name: string;
    getLocalHeight: () => Promise<number>;
    getRemoteHeight: () => Promise<number>;
}

const allChains: Chain[] = [harmony0, etherium]

export const chainByID = (id: string) => {
    return allChains.find(ch => ch.id === id)
}

export const currentChain = chainByID(sidecarChainID())

export const chains = allChains