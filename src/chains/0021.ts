import { getHeightEVM, localRPCEndpoint, localRPCWrapper, remoteRPCIterator } from '../common'

const REMOTE_ENDPOINTS = [
    'https://eth-rpc.gateway.pokt.network',
]

export default {
    id: '0021',
    name: 'Etherium Mainnet',
    getLocalHeight: () => localRPCWrapper(getHeightEVM, localRPCEndpoint()),
    getRemoteHeight: () => remoteRPCIterator(REMOTE_ENDPOINTS, getHeightEVM),
}