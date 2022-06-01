import { getHeightEVM } from './strategies/evm'
import { localRPCEndpoint, localRPCWrapper, remoteRPCIterator } from './strategies/'

// https://docs.polygon.technology/docs/develop/network-details/network/
const REMOTE_ENDPOINTS = [
    'https://polygon-rpc.com/',
    'https://rpc-mainnet.matic.network/',
    'https://matic-mainnet.chainstacklabs.com/',
]

export default {
    id: '0009',
    name: 'Polygon Mainnet',
    getLocalHeight: () => localRPCWrapper(getHeightEVM, localRPCEndpoint()),
    getRemoteHeight: () => remoteRPCIterator(REMOTE_ENDPOINTS, getHeightEVM),
}