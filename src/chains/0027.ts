import { getHeightEVM } from './strategies/evm'
import { localRPCEndpoint, localRPCWrapper, remoteRPCIterator } from './strategies/'

const REMOTE_ENDPOINTS = [
    "https://rpc.gnosischain.com/",
    "https://xdai.poanetwork.dev/",
]

export default {
    id: '0027',
    name: 'Gnosis - xDai',
    getLocalHeight: () => localRPCWrapper(getHeightEVM, localRPCEndpoint()),
    getRemoteHeight: () => remoteRPCIterator(REMOTE_ENDPOINTS, getHeightEVM)
} 
