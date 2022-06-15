import { RequestHandler } from 'express';
import alwaysHealthy from './alwaysHealthy';
import alwaysFailure from './alwaysFailure';
import heightNotClimbing from './heightNotClimbing';
import localVsRemote from './localVsRemote';
import localRpcAvailable from './localRpcAvailable';
import customAvax from './customAvax';

const {
    READINESS_PROBE_STRATEGY,
    LIVENESS_PROBE_STRATEGY,
    STARTUP_PROBE_STRATEGY,
} = process.env;

const availableProbes: ProbeStrategy[] = [
    alwaysHealthy,
    alwaysFailure,
    heightNotClimbing,
    localVsRemote,
    localRpcAvailable,
    customAvax,
]

export interface ProbeStrategy {
    name: string;

    // As health checks must return result quickly, we shall not do any processing during HTTP request,
    // but rather react on state that has been pre-populated by a background processing job.
    backgroundProcessing?: () => Promise<void>;
    httpHandler: RequestHandler;
    init?: () => Promise<void>
}

const pickProbe = (name) => {
    const probe = availableProbes.find(pr => pr.name === name)
    if (probe) {
        return probe
    }

    const availableProbesNames = availableProbes.map((pr) => pr.name)
    console.error({ availableProbes: availableProbesNames }, `probe with name "${name}" not found, using alwaysFail to signal about this issue`)

    // using alwaysFail to signal about this issue
    return alwaysFailure
}

export const currentProbeStrategies = {
    startup: pickProbe(STARTUP_PROBE_STRATEGY),
    readiness: pickProbe(READINESS_PROBE_STRATEGY),
    liveness: pickProbe(LIVENESS_PROBE_STRATEGY)
}