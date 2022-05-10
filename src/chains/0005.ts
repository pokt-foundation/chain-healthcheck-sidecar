import { getHeightEVM, localRPCEndpoint, localRPCWrapper, remoteRPCIterator } from './common'

const REMOTE_ENDPOINTS = [
    "https://rpc.fuse.io/",
]

export default {
    id: '0005',
    name: 'FUSE Mainnet',
    getLocalHeight: () => localRPCWrapper(getHeightEVM, localRPCEndpoint()),
    getRemoteHeight: () => remoteRPCIterator(REMOTE_ENDPOINTS, getHeightEVM)
} 
