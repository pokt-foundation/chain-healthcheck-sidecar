import evm from "./evm";
import pocket from "./pocket";

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

export const availableHeightRequestStrategies: HeightStrategy[] = [evm, pocket]

const pickStrategy = (name) => {
    const strategy = availableHeightRequestStrategies.find(st => st.name === name)
    if (strategy) {
        return strategy
    }

    throw new Error(`Height request strategy with name "${name}" not found. We need to know how to query height of the local blockchain node. Check HEIGHT_CHECK_STRATEGY envar.`)
}

export const currentHeightRequestStrategy = pickStrategy(HEIGHT_CHECK_STRATEGY)