

Height request strategies:
- evm
- custom (when EVM doesn't apply, such as pokt node)

Readiness/Liveness/Startup probe strategies:
- alwaysFail (always return 500 fail)
- always-healthy (always return 200 OK)
- height comparison local vs oracle
- height local node not climbing
- custom health check
- at least one successful height response