import { getHeightEVM, localRPCEndpoint, remoteRPCIterator } from '@chains/common'

// TODO: add Etherium RPC remotes we can use as oracles.
const REMOTE_ENDPOINTS = []

export default {
    id: '0021',
    name: 'Etherium',
    getLocalHeight: () => getHeightEVM(localRPCEndpoint()),
    getRemoteHeight: () => remoteRPCIterator(REMOTE_ENDPOINTS, getHeightEVM),
}