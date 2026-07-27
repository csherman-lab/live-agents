import * as THREE from 'three/webgpu';
import { getAgentSet, getAllAgents, AgenticSystem, USER_COLOR } from '../data/agents';
import { CharacterController } from './CharacterController';
import { Engine } from './core/Engine';
import { Stage } from './core/Stage';
import { DriverManager } from './drivers/DriverManager';
import { CharacterManager } from './entities/CharacterManager';
import { HoverRing, SelectionRing } from './entities/SelectionRing';
import { InputManager } from './input/InputManager';
import { NavMeshManager } from './pathfinding/NavMeshManager';
import { PoiManager } from './world/PoiManager';
import { WorldManager } from './world/WorldManager';

import { AgentSimulation } from './core/AgentSimulation';
import { useCoreStore } from '../integration/store/coreStore';
import { getActiveAgentSet, useTeamStore } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import { AgentBehavior, CharacterStateKey, ChatMessage } from '../types';
import {
  BUBBLE_Y_OFFSET,
  CHAT_APPROACH_DISTANCE,
  CONVERSATION_FACE_TURN_RATE,
  HOVER_REACTION_CHANCE,
  HOVER_REACTION_COOLDOWN_MS,
  HOVER_REACTION_MIN_MS,
  HOVER_RING_COLOR,
  HOVER_RING_OPACITY,
  LISTENER_MICROBEAT_INTERVAL,
  PLAYER_RING_OPACITY,
  SOCIAL_AMBIENT_DURATION,
  SOCIAL_AMBIENT_INTERVAL,
  SOCIAL_AMBIENT_MEETUP_RADIUS,
  SOCIAL_AMBIENT_PAIR_RADIUS,
  SOCIAL_NOTICE_CHANCE,
  SOCIAL_NOTICE_COOLDOWN,
  SOCIAL_NOTICE_RADIUS,
} from './constants';
import { ConversationSession } from './presence/ConversationSession';
import { HoverReactionScheduler } from './presence/InteractionPresence';
import { blendFacingXZ } from './presence/LocomotionPresence';
import { SocialDirector } from './presence/SocialDirector';
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
  private selectionRing: SelectionRing | null = null;
  private hoverRing: HoverRing | null = null;
  private playerRing: HoverRing | null = null;
  /** Avoids rebuilding the (tree-walked) agent list every frame just to read the selected agent's color. */
  private selectedColorCache: { index: number; setId: string; color: string | undefined } | null = null;
  private inputManager: InputManager | null = null;
  private coreHandler: ((npcIndex: number, text: string) => Promise<string | null>) | null = null;
  /** Player↔NPC conversation choreography (Wave 2). */
  private playerChatSession: ConversationSession | null = null;
  /** Ambient NPC↔NPC session (Wave 4/5). */
  private ambientSession: ConversationSession | null = null;
  /** True once ambient pair finished walking and is talking. */
  private ambientTalking = false;
  /** Meetup walk arrivals before talk starts. */
  private ambientMeetupPending: { a: number; b: number; arrivedA: boolean; arrivedB: boolean } | null = null;
  private socialDirector = new SocialDirector({
    ambientInterval: SOCIAL_AMBIENT_INTERVAL,
    ambientDuration: SOCIAL_AMBIENT_DURATION,
    noticeRadius: SOCIAL_NOTICE_RADIUS,
    noticeChance: SOCIAL_NOTICE_CHANCE,
    noticeCooldown: SOCIAL_NOTICE_COOLDOWN,
    ambientMeetupRadius: SOCIAL_AMBIENT_MEETUP_RADIUS,
  });
  private hoverReactions = new HoverReactionScheduler({
    chance: HOVER_REACTION_CHANCE,
    cooldownMs: HOVER_REACTION_COOLDOWN_MS,
    minHoverMs: HOVER_REACTION_MIN_MS,
  });
  /** NPCs currently reserved by ambient chat (autonomy suspended). */
  private ambientNpcIndices = new Set<number>();
  private listenerMicrobeatTimer = 0;
  private waveReactTimeout: ReturnType<typeof setTimeout> | null = null;

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
        this.worldManager.getOffice() ?? undefined, (p) => this.navMesh.isPointOnNavMesh(p),
        (idx) => {
          const player = getActiveAgentSet().user.index;
          if (idx === player) return;
          useUiStore.getState().setSelectedNpc(idx);
          this.startChat(idx);
        },
        () => !useUiStore.getState().isChatting,
      );

      this.selectionRing = new SelectionRing(this.stage.scene);
      this.hoverRing = new HoverRing(this.stage.scene, HOVER_RING_COLOR, HOVER_RING_OPACITY);
      this.playerRing = new HoverRing(this.stage.scene, USER_COLOR, PLAYER_RING_OPACITY);
      this.syncFollowFromSelection(useUiStore.getState().selectedNpcIndex);

      this.engine.renderer.setAnimationLoop(this.animationLoop);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.unsubs.push(() => document.removeEventListener('visibilitychange', this.onVisibilityChange));

      this.settleReady();

      if (import.meta.env.DEV && typeof window !== 'undefined') {
        (window as unknown as { __laPresence?: () => unknown }).__laPresence = () => this.getPresenceDebug();
      }

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
        
        if (s.isChatting && s.selectedNpcIndex !== null && this.playerChatSession?.isActive) {
          this._syncPlayerChatRoles(s.selectedNpcIndex, set.user.index, s.isThinking, s.isTyping);
        } else if (!s.isChatting && prev.isChatting) {
          // Cleanup Chat Visuals — keep follow on still-selected NPC (chat zoom exits via setChatMode)
          this._endPlayerChatVisuals(prev.selectedNpcIndex, set.user.index);
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

  /**
   * Selected agent's team color, cached by (index, team) so a held selection doesn't re-walk the
   * (subagent-tree) agent list every frame just to read a color that hasn't changed.
   */
  private getSelectedAgentColor(index: number): string | undefined {
    const setId = useTeamStore.getState().selectedAgentSetId;
    const cache = this.selectedColorCache;
    if (cache && cache.index === index && cache.setId === setId) return cache.color;
    const color = getAllAgents(getActiveAgentSet()).find((a) => a.index === index)?.color;
    this.selectedColorCache = { index, setId, color };
    return color;
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
    const user = set.user.index;

    // Player chat preempts ambient social involving this NPC.
    if (this.ambientSession?.isParticipant(npcIndex) || this.ambientMeetupPending?.a === npcIndex || this.ambientMeetupPending?.b === npcIndex) {
      this._endAmbientSession();
    }

    const session = new ConversationSession(user, npcIndex);
    session.begin();
    this.playerChatSession = session;

    const npc = new THREE.Vector3(pos[npcIndex * 4], 0, pos[npcIndex * 4 + 2]);
    const player = new THREE.Vector3(pos[user * 4], 0, pos[user * 4 + 2]);
    const dist = player.distanceTo(npc);
    let dir = new THREE.Vector3().subVectors(player, npc).normalize();
    if (dir.length() < 0.01) dir.set(1, 0, 0);
    const target = npc.clone().addScaledVector(dir, CHAT_APPROACH_DISTANCE);

    this.syncFollowFromSelection(npcIndex);
    this.driverManager?.getNpcDriver(npcIndex)?.setChatting(true);
    this.controller.cancelMovement(npcIndex);
    this._applySessionRoles(session);
    this.controller.getAgentStateBuffer()?.setWaypoint(npcIndex, dir.x, dir.z);

    const onArrived = () => {
      if (!this.controller || !this.playerChatSession?.isActive) return;
      this._snapChatFacing(user, npcIndex);
      this._applySessionRoles(this.playerChatSession);
      this._triggerNpcGreeting(npcIndex);
    };

    // Already close enough — skip walk, face + greet immediately.
    if (dist <= CHAT_APPROACH_DISTANCE + 0.35) {
      onArrived();
      return;
    }

    const moved = this.driverManager?.getPlayerDriver()?.walkTo(target, 'listen', onArrived) ?? false;
    if (!moved) {
      this._abortPlayerChat('Couldn’t reach them — try moving closer.');
    }
  }

  private _abortPlayerChat(message?: string): void {
    const set = getActiveAgentSet();
    const npc = useUiStore.getState().selectedNpcIndex;
    this._endPlayerChatVisuals(npc, set.user.index);
    useUiStore.getState().setChatting(false);
    if (message) toast(message, 'error');
  }

  private _snapChatFacing(userIndex: number, npcIndex: number): void {
    if (!this.controller || !this.playerChatSession) return;
    const p = this.controller.getCPUPositions();
    if (!p) return;
    const facing = this.playerChatSession.facingDirs(
      { x: p[userIndex * 4], z: p[userIndex * 4 + 2] },
      { x: p[npcIndex * 4], z: p[npcIndex * 4 + 2] },
    );
    this.controller.characterManager.setFacing(userIndex, facing.a.x, facing.a.z);
    this.controller.characterManager.setFacing(npcIndex, facing.b.x, facing.b.z);
  }

  /** Ease participants toward each other while approaching / hold facing while chatting. */
  private _tickConversationFacing(delta: number, positions: Float32Array): void {
    if (!this.controller) return;
    const sessions: ConversationSession[] = [];
    if (this.playerChatSession?.isActive) sessions.push(this.playerChatSession);
    if (this.ambientSession?.isActive && this.ambientTalking) sessions.push(this.ambientSession);

    for (const session of sessions) {
      const [a, b] = session.participants;
      const desired = session.facingDirs(
        { x: positions[a * 4], z: positions[a * 4 + 2] },
        { x: positions[b * 4], z: positions[b * 4 + 2] },
      );
      for (const [idx, want] of [[a, desired.a], [b, desired.b]] as const) {
        // Don't fight walk facing while pathing toward the meetup / chat stand-off.
        if (this.controller.isPathing(idx)) continue;
        const wp = this.controller.getAgentStateBuffer()?.getWaypoint(idx);
        const cur = wp && Math.hypot(wp.x, wp.z) > 1e-5
          ? { x: wp.x, z: wp.z }
          : this.controller.getWalkFacing(idx);
        const next = blendFacingXZ(cur, want, CONVERSATION_FACE_TURN_RATE, delta);
        this.controller.characterManager.setFacing(idx, next.x, next.z);
      }
    }

    // During player approach, also ease the waiting NPC toward the player.
    if (this.playerChatSession?.isActive) {
      const [user, npc] = this.playerChatSession.participants;
      if (this.controller.isPathing(user) && !this.controller.isPathing(npc)) {
        const desired = this.playerChatSession.facingDirs(
          { x: positions[user * 4], z: positions[user * 4 + 2] },
          { x: positions[npc * 4], z: positions[npc * 4 + 2] },
        );
        const wp = this.controller.getAgentStateBuffer()?.getWaypoint(npc);
        const cur = wp && Math.hypot(wp.x, wp.z) > 1e-5
          ? { x: wp.x, z: wp.z }
          : this.controller.getWalkFacing(npc);
        const next = blendFacingXZ(cur, desired.b, CONVERSATION_FACE_TURN_RATE, delta);
        this.controller.characterManager.setFacing(npc, next.x, next.z);
      }
    }
  }

  private _syncPlayerChatRoles(
    npcIndex: number,
    userIndex: number,
    isThinking: boolean,
    isTyping: boolean,
  ): void {
    if (!this.playerChatSession?.isActive) return;
    if (isThinking) this.playerChatSession.setSpeaker(npcIndex);
    else if (isTyping) this.playerChatSession.setSpeaker(userIndex);
    else this.playerChatSession.setSpeaker(null);
    this._applySessionRoles(this.playerChatSession);
  }

  private _applySessionRoles(session: ConversationSession): void {
    if (!this.controller || !session.isActive) return;
    for (const idx of session.participants) {
      const role = session.roleOf(idx);
      if (this.controller.getState(idx) !== 'walk') {
        this.controller.play(idx, role);
      }
      this.controller.setSpeaking(idx, role === 'talk');
    }
  }

  private _returnNpcAfterChat(npcIndex: number): void {
    if (!this.controller) return;
    const core = useCoreStore.getState();
    const onHold = core.tasks.find((t) => t.status === 'on_hold' && t.assignedAgentId === npcIndex);
    const inProgress = core.tasks.find((t) => t.status === 'in_progress' && t.assignedAgentId === npcIndex);
    if (onHold) {
      this.moveNpcToBoardroom(npcIndex);
    } else if (inProgress) {
      this.setNpcWorking(npcIndex, true);
    } else {
      this.controller.play(npcIndex, 'idle');
    }
  }

  private _endPlayerChatVisuals(npcIndex: number | null, userIndex: number): void {
    if (!this.controller) return;
    this.playerChatSession?.end();
    this.playerChatSession = null;
    this.listenerMicrobeatTimer = 0;
    if (npcIndex !== null) {
      this.driverManager?.getNpcDriver(npcIndex)?.setChatting(false);
      this.controller.setSpeaking(npcIndex, false);
      this.controller.cancelMovement(userIndex);
      this._returnNpcAfterChat(npcIndex);
    }
    this.controller.setSpeaking(userIndex, false);
    if (this.controller.getState(userIndex) !== 'walk') {
      this.controller.play(userIndex, 'idle');
    }
  }

  private _endAmbientSession(): void {
    if (!this.controller) return;
    const participants = this.ambientSession?.participants
      ?? (this.ambientMeetupPending ? [this.ambientMeetupPending.a, this.ambientMeetupPending.b] as const : null);
    if (participants) {
      for (const idx of participants) {
        this.driverManager?.getNpcDriver(idx)?.setChatting(false);
        this.controller.setSpeaking(idx, false);
        this.controller.cancelMovement(idx);
        const st = this.controller.getState(idx);
        if (st === 'talk' || st === 'listen' || st === 'walk') {
          this.controller.play(idx, 'idle');
        }
        this.ambientNpcIndices.delete(idx);
      }
    }
    this.ambientSession?.end();
    this.ambientSession = null;
    this.ambientTalking = false;
    this.ambientMeetupPending = null;
    this.socialDirector.cancelAmbient();
  }

  private _beginAmbientMeetup(a: number, b: number, positions: Float32Array): void {
    if (!this.controller) return;
    const ax = positions[a * 4];
    const az = positions[a * 4 + 2];
    const bx = positions[b * 4];
    const bz = positions[b * 4 + 2];
    const mx = (ax + bx) * 0.5;
    const mz = (az + bz) * 0.5;
    let dx = bx - ax;
    let dz = bz - az;
    let len = Math.hypot(dx, dz);
    if (len < 1e-5) {
      dx = 1;
      dz = 0;
      len = 1;
    } else {
      dx /= len;
      dz /= len;
    }
    const half = SOCIAL_AMBIENT_PAIR_RADIUS * 0.5;
    const targetA = new THREE.Vector3(mx - dx * half, 0, mz - dz * half);
    const targetB = new THREE.Vector3(mx + dx * half, 0, mz + dz * half);

    this.ambientMeetupPending = { a, b, arrivedA: false, arrivedB: false };
    this.ambientTalking = false;
    this.ambientSession = null;

    for (const idx of [a, b]) {
      this.driverManager?.getNpcDriver(idx)?.setChatting(true);
      this.ambientNpcIndices.add(idx);
      this.controller.cancelMovement(idx);
    }

    const tryStartTalk = () => {
      const pending = this.ambientMeetupPending;
      if (!pending || !pending.arrivedA || !pending.arrivedB || !this.controller) return;
      const session = new ConversationSession(pending.a, pending.b);
      session.begin();
      session.setSpeaker(pending.a);
      this.ambientSession = session;
      this.ambientTalking = true;
      this.ambientMeetupPending = null;
      const pos = this.controller.getCPUPositions();
      if (pos) {
        const facing = session.facingDirs(
          { x: pos[pending.a * 4], z: pos[pending.a * 4 + 2] },
          { x: pos[pending.b * 4], z: pos[pending.b * 4 + 2] },
        );
        this.controller.characterManager.setFacing(pending.a, facing.a.x, facing.a.z);
        this.controller.characterManager.setFacing(pending.b, facing.b.x, facing.b.z);
      }
      this._applySessionRoles(session);
    };

    // Already close — talk immediately.
    if (len <= SOCIAL_AMBIENT_PAIR_RADIUS + 0.4) {
      this.ambientMeetupPending = { a, b, arrivedA: true, arrivedB: true };
      tryStartTalk();
      return;
    }

    const movedA = this.controller.moveTo(a, targetA, 'listen', () => {
      if (this.ambientMeetupPending) this.ambientMeetupPending.arrivedA = true;
      tryStartTalk();
    });
    const movedB = this.controller.moveTo(b, targetB, 'listen', () => {
      if (this.ambientMeetupPending) this.ambientMeetupPending.arrivedB = true;
      tryStartTalk();
    });
    if (!movedA || !movedB) {
      this._endAmbientSession();
    }
  }

  private _tickListenerMicrobeats(delta: number): void {
    if (!this.controller) return;
    const session = this.playerChatSession?.isActive
      ? this.playerChatSession
      : (this.ambientTalking && this.ambientSession?.isActive ? this.ambientSession : null);
    if (!session) {
      this.listenerMicrobeatTimer = 0;
      return;
    }
    this.listenerMicrobeatTimer += delta;
    if (this.listenerMicrobeatTimer < LISTENER_MICROBEAT_INTERVAL) return;
    this.listenerMicrobeatTimer = 0;

    for (const idx of session.participants) {
      if (session.roleOf(idx) !== 'listen') continue;
      if (this.controller.getState(idx) !== 'listen') continue;
      if (Math.random() > 0.45) continue;
      this.controller.play(idx, 'look_around');
      // look_around auto-returns to idle via state machine — re-assert listen shortly
      const sessionRef = session;
      window.setTimeout(() => {
        if (!this.controller || !sessionRef.isActive) return;
        if (sessionRef.roleOf(idx) === 'listen' && this.controller.getState(idx) === 'idle') {
          this.controller.play(idx, 'listen');
        }
      }, 900);
      break;
    }
  }

  private _tickPresence(delta: number, positions: Float32Array): void {
    if (!this.controller) return;
    const set = getActiveAgentSet();
    const player = set.user.index;
    const ui = useUiStore.getState();

    this._tickConversationFacing(delta, positions);
    this._tickListenerMicrobeats(delta);

    // Hover reactions (Wave 3) — skip player and while chatting.
    if (!ui.isChatting) {
      const hovered = ui.hoveredNpcIndex;
      const reaction = this.hoverReactions.tick(
        hovered !== null && hovered !== player ? hovered : null,
        performance.now(),
      );
      if (reaction && hovered !== null) {
        const st = this.controller.getState(hovered);
        if (st === 'idle' || st === 'look_around') {
          this.controller.play(hovered, reaction);
        }
      }
    }

    // Social director (Wave 4/5)
    const agents = getAllAgents(set).map((a) => {
      const busy = useCoreStore.getState().tasks.some(
        (t) => t.assignedAgentId === a.index && (t.status === 'in_progress' || t.status === 'on_hold' || t.status === 'scheduled'),
      );
      return {
        index: a.index,
        x: positions[a.index * 4],
        z: positions[a.index * 4 + 2],
        state: this.controller!.getState(a.index),
        pathing: this.controller!.isPathing(a.index),
        busy,
        inPlayerChat: this.playerChatSession?.isParticipant(a.index) ?? false,
      };
    });

    const hasAmbient = !!(this.ambientSession?.isActive || this.ambientMeetupPending);

    const actions = this.socialDirector.update(delta, {
      agents,
      playerIndex: player,
      playerX: positions[player * 4],
      playerZ: positions[player * 4 + 2],
      hasAmbientSession: hasAmbient,
      hasPlayerSession: !!this.playerChatSession?.isActive,
      ambientTalking: this.ambientTalking,
    });

    for (const action of actions) {
      if (action.type === 'ambient_meetup') {
        this._beginAmbientMeetup(action.a, action.b, positions);
      } else if (action.type === 'ambient_tick' && this.ambientSession?.isActive) {
        this.ambientSession.setSpeaker(action.speaker);
        this._applySessionRoles(this.ambientSession);
      } else if (action.type === 'ambient_end') {
        this._endAmbientSession();
      } else if (action.type === 'notice') {
        const st = this.controller.getState(action.index);
        if (st === 'idle' || st === 'look_around') {
          this.controller.play(action.index, action.reaction as CharacterStateKey);
        }
      }
    }
  }

  /** Player waves; selected NPC reacts (Wave 5). */
  public waveAtSelected(): void {
    if (!this.controller) return;
    const idx = useUiStore.getState().selectedNpcIndex;
    if (idx === null || useUiStore.getState().isChatting) return;
    const player = getActiveAgentSet().user.index;
    if (idx === player) return;

    const pos = this.controller.getCPUPositions();
    if (pos) {
      const facing = {
        x: pos[idx * 4] - pos[player * 4],
        z: pos[idx * 4 + 2] - pos[player * 4 + 2],
      };
      const plen = Math.hypot(facing.x, facing.z) || 1;
      this.controller.characterManager.setFacing(player, facing.x / plen, facing.z / plen);
      this.controller.characterManager.setFacing(idx, -facing.x / plen, -facing.z / plen);
    }

    const pst = this.controller.getState(player);
    if (pst === 'idle' || pst === 'look_around' || pst === 'listen') {
      this.controller.play(player, 'wave');
    }

    if (this.waveReactTimeout) clearTimeout(this.waveReactTimeout);
    this.waveReactTimeout = setTimeout(() => {
      this.waveReactTimeout = null;
      if (!this.controller || useUiStore.getState().isChatting) return;
      const st = this.controller.getState(idx);
      if (st === 'idle' || st === 'look_around' || st === 'listen') {
        this.controller.play(idx, Math.random() < 0.6 ? 'wave' : 'look_around');
      }
    }, 450);
  }

  /** DEV: dump presence sessions for QA. */
  public getPresenceDebug() {
    return {
      playerChat: this.playerChatSession?.isActive
        ? { participants: this.playerChatSession.participants, roles: this.playerChatSession.participants.map((i) => this.playerChatSession!.roleOf(i)) }
        : null,
      ambient: this.ambientSession?.isActive
        ? { participants: this.ambientSession.participants, talking: this.ambientTalking }
        : null,
      meetup: this.ambientMeetupPending,
    };
  }

  public startChat(npcIndex: number): void {
    useUiStore.getState().setSelectedNpc(npcIndex);
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
    // Player chat session owns body language for its participants.
    if (this.playerChatSession?.isParticipant(index)) {
      if (talking) this.playerChatSession.setSpeaker(index);
      else if (this.playerChatSession.roleOf(index) === 'talk') this.playerChatSession.setSpeaker(null);
      this._applySessionRoles(this.playerChatSession);
      return;
    }
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
    this.stage.update(delta); this.controller?.update(delta, this.engine.renderer);
    this.worldManager.update(delta);
    this.controller?.syncFromGPU(this.engine.renderer).then((pos) => {
      if (!pos || !this.controller) return;
      this.controller.updatePaths(pos); this.driverManager?.update(pos, delta);
      this.updateTransparency(pos, delta);
      this._tickPresence(delta, pos);
    });
    const player = getActiveAgentSet().user.index;
    const ui = useUiStore.getState();
    const { selectedNpcIndex, setSelectedPosition, selectedPosition, isChatting } = ui;

    // Roam / select follow (NPC or player). Chat framing overrides look-at via setChatSubjects.
    const followPos = this.controller?.getCPUPosition(this.selectedIndex ?? player) ?? null;
    this.stage.setFollowTarget(followPos);

    // Ground ring under selected NPC (hidden when following the player). Mutually exclusive with
    // playerRing below by construction — both gate on `this.selectedIndex === null`, so an NPC
    // selection and the player's self-follow ring can never render at the same feet simultaneously.
    if (this.selectionRing) {
      if (this.selectedIndex !== null) {
        const color = this.getSelectedAgentColor(this.selectedIndex);
        const ringPos = this.controller?.getCPUPosition(this.selectedIndex) ?? null;
        this.selectionRing.update(ringPos, color, delta, this.selectedIndex);
      } else {
        this.selectionRing.update(null);
      }
    }

    // Dim hover ring on a moused-over, unselected NPC (skip the player — it has its own follow ring
    // below — and skip entirely while chatting, since orbit/hover input is a free-roam affordance).
    if (this.hoverRing) {
      const hoveredIdx = ui.hoveredNpcIndex;
      const showHover = !isChatting && hoveredIdx !== null && hoveredIdx !== this.selectedIndex && hoveredIdx !== player;
      this.hoverRing.update(showHover ? this.controller?.getCPUPosition(hoveredIdx) ?? null : null);
    }

    // Subtle non-pulsing ring under the player while the camera follows self (no NPC selected).
    if (this.playerRing) {
      const showPlayerRing = this.selectedIndex === null && !isChatting;
      this.playerRing.update(showPlayerRing ? this.controller?.getCPUPosition(player) ?? null : null);
    }

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
    this.stage.setChatMode(isChatting, this.controller?.getAgentState(player) === AgentBehavior.GOTO, delta);
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
    this._endAmbientSession();
    this.playerChatSession?.end();
    this.playerChatSession = null;
    if (this.waveReactTimeout) {
      clearTimeout(this.waveReactTimeout);
      this.waveReactTimeout = null;
    }
    const set = getActiveAgentSet();
    getAllAgents(set).forEach((a) => this.controller?.setSpeaking(a.index, false));
    this.controller.warpAllToSpawn(set.user.index, getAllAgents(set).map(a => a.index));
    this.stage.setFollowTarget(null);
    this.stage.setChatSubjects(null, null);
    this.stage.setChatMode(false, false);
    this.selectionRing?.update(null);
    this.hoverRing?.update(null);
    this.playerRing?.update(null);
  }

  public dispose() {
    this.isDisposed = true;
    if (this.waveReactTimeout) {
      clearTimeout(this.waveReactTimeout);
      this.waveReactTimeout = null;
    }
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      delete (window as unknown as { __laPresence?: unknown }).__laPresence;
    }
    if (!this.readySettled) {
      this.settleReady(new Error('SceneManager disposed during initialization'));
    }
    this.resizeObserver.disconnect();
    this.unsubs.forEach(u => u());
    this.selectionRing?.dispose();
    this.selectionRing = null;
    this.hoverRing?.dispose();
    this.hoverRing = null;
    this.playerRing?.dispose();
    this.playerRing = null;
    this.inputManager?.dispose();
    this.inputManager = null;
    this.driverManager?.dispose();
    this.engine.dispose();
  }
}
