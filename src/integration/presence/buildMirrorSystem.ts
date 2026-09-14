import type { AgenticSystem, AgentNode } from '../../data/agents';
import { getAllAgents, MAX_MIRROR_AGENTS } from '../../data/agents';
import { DEFAULT_MODELS } from '../../core/llm/constants';
import type { PresenceAgent } from './presenceTypes';
import {
  COLLECTIVE_COLORS,
  SPECIALIST_ACCESSORIES,
  defaultMirrorColor,
  defaultMirrorName,
  resolveAppearance,
  type AgentAppearance,
} from './agentAppearanceStore';

export const CURSOR_MIRROR_SET_ID = 'cursor-mirror';
/** Structural stub when the office is empty — not rendered as an NPC. */
export const MIRROR_EMPTY_LEAD_ID = '__mirror_empty__';
export { MAX_MIRROR_AGENTS };

export interface MirrorBuildResult {
  system: AgenticSystem;
  indexByAgentId: Record<string, number>;
  /** True when there are no real presence agents (user-only office). */
  empty: boolean;
}

function defaultAccessory(slot: number, isLead: boolean): number {
  if (isLead) return 2;
  return SPECIALIST_ACCESSORIES[(slot - 1) % SPECIALIST_ACCESSORIES.length];
}

function emptyMirrorSystem(): MirrorBuildResult {
  const stubLead: AgentNode = {
    id: MIRROR_EMPTY_LEAD_ID,
    index: 1,
    name: 'Waiting',
    description: 'Structural stub — not shown in the office.',
    color: COLLECTIVE_COLORS[0],
    model: 'mirror',
    humanInTheLoop: false,
    accessory: 2,
    subagents: [],
  };
  return {
    empty: true,
    indexByAgentId: {},
    system: {
      id: CURSOR_MIRROR_SET_ID,
      teamName: 'Cursor Swarm',
      teamType: 'Mirror',
      teamDescription: 'Live visualization of Cursor agents and subagents.',
      color: COLLECTIVE_COLORS[0],
      outputType: 'text',
      outputModel: DEFAULT_MODELS.text,
      outputAutoApprove: true,
      user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
      leadAgent: stubLead,
    },
  };
}

/** NPC agents that should appear in the office (excludes empty stub). */
export function getMirrorNpcAgents(system: AgenticSystem): AgentNode[] {
  if (system.id !== CURSOR_MIRROR_SET_ID) {
    return getAllAgents(system);
  }
  if (system.leadAgent.id === MIRROR_EMPTY_LEAD_ID) return [];
  const agents: AgentNode[] = [];
  const walk = (node: AgentNode) => {
    if (node.id === MIRROR_EMPTY_LEAD_ID) return;
    agents.push(node);
    node.subagents?.forEach(walk);
  };
  walk(system.leadAgent);
  return agents;
}

/**
 * Build a synthetic AgenticSystem from live presence agents + appearance overrides.
 * Index 0 = user; NPCs start at 1. Empty roster → user-only office (stub lead, not rendered).
 */
export function buildMirrorSystem(
  agents: PresenceAgent[],
  appearances: Record<string, AgentAppearance> = {},
  maxAgents: number = MAX_MIRROR_AGENTS,
): MirrorBuildResult {
  const capped = agents.slice(0, maxAgents);
  const indexByAgentId: Record<string, number> = {};

  if (capped.length === 0) return emptyMirrorSystem();

  const lead = capped.find((a) => !a.parentId) ?? capped[0];
  const children = capped.filter((a) => a.agentId !== lead.agentId);
  let nextIndex = 1;

  const toNode = (agent: PresenceAgent, isLead: boolean): AgentNode => {
    const index = nextIndex++;
    indexByAgentId[agent.agentId] = index;
    const appearance = resolveAppearance(appearances, agent.agentId, agent.name);
    // Also resolve under "Cursor" so lead looks survive Composer→Cursor rename.
    const leadLook = isLead
      ? resolveAppearance(appearances, agent.agentId, 'Cursor')
      : {};
    const look = { ...appearance, ...leadLook };
    const slot = index;
    return {
      id: agent.agentId,
      index,
      name: defaultMirrorName(agent.name, isLead, look.name),
      description: `${agent.provider} agent · ${agent.state}`,
      color: look.color || defaultMirrorColor(slot, isLead),
      model: 'mirror',
      humanInTheLoop: false,
      accessory: look.accessory ?? defaultAccessory(slot, isLead),
      subagents: [],
    };
  };

  const leadNode = toNode(lead, true);
  leadNode.subagents = children.map((c) => toNode(c, false));

  return {
    empty: false,
    indexByAgentId,
    system: {
      id: CURSOR_MIRROR_SET_ID,
      teamName: 'Cursor Swarm',
      teamType: 'Mirror',
      teamDescription: 'Live visualization of Cursor agents and subagents.',
      color: leadNode.color,
      outputType: 'text',
      outputModel: DEFAULT_MODELS.text,
      outputAutoApprove: true,
      user: { index: 0, model: 'Human', position: { x: 0, y: 0 } },
      leadAgent: leadNode,
    },
  };
}
