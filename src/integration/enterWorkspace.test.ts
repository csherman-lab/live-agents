import { beforeEach, describe, expect, it } from 'vitest';
import { enterWorkspace } from './enterWorkspace';
import { useCoreStore } from './store/coreStore';
import { useUiStore } from './store/uiStore';
import { useToastStore } from './store/toastStore';

beforeEach(() => {
  useCoreStore.getState().resetProject();
  useCoreStore.setState({ viewMode: 'overview' });
  useUiStore.setState({
    llmConfig: { apiKey: '', model: 'gemini-3-flash-preview' },
    isDemoMode: false,
    isSettingsOpen: false,
  });
  useToastStore.setState({ toasts: [] });
});

describe('enterWorkspace', () => {
  it('blocks without an API key or demo mode and opens Settings', () => {
    expect(enterWorkspace()).toBe(false);
    expect(useUiStore.getState().isSettingsOpen).toBe(true);
    expect(useToastStore.getState().toasts[0]?.message).toMatch(/API key/i);
    expect(useCoreStore.getState().viewMode).toBe('overview');
  });

  it('enters simulation in demo mode without starting a project', () => {
    useUiStore.setState({ isDemoMode: true });
    expect(enterWorkspace()).toBe(true);
    expect(useCoreStore.getState().viewMode).toBe('simulation');
    expect(useCoreStore.getState().phase).toBe('idle');
  });

  it('starts the project when an API key and brief are present', () => {
    useUiStore.setState({
      llmConfig: { apiKey: 'test-key', model: 'gemini-3-flash-preview' },
    });
    useCoreStore.setState({ userBrief: 'Build a landing page' });

    expect(enterWorkspace()).toBe(true);
    expect(useCoreStore.getState().viewMode).toBe('simulation');
    expect(useCoreStore.getState().phase).toBe('working');
    expect(useCoreStore.getState().userBrief).toBe('Build a landing page');
    expect(
      useCoreStore.getState().actionLog.some((e) => e.action.includes('Command Center')),
    ).toBe(true);
  });

  it('does not restart a project that is already working', () => {
    useUiStore.setState({
      llmConfig: { apiKey: 'test-key', model: 'gemini-3-flash-preview' },
    });
    useCoreStore.getState().startProject('Existing brief');
    useCoreStore.setState({ viewMode: 'overview' });

    expect(enterWorkspace()).toBe(true);
    expect(useCoreStore.getState().phase).toBe('working');
    expect(useCoreStore.getState().actionLog).toHaveLength(0);
  });
});

describe('startProject', () => {
  it('sets phase to working and stores the brief', () => {
    useCoreStore.getState().startProject('Ship the MVP');
    const core = useCoreStore.getState();
    expect(core.phase).toBe('working');
    expect(core.userBrief).toBe('Ship the MVP');
    expect(core.finalAssetType).toBe('text');
    expect(core.finalAssetContent).toBeNull();
  });
});
