import { logger } from "..";
import evm from "./evm";

const {
    HEIGHT_CHECK_STRATEGY,
} = process.env;

export interface HeightStrategy {
    // chainId: string,
    name: string;
    getLocalHeight: () => Promise<number>;
    getRemoteHeight: () => Promise<number>;
    init?: () => Promise<void>
}

export const availableHeightRequestStrategies: HeightStrategy[] = [evm]

const pickStrategy = (name) => {
    const strategy = availableHeightRequestStrategies.find(st => st.name === name)
    if (strategy) {
        return strategy
    }

    const err = new Error(`Height request strategy with name "${name}" not found. We need to know how to query height of the local blockchain node.`)
    logger.error(err)
    throw err
}

export const currentHeightRequestStrategy = pickStrategy(HEIGHT_CHECK_STRATEGY)