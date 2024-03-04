import axios from "axios"; // Optional if you need it for other REST calls
import { HeightStrategy } from ".";
import { logger } from "..";
import { localRPCWrapper, remoteRPCIterator } from "../common";
import { GraphQLClient, request } from 'graphql-request';

const getHeight = async (url: string) => {
    const result = await axios({
        method: "POST",
        url: `${url}/v1/query/height`,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        data: {},
        timeout: 5000
    })

    const { data } = result

    logger.debug({ data }, 'response from pocket RPC')

    const { height } = data

    if (typeof height === 'number') {
        return height
    } else {
        return parseInt(height)
    }
}

// PoktScan GraphQL-based height fetching logic

interface GetLatestBlockResponse {
    GetLatestBlock: {
        block: {
            height: number;
            time: string; // Or whatever the actual type of 'time' is
        }
    }
}

const getPoktscanHeight = async () => {
    const query = `
    {
        GetLatestBlock {
            block {
                height
                time
            }
        }
    }
    `;

    const headers = {
        'authorization': process.env.POKTSCAN_API_KEY
    }

    try {
        const client = new GraphQLClient(process.env.POKTSCAN_ENDPOINT, { headers });
        const data: GetLatestBlockResponse = await client.request(query);
        return data.GetLatestBlock.block.height;

    } catch (error) {
        logger.error('Error fetching height from Poktscan:', error);
        throw error;
    }
}

const pocket: HeightStrategy = {
    name: 'pocket',
    getLocalHeight: () => localRPCWrapper(getHeight),
    getRemoteHeight: () => {
        if (process.env.USE_POKTSCAN === 'true') {
            return getPoktscanHeight();
        } else {
            return remoteRPCIterator(getHeight);
        }
    },
    init: async () => {
        const strategy = process.env.USE_POKTSCAN === 'true' ? 'Poktscan' : 'REST';
        logger.info(`Pocket height check strategy initiated (using ${strategy})`);
    }
}

export default pocket
