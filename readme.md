<div align="center">
  <a href="https://www.pokt.network">
    <img src="https://user-images.githubusercontent.com/16605170/74199287-94f17680-4c18-11ea-9de2-b094fab91431.png" alt="Pocket Network logo" width="340"/>
  </a>
</div>

# chain-healthcheck-sidecar

Sidecar service to perform health-checks of different blockchain nodes.

## Overview

`chain-healthcheck-sidecar` runs periodic checks against blockchain node and exposes different health-check endpoints so container orchestration solutions (such as Kubernetes) can be aware of health of blockchain node and issue restarts, take it our of the rotation, etc. 

Different chains and check strategies are supported.

## Getting Started

The easiest way to get started is to use the [`eepokt/chain-healthcheck-sidecar`](https://hub.docker.com/r/eepokt/chain-healthcheck-sidecar) image. You can pass configuration parameters using [environment variables](#configuration).


### Height check strategies

Local and remote RPC can be queried using different height check strategies. Many chains support evm-like RPC and we make use of that. Sometimes, blockchain RPCs expose different APIs and we need to use a different strategy. You can check currently supported strategies [here](/src/height-strategies/). They might have additional configuration parameters.

### Probe strategies

`chain-healthcheck-sidecar` exposes readiness, liveness, and startup probe endpoints. You can assign any strategy to any endpoint via `*_PROBE_STRATEGY` environment variables. Currently supported strategies are listed [here](/src/probe-strategies/). Commonly used ones are:
* `alwaysFailure` - always return `500` error; 
* `alwaysHealthy` - always return `200 OK`; 
* `localRpcAvailable` - returns `200` if last RPC call to local node was successful; 
* `localVsRemote` - returns `200` local node is up-to-date with remote node/oracle; Requires configuration such as `REMOTE_RPC_ENDPOINTS` and  `HEIGHT_DIFF_THRESHOLD`. Has additional config parameters: `HEIGHT_DIFF_THRESHOLD`, `FAIL_ON_REMOTE_RPC_UNAVAILABLE`.
* `heightNotClimbing` - records last `STALE_HEIGHT_CHECK_HISTORY_LENGTH` height check results. If all checks have similar result, then node considered as unhealthy as it stopped climbing. It is important to have `STALE_HEIGHT_CHECK_HISTORY_LENGTH` * `INTERVAL_SECONDS` larger than block time of the chain, otherwise all block heights recorded within this check are going naturally be identical and render the node unhealthy though it might be healthy. Has additional config parameters: `STALE_HEIGHT_CHECK_HISTORY_LENGTH`, `COUNT_LOCAL_RPC_FAILS_AS_STALE_HEIGHT`, `IGNORE_HALTED_BLOCKCHAIN`.

### Configuration

The service can be configured via environment variables.


| Name                                    | Description                                                                                                                                                                                                                                                                                                                                                                                    | Default                            | Required |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | :------: |
| `HEIGHT_CHECK_STRATEGY`                 | Strategy to check height of a blockchain node. You can find available options [here](src/height-strategies/). This strategy runs every `INTERVAL_SECONDS` seconds.                                                                                                                                                                                                                             |                                    |   yes    |
| `READINESS_PROBE_STRATEGY`              | Strategy for readiness probe. You can find available options [here](src/probe-strategies/). Responds on `/health/readiness` path.                                                                                                                                                                                                                                                              |                                    |   yes    |
| `LIVENESS_PROBE_STRATEGY`               | Strategy for liveness probe. You can find available options [here](src/probe-strategies/). Responds on `/health/liveness` path.                                                                                                                                                                                                                                                                |                                    |   yes    |
| `STARTUP_PROBE_STRATEGY`                | Strategy for startup probe. You can find available options [here](src/probe-strategies/). Responds on `/health/startup` path.                                                                                                                                                                                                                                                                  |                                    |   yes    |
| `LOCAL_RPC_ENDPOINT`                    | URL of local RPC endpoint.                                                                                                                                                                                                                                                                                                                                                                     |                                    |   yes    |
| `REMOTE_RPC_ENDPOINTS`                  | URL of remote RPC endpoint(s) that can be used as oracles. Accepts multiple comma-separated values.                                                                                                                                                                                                                                                                                            |                                    |   yes    |
| `SIDECAR_CHAIN_ID`                      | Pocket network chain ID. Currently only used for exposing height/diff metrics - can be useful for monitoring purposes.                                                                                                                                                                                                                                                                         |                                    |    no    |
| `INTERVAL_SECONDS`                      | Interval in seconds on how often perform health-checks against the node.                                                                                                                                                                                                                                                                                                                       | `15`                               |    no    |
| `LOG_LEVEL`                             | Log level.                                                                                                                                                                                                                                                                                                                                                                                     | `info`                             |    no    |
| `LISTEN_PORT`                           | Port to expose health-check endpoints on.                                                                                                                                                                                                                                                                                                                                                      | `9090`                             |    no    |
| `INCLUDE_NODEJS_METRICS`                | Whether to expose nodejs runtime metrics for sidecar troubleshooting purposes. You probably don't need that.                                                                                                                                                                                                                                                                                   | `false`                            |    no    |
| `HEIGHT_DIFF_THRESHOLD`                 | Applies to `localVsRemote` strategy. Marks strategy as failed when local height is below remote height more than specified value.                                                                                                                                                                                                                                                              | `100`                              |    no    |
| `FAIL_ON_REMOTE_RPC_UNAVAILABLE`        | Applies to `localVsRemote` strategy. Mark strategy as failed if remote RPC is unavailable.                                                                                                                                                                                                                                                                                                     | `false`                            |    no    |
| `STALE_HEIGHT_CHECK_HISTORY_LENGTH`     | Applies to `heightNotClimbing` strategy. Length of block height history to maintain. When all values are identical the node fails `heightNotClimbing` check. It will take `STALE_HEIGHT_CHECK_HISTORY_LENGTH` * `INTERVAL_SECONDS` seconds for `chain-healthcheck-sidecar` to realize the node is not climbing. E.g. with default value `70` and `15s` check interval it'll take 1050 seconds. | `70`                               |    no    |
| `COUNT_LOCAL_RPC_FAILS_AS_STALE_HEIGHT` | Applies to `heightNotClimbing` strategy. Whether to count RPC errors as stale block heights. E.g. if all `heightNotClimbing` checks recorded during RPC outage - mark the check unhealthy.                                                                                                                                                                                                     | `false`                            |    no    |
| `IGNORE_HALTED_BLOCKCHAIN`              | Applies to `heightNotClimbing` strategy. Ignore an edge-case when the node is stalled, but the whole blockchain, according to oracle(s), is having issues.                                                                                                                                                                                                                                     | `false`                            |    no    |
| `EVM_BLOCK_NUMBER_METHOD_NAME`          | EVM-specific configuration - override the name of `blockNumber` rpc as some chains might have a different name for rpc calls.                                                                                                                                                                                                                                                                  | `eth_blockNumber`                  |    no    |
| `AVAX_HEALTH_ENDPOINT`                  | Avalanche-specific configuration - an http endpoint to the avalanchego health endpoint                                                                                                                                                                                                                                                                                                         | `http://127.0.0.1:9650/ext/health` |    no    |


### Prometheus metrics

| Name                          | Description                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| blockchain_local_node_height  | Local blockchain node height                                   |
| blockchain_remote_node_height | Remote blockchain node height                                  |
| blockchain_rpc_check_errors   | RPC checks errors                                              |
| blockchain_height_diff        | Difference between local and remote from sidecar point of view |


## Local development

The set up integrates easily with Kubernetes for development. You can port-forward the node RPC endpoint to a local port and use the local port as the `LOCAL_RPC_ENDPOINT`:

```
kubectl port-forward svc/harmony-0 -n blockchains 9500:9500
```


You can start the sidecar locally and pass environment variables like this:

Harmony:
```
LOG_LEVEL=debug SIDECAR_CHAIN_ID=0040 HEIGHT_CHECK_STRATEGY=evm EVM_BLOCK_NUMBER_METHOD_NAME="hmyv2_blockNumber" LOCAL_RPC_ENDPOINT="http://localhost:9500" REMOTE_RPC_ENDPOINTS="https://rpc.s0.t.hmny.io" STARTUP_PROBE_STRATEGY=localVsRemote READINESS_PROBE_STRATEGY=localVsRemote LIVENESS_PROBE_STRATEGY="heightNotClimbing" npm run start
```

Avalanche (custom strategy, uncommon RPC url):
```
LOG_LEVEL=debug SIDECAR_CHAIN_ID=0003 HEIGHT_CHECK_STRATEGY=evm LOCAL_RPC_ENDPOINT="http://localhost:9650/ext/bc/C/rpc" REMOTE_RPC_ENDPOINTS="https://api.avax.network/ext/bc/C/rpc" STARTUP_PROBE_STRATEGY=localRpcAvailable READINESS_PROBE_STRATEGY=localVsRemote LIVENESS_PROBE_STRATEGY="customAvax" npm run star
```


## Contributing

Please read [CONTRIBUTING.md](https://github.com/pokt-network/repo-template/blob/master/CONTRIBUTING.md) for details on contributions and the process of submitting pull requests.

## Support & Contact

<div>
  <a  href="https://twitter.com/poktnetwork" ><img src="https://img.shields.io/twitter/url/http/shields.io.svg?style=social"></a>
  <a href="https://t.me/POKTnetwork"><img src="https://img.shields.io/badge/Telegram-blue.svg"></a>
  <a href="https://www.facebook.com/POKTnetwork" ><img src="https://img.shields.io/badge/Facebook-red.svg"></a>
  <a href="https://research.pokt.network"><img src="https://img.shields.io/discourse/https/research.pokt.network/posts.svg"></a>
</div>


## License

This project is licensed under the MIT License; see the [LICENSE.md](LICENSE.md) file for details.
