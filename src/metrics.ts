import { Counter, Gauge } from "prom-client";

export const localHeightMetric = new Gauge({
    name: "blockchain_local_node_height",
    help: "Local blockchain node height",
    labelNames: ["chain_id"],
});

export const remoteHeightMetric = new Gauge({
    name: "blockchain_remote_node_height",
    help: "Remote blockchain node height",
    labelNames: ["chain_id"],
});

export const heightDiffMetric = new Gauge({
    name: "blockchain_height_diff",
    help: "Difference between local and remote from sidecar point of view",
    labelNames: ["chain_id", "threshold"],
});

export const failedRpcChecks = new Counter({
    name: "blockchain_rpc_check_errors",
    help: "RPC checks errors",
    labelNames: ["destination", "chain_id"],
});