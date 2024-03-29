const {
    INTERVAL_SECONDS,
} = process.env;

interface SidecarState {
    lastLocalNodeHeight: number,
    lastRemoteNodeHeight: number,

    // If last request succeeded or not
    localRpcAvailable: boolean,

    // If we got at least one successful request to the local rpc
    localRpcInitiated: boolean,

    // If remote RPC is not available - we might not want to take drastic actions such as take the node out of the rotation
    remoteRpcUnstable: boolean,

    // Global settings
    chainID?: string,
    localRPCEndpoint?: string,
    remoteRPCEndpoints?: string[],
    performRemoteChecks?: boolean,
    checkIntervalMs: number,
}

export const sidecarState: SidecarState = {
    lastLocalNodeHeight: -10,
    lastRemoteNodeHeight: -10,
    localRpcAvailable: false,
    localRpcInitiated: false,
    remoteRpcUnstable: false,
    checkIntervalMs: Number(INTERVAL_SECONDS || 15) * 1000,
}
