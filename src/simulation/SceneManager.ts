import * as THREE from 'three/webgpu';
import { getAgentSet, getAllAgents, AgenticSystem } from '../data/agents';
import { CharacterController } from './CharacterController';
import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { DriverManager } from './drivers/DriverManager';
import { CharacterManager } from './entities/CharacterManager';
import { InputManager } from './input/InputManager';
import { NavMeshManager } from './pathfinding/NavMeshManager';
import { PoiManager } from './world/PoiManager';
import { WorldManager } from './world/WorldManager';

import { AgentSimulation } from './core/AgentSimulation';
import { useCoreStore } from '../integration/store/coreStore';
import { getActiveAgentSet, useTeamStore } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import { AgentBehavior, ChatMessage } from '../types';
import { BUBBLE_Y_OFFSET } from './constants';
import { toast } from '../integration/store/toastStore';
import { friendlyApiError } from '../utils/apiErrors';

/**
 * SceneManager — Visual Integration Layer.
 * 
 * DESIGN PRINCIPLE: Visual Reflex of Logic.
 * 1. Subscribes to the Store to Decouple logic from 3D.
 * 2. Visual actions are fire-and-forget.
 * 3. Smart POI assignment ensures NPCs find desks even with diverse GLB names.
 */
export class SceneManager {
  private engine: Engine;
  private stage: Stage;
  private characterManager: CharacterManager;
  private controller: CharacterController | null = null;
  private navMesh: NavMeshManager;
  private poiManager: PoiManager;
  private worldManager: WorldManager;
  private driverManager: DriverManager | null = null;
  private simulation: AgentSimulation | null = null;

  private lastAgentSetId: string | null = null;
  /** Camera follow target; kept in sync with uiStore.selectedNpcIndex (null → player). */
  private selectedIndex: number | null = null;
  private inputManager: InputManager | null = null;
  private coreHandler: ((npcIndex: number, text: string) => Promise<string | null>) | null = null;

  private unsubs: (() => void)[] = [];
  private isDisposed = false;
  private isReady = false;
  private readySettled = false;
  private readyResolve!: () => void;
  private readyReject!: (reason?: unknown) => void;
  /** Resolves when the 3D world, characters, and input are fully initialized. */
  readonly ready: Promise<void>;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private readonly animationLoop = this.animate.bind(this);
  private readonly onVisibilityChange = () => {
    if (this.isDisposed) return;
    if (document.hidden) {
      this.engine.renderer.setAnimationLoop(null);
    } else {
      this.engine.renderer.setAnimationLoop(this.animationLoop);
    }
  };

  constructor(container: HTMLElement) {
    this.ready = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.container = container;
    this.engine = new Engine(container);
    this.stage = new Stage(this.engine.renderer.domElement);
    this.characterManager = new CharacterManager(this.stage.scene);
    this.navMesh = new NavMeshManager();
    this.poiManager = new PoiManager();
    this.characterManager.setPoiManager(this.poiManager);
    this.worldManager = new WorldManager(this.stage.scene, this.navMesh, this.poiManager);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    const activeSet = getActiveAgentSet();
    this.simulation = new AgentSimulation(activeSet);
    this.setCoreHandler((idx, text) => this.simulation!.handleUserMessage(idx, text));
    
    void this.init();
    this.startWatchingCoreStore();
  }

  private settleReady(error?: unknown): void {
    if (this.readySettled) return;
    this.readySettled = true;
    if (error) {
      this.readyReject(error);
      return;
    }
    this.isReady = true;
    this.readyResolve();
  }

  private startWatchingCoreStore() {
    this.unsubs.push(
      useCoreStore.subscribe((state, prevState) => {
        const agentIndices = Array.from(new Set(state.tasks.flatMap(t => [t.assignedAgentId].filter(id => id !== undefined && id !== 0))));

        agentIndices.forEach(id => {
          const myTasks = state.tasks.filter(t => t.assignedAgentId === id);
          const hasChange = myTasks.some(t => {
            const pt = prevState.tasks.find(old => old.id === t.id);
            return !pt || pt.status !== t.status;
          });
          
          if (!hasChange) return;

          const onHold = myTasks.find(t => t.status === 'on_hold');
          const inProgress = myTasks.find(t => t.status === 'in_progress');
          const justDone = myTasks.some(t => t.status === 'done' && !prevState.tasks.find(pt => pt.id === t.id && pt.status === 'done'));

          if (onHold) {
            this.moveNpcToBoardroom(id);
          } else if (inProgress) {
            this.setNpcWorking(id, true);
          } else if (justDone) {
            this.setNpcWorking(id, false);
            this.moveNpcToSpawn(id);
          }
        });
      })
    );
  }

  private async init() {
    try {
      await this.engine.init();
      if (this.isDisposed) return;

      await this.worldManager.load();
      await this.characterManager.load();
      if (this.isDisposed) return;

      const state = useUiStore.getState();
      this.characterManager.setInstanceCount(state.instanceCount);
      this.controller = new CharacterController(this.characterManager, this.navMesh, this.poiManager);
      this.driverManager = new DriverManager(this.controller);

      const activeSet = getActiveAgentSet();
      const playerIndex = activeSet.user.index;
      this.driverManager.registerPlayer(playerIndex);

      getAllAgents(activeSet).forEach((agent) => {
        if (agent.index !== playerIndex) this.driverManager!.registerNpc(agent.index, agent);
      });

      this.inputManager = new InputManager(
        this.engine.renderer.domElement, this.stage.camera,
        () => this.controller!.getCPUPositions(), () => this.controller!.getCount(),
        (idx) => {
          if (useUiStore.getState().isChatting) useUiStore.getState().setChatting(false);
          // Single source of truth: UI selection; camera follow syncs via store subscription.
          const next = idx !== activeSet.user.index ? idx : null;
          useUiStore.getState().setSelectedNpc(next);
        },
        (x, z) => this.driverManager?.getPlayerDriver().onFloorClick(x, z),
        (idx, pos) => useUiStore.getState().setHoveredNpc(idx, pos),
        () => this.poiManager.getAllPois(),
        (id, label, pos) => useUiStore.getState().setHoveredPoi(id, label, pos),
        (id) => this.driverManager?.getPlayerDriver().onPoiClick(id),
        this.worldManager.getOffice() ?? undefined, (p) => this.navMesh.isPointOnNavMesh(p)
      );

      this.engine.renderer.setAnimationLoop(this.animationLoop);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.unsubs.push(() => document.removeEventListener('visibilitychange', this.onVisibilityChange));

      this.settleReady();

      this.unsubs.push(useUiStore.subscribe((s, prev) => {
      if (s.instanceCount !== prev.instanceCount) this.controller?.setInstanceCount(s.instanceCount);
      const team = useTeamStore.getState();
      if (team.selectedAgentSetId !== this.lastAgentSetId) {
        this.lastAgentSetId = team.selectedAgentSetId;
        const set = getAgentSet(team.selectedAgentSetId, team.customSystems);
        this.reinitializeSimulation(set);
        this.worldManager.updateThemeColor(set.color);
        if (this.controller) {
          this.controller.setColors();
          this.controller.warpAllToSpawn(set.user.index, getAllAgents(set).map(a => a.index));
        }
      }

      // Keyboard / kanban / bubbles / click all go through setSelectedNpc —
      // keep camera follow + InputManager pick state aligned with UI selection.
      if (s.selectedNpcIndex !== prev.selectedNpcIndex) {
        this.syncFollowFromSelection(s.selectedNpcIndex);
      }

      if ((s.isChatting !== prev.isChatting || s.isThinking !== prev.isThinking || s.isTyping !== prev.isTyping) && this.controller) {
        const set = getActiveAgentSet();
        if (s.isChatting && !prev.isChatting && s.selectedNpcIndex !== null) {
           this._startChatVisuals(s.selectedNpcIndex);
        }
        
        if (s.isChatting && s.selectedNpcIndex !== null) {
          const npc = s.selectedNpcIndex, user = set.user.index;
          if (this.controller.getState(npc) !== 'walk') this.controller.play(npc, s.isThinking ? 'talk' : 'listen');
          this.controller.setSpeaking(npc, s.isThinking);
          if (this.controller.getState(user) !== 'walk') this.controller.play(user, s.isTyping ? 'talk' : 'listen');
          this.controller.setSpeaking(user, s.isTyping);
        } else if (!s.isChatting && prev.isChatting) {
          // Cleanup Chat Visuals — keep follow on still-selected NPC (chat zoom exits via setChatMode)
          const npc = prev.selectedNpcIndex;
          const user = set.user.index;
          if (npc !== null) {
            this.driverManager?.getNpcDriver(npc)?.setChatting(false);
            this.controller.setSpeaking(npc, false);
            this.controller.play(npc, 'idle');
            this.controller.poiManager.releaseAll(npc);
          }
          this.controller.setSpeaking(user, false);
          this.controller.play(user, 'idle');
          this.syncFollowFromSelection(s.selectedNpcIndex);
        }
      }

      // Monitor individual agent status changes for autonomous animations
      if (s.agentStatuses !== prev.agentStatuses && this.controller) {
        Object.keys(s.agentStatuses).forEach(key => {
          const idx = parseInt(key);
          const status = s.agentStatuses[idx];
          const prevStatus = prev.agentStatuses[idx];
          if (status !== prevStatus) {
             if (status === 'talking') this.setNpcTalking(idx, true);
             else if (prevStatus === 'talking') this.setNpcTalking(idx, false);
          }
        });
      }
    }));
    } catch (err) {
      console.error('[SceneManager] Failed to initialize 3D workspace:', err);
      if (!this.isDisposed) {
        this.settleReady(err);
      }
    }
  }

  /** Map UI selection → camera follow + click pick state. Null/player → follow player. */
  private syncFollowFromSelection(selectedNpcIndex: number | null): void {
    const player = getActiveAgentSet().user.index;
    this.selectedIndex =
      selectedNpcIndex !== null && selectedNpcIndex !== player
        ? selectedNpcIndex
        : null;
    if (this.inputManager) {
      this.inputManager.selectedIndex = selectedNpcIndex;
    }
  }

  private _startChatVisuals(npcIndex: number): void {
    if (!this.controller) return;
    const pos = this.controller.getCPUPositions(); if (!pos) return;
    const set = getActiveAgentSet();
    const npc = new THREE.Vector3(pos[npcIndex * 4], 0, pos[npcIndex * 4 + 2]);
    const player = new THREE.Vector3(pos[set.user.index * 4], 0, pos[set.user.index * 4 + 2]);
    let dir = new THREE.Vector3().subVectors(player, npc).normalize();
    if (dir.length() < 0.01) dir.set(1, 0, 0);
    const target = npc.clone().addScaledVector(dir, 1.2);

    this.syncFollowFromSelection(npcIndex);
    this.driverManager?.getNpcDriver(npcIndex)?.setChatting(true);
    this.controller.cancelMovement(npcIndex);
    this.controller.play(npcIndex, 'listen');
    this.controller.getAgentStateBuffer()?.setWaypoint(npcIndex, dir.x, dir.z);
    this.driverManager?.getPlayerDriver()?.walkTo(target, 'listen', () => {
      const p = this.controller!.getCPUPositions()!;
      const fx = p[npcIndex * 4] - p[set.user.index * 4], fz = p[npcIndex * 4 + 2] - p[set.user.index * 4 + 2];
      this.controller!.getAgentStateBuffer()?.setWaypoint(set.user.index, fx, fz);
      this.controller!.getAgentStateBuffer()?.setWaypoint(npcIndex, -fx, -fz);
      this._triggerNpcGreeting(npcIndex);
    });
  }

  public startChat(npcIndex: number): void {
    useUiStore.getState().setChatting(true);
  }


  public async sendMessage(text: string): Promise<void> {
    const { selectedNpcIndex, isThinking } = useUiStore.getState();
    if (selectedNpcIndex === null || isThinking) return;
    useCoreStore.setState((s) => ({
      agentHistories: { ...s.agentHistories, [selectedNpcIndex!]: [...(s.agentHistories[selectedNpcIndex!] || []), { role: 'user', content: text }] }
    }));
    useUiStore.setState({ isThinking: true, isTyping: false });
    try {
      if (this.coreHandler) await this.coreHandler(selectedNpcIndex!, text);
      useUiStore.setState({ isThinking: false });
    } catch (err) {
      console.error('[SceneManager] sendMessage error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast(friendlyApiError(errMsg), 'error');
      useUiStore.setState({ isThinking: false });
    }
  }

  private reinitializeSimulation(activeSet: AgenticSystem) {
    if (this.simulation) this.simulation.dispose();
    this.simulation = new AgentSimulation(activeSet);
    this.setCoreHandler((idx, text) => this.simulation!.handleUserMessage(idx, text));
    if (this.driverManager) {
      const playerIndex = activeSet.user.index;
      this.driverManager.dispose();
      this.driverManager.registerPlayer(playerIndex);
      getAllAgents(activeSet).forEach((a) => {
        if (a.index !== playerIndex) this.driverManager!.registerNpc(a.index, a);
      });
    }
  }
  public setCoreHandler(handler: ((npcIndex: number, text: string) => Promise<string | null>) | null): void {
    this.coreHandler = handler;
  }

  public getLeadBrain() {
    if (!this.simulation) return null;
    const set = getActiveAgentSet();
    const lead = this.simulation.getAgent(set.leadAgent.index);
    return lead?.brain || null;
  }

  /** 
   * SMART DESK ASSIGNMENT
   * Attempts to find a work POI. If work-${index} is missing, it picks 
   * a desk from the 'sit_work' group based on the agent's unique index.
   */
  public setNpcWorking(index: number, working: boolean): void {
    if (!this.controller) return;
    if (working) {
      const id = `sit_work-${index}`;
      let poi = this.poiManager.getPoi(id);
      if (!poi) {
         // Smart fallback: assign a desk based on order (agent index is 1-based)
         const desks = this.poiManager.getPoisByPrefix('sit_work');
         if (desks.length > 0) poi = desks[(index - 1) % desks.length];
      }
      if (poi) this.controller.walkToPoi(index, poi.id);
    }
  }
  
  public setNpcTalking(index: number, talking: boolean): void {
    if (!this.controller) return;
    if (talking) {
      if (this.controller.getState(index) !== 'walk') this.controller.play(index, 'talk');
      this.controller.setSpeaking(index, true);
    } else {
      this.controller.setSpeaking(index, false);
      const task = useCoreStore.getState().tasks.find(t => t.status === 'on_hold' && t.assignedAgentId === index);
      this.controller.play(index, task ? 'listen' : 'idle');
    }
  }

  public moveNpcToBoardroom(index: number): void {
    if (!this.controller) return;
    const poi = this.poiManager.getPoi('area-boardroom') || this.poiManager.getPoi('boardroom');
    if (poi) {
      this.controller.walkToPoi(index, poi.id, () => {
        const core = useCoreStore.getState();
        const t = core.tasks.find(t => t.status === 'on_hold' && t.assignedAgentId === index);
      });
    }
  }

  public moveNpcToSpawn(index: number, onArrival?: () => void): void {
    if (!this.controller) return;
    const poi = this.poiManager.getPoi(`spawn-${index}`);
    if (poi) this.controller.moveTo(index, poi.position, 'idle', onArrival, undefined, poi.quaternion);
    else if (onArrival) onArrival();
  }

  private async _triggerNpcGreeting(idx: number): Promise<void> {
    const set = getActiveAgentSet();
    const agent = getAllAgents(set).find(a => a.index === idx);
    if (!agent) return;
    useUiStore.setState({ isThinking: true });
    const msg: ChatMessage = { role: 'assistant', text: `Hello. I am ${agent.name}. How can I assist you?`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    useUiStore.setState({ chatMessages: [msg], isThinking: false });
  }

  private onResize() { 
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.stage.onResize(w, h);
    if (!useCoreStore.getState().isResizing) this.engine.onResize(w, h);
  }

  /** Move the WebGPU canvas when React remounts the host element (overview ↔ simulation). */
  public reparentTo(container: HTMLElement): void {
    if (this.isDisposed || this.container === container) return;
    this.resizeObserver.disconnect();
    container.appendChild(this.engine.renderer.domElement);
    this.container = container;
    this.resizeObserver.observe(container);
    this.onResize();
  }

  private animate() {
    this.engine.timer.update(); const delta = this.engine.timer.getDelta();
    this.stage.update(); this.controller?.update(delta, this.engine.renderer);
    this.controller?.syncFromGPU(this.engine.renderer).then((pos) => {
      if (!pos || !this.controller) return;
      this.controller.updatePaths(pos); this.driverManager?.update(pos, delta);
      this.updateTransparency(pos, delta);
    });
    const player = getActiveAgentSet().user.index;
    const ui = useUiStore.getState();
    const { selectedNpcIndex, setSelectedPosition, selectedPosition, isChatting } = ui;

    // Roam / select follow (NPC or player). Chat framing overrides look-at via setChatSubjects.
    this.stage.setFollowTarget(this.controller?.getCPUPosition(this.selectedIndex ?? player) ?? null);

    // While chatting, feed both bodies so Stage can ease into a midpoint conversation shot.
    if (isChatting && this.controller && selectedNpcIndex !== null && selectedNpcIndex !== player) {
      const playerPos = this.controller.getCPUPosition(player);
      const npcPos = this.controller.getCPUPosition(selectedNpcIndex);
      this.stage.setChatSubjects(playerPos, npcPos);
    } else {
      this.stage.setChatSubjects(null, null);
    }

    const npcScreenPositions: Record<number, { x: number; y: number }> = {};
    const rect = this.container.getBoundingClientRect();
    if (this.controller) {
      for (let i = 0; i < this.controller.getCount(); i++) {
        const p = this.controller.getCPUPosition(i);
        if (p) {
          const s = p.clone(); s.y += BUBBLE_Y_OFFSET; s.project(this.stage.camera);
          npcScreenPositions[i] = { x: (s.x * 0.5 + 0.5) * rect.width, y: (s.y * -0.5 + 0.5) * rect.height };
        }
      }
      useUiStore.setState({ npcScreenPositions });
    }
    if (selectedNpcIndex !== null && npcScreenPositions[selectedNpcIndex]) {
      const p = npcScreenPositions[selectedNpcIndex];
      if (Math.abs(p.x - (selectedPosition?.x ?? 0)) > 0.5 || Math.abs(p.y - (selectedPosition?.y ?? 0)) > 0.5) setSelectedPosition(p);
    } else if (selectedPosition !== null) setSelectedPosition(null);
    this.stage.setChatMode(isChatting, this.controller?.getAgentState(player) === AgentBehavior.GOTO);
    this.engine.render(this.stage.scene, this.stage.camera);
  }

  private updateTransparency(pos: Float32Array, delta: number) {
    if (!this.controller) return;
    const count = this.controller.getCount(), buffer = this.controller.getAgentStateBuffer();
    if (!buffer) return;
    for (let i = 0; i < count; i++) {
      let overlap = false;
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        if ((pos[i * 4] - pos[j * 4]) ** 2 + (pos[i * 4 + 2] - pos[j * 4 + 2]) ** 2 < 0.36) { overlap = true; break; }
      }
      const cur = buffer.getAlpha(i), tar = overlap ? 0.4 : 1.0;
      if (Math.abs(cur - tar) > 0.01) buffer.setAlpha(i, THREE.MathUtils.lerp(cur, tar, Math.min(delta * 2.0, 1.0)));
    }
  }

  public resetScene() {
    if (!this.controller) return;
    useUiStore.getState().setChatting(false);
    const set = getActiveAgentSet();
    getAllAgents(set).forEach((a) => this.controller?.setSpeaking(a.index, false));
    this.controller.warpAllToSpawn(set.user.index, getAllAgents(set).map(a => a.index));
    this.stage.setFollowTarget(null);
    this.stage.setChatSubjects(null, null);
    this.stage.setChatMode(false, false);
  }

  public dispose() {
    this.isDisposed = true;
    if (!this.readySettled) {
      this.settleReady(new Error('SceneManager disposed during initialization'));
    }
    this.resizeObserver.disconnect();
    this.unsubs.forEach(u => u());
    this.inputManager?.dispose();
    this.inputManager = null;
    this.driverManager?.dispose();
    this.engine.dispose();
  }
}
