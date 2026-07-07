import { beforeEach, describe, expect, it } from 'vitest';
import { proposeTask } from './proposeTask';
import { setUserBrief } from './setUserBrief';
import { completeTask } from './completeTask';
import { deliverProject } from './deliverProject';
import type { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';
import { useUiStore } from '../../../integration/store/uiStore';

const leadAgent = (): AgentActionContext => ({
  data: { index: 1, name: 'Lead Agent' },
  setState: () => {},
  appendHistory: () => {},
});

const subAgent = (humanInTheLoop = false): AgentActionContext => ({
  data: { index: 2, name: 'Designer', humanInTheLoop },
  setState: () => {},
  appendHistory: () => {},
});

beforeEach(() => {
  useCoreStore.getState().resetProject();
  useUiStore.setState({ agentStatuses: {} });
});

describe('setUserBrief', () => {
  it('starts the project when called by the lead agent in idle phase', () => {
    expect(setUserBrief(leadAgent(), { brief: 'Launch a product' })).toBe(true);
    const core = useCoreStore.getState();
    expect(core.phase).toBe('working');
    expect(core.userBrief).toBe('Launch a product');
  });

  it('rejects non-lead agents', () => {
    expect(setUserBrief(subAgent(), { brief: 'Nope' })).toBe(false);
    expect(useCoreStore.getState().phase).toBe('idle');
  });
});

describe('proposeTask', () => {
  it('adds a scheduled task and logs the action', () => {
    useCoreStore.getState().startProject('Ship MVP');
    expect(
      proposeTask(leadAgent(), {
        title: 'Write copy',
        description: 'Homepage hero',
        agentId: 2,
      }),
    ).toBe(true);

    const core = useCoreStore.getState();
    expect(core.tasks).toHaveLength(1);
    expect(core.tasks[0].title).toBe('Write copy');
    expect(core.tasks[0].assignedAgentId).toBe(2);
    expect(core.tasks[0].status).toBe('scheduled');
    expect(core.actionLog.some((e) => e.action.includes('Write copy'))).toBe(true);
  });
});

describe('completeTask', () => {
  it('marks a task done when human review is not required', () => {
    useCoreStore.getState().startProject('Ship MVP');
    const task = useCoreStore.getState().addTask({
      title: 'Design',
      description: 'Mockups',
      assignedAgentId: 2,
      status: 'in_progress',
      requiresUserApproval: false,
    });

    expect(completeTask(subAgent(), { taskId: task.id, output: 'Done' })).toBe(true);
    const updated = useCoreStore.getState().tasks.find((t) => t.id === task.id);
    expect(updated?.status).toBe('done');
    expect(updated?.output).toBe('Done');
  });

  it('submits for review when humanInTheLoop is enabled', () => {
    useCoreStore.getState().startProject('Ship MVP');
    const task = useCoreStore.getState().addTask({
      title: 'Copy',
      description: 'Hero text',
      assignedAgentId: 2,
      status: 'in_progress',
      requiresUserApproval: false,
    });

    expect(completeTask(subAgent(true), { taskId: task.id, output: 'Draft copy' })).toBe(true);
    const updated = useCoreStore.getState().tasks.find((t) => t.id === task.id);
    expect(updated?.status).toBe('on_hold');
    expect(updated?.draftOutput).toBe('Draft copy');
  });
});

describe('deliverProject', () => {
  it('completes a text project when all tasks are done', () => {
    useCoreStore.getState().startProject('Launch blog');
    const task = useCoreStore.getState().addTask({
      title: 'Write post',
      description: 'Draft',
      assignedAgentId: 2,
      status: 'done',
      requiresUserApproval: false,
    });

    expect(deliverProject(leadAgent(), { output: '# Final blog post' })).toBe(true);
    expect(useCoreStore.getState().phase).toBe('done');
    expect(useCoreStore.getState().finalOutput).toBe('# Final blog post');
  });

  it('blocks delivery while tasks are still in progress', () => {
    useCoreStore.getState().startProject('Launch blog');
    useCoreStore.getState().addTask({
      title: 'Write post',
      description: 'Draft',
      assignedAgentId: 2,
      status: 'in_progress',
      requiresUserApproval: false,
    });

    expect(deliverProject(leadAgent(), { output: 'Too early' })).toBe(false);
    expect(useCoreStore.getState().phase).toBe('working');
  });
});
