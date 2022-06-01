import { getHeightEVM } from './strategies/evm'
import { localRPCEndpoint, localRPCWrapper, remoteRPCIterator } from './strategies/'

const REMOTE_ENDPOINTS = [
    "https://rpc.s0.t.hmny.io"
]

export default {
    id: '0040',
    name: 'Harmony Shard 0',
    getLocalHeight: () => localRPCWrapper(getHeightEVM, localRPCEndpoint(), 'hmyv2_blockNumber'),
    getRemoteHeight: () => remoteRPCIterator(REMOTE_ENDPOINTS, getHeightEVM, 'hmyv2_blockNumber')
} 
