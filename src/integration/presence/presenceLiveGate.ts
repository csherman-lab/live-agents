/** Hub/SSE events apply only when Mock Swarm is not owning the roster. */
export function shouldApplyHubPresenceEvent(demoSwarmActive: boolean): boolean {
  return !demoSwarmActive;
}
