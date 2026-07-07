import { CornerDownLeft, FileSearch, Send } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAgentSet, getAllAgents } from '../data/agents';
import { USER_COLOR, USER_COLOR_LIGHT, USER_COLOR_SOFT } from '../theme/brand';
import { useCoreStore } from '../integration/store/coreStore';
import { useTeamStore, useActiveTeam } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import { sendOverviewChatMessage } from '../integration/overviewChatService';
import { useSceneManager } from '../simulation/SceneContext';
import { Avatar } from './components/Avatar';
import { AuditModal } from './AuditModal';

const ChatPanel: React.FC = () => {
  const {
    isChatting,
    isThinking,
    selectedNpcIndex,
    setIsTyping,
    setActiveAuditTaskId
  } = useUiStore();
  const scene = useSceneManager();
  const activeTeam = useActiveTeam();
  const agents = getAllAgents(activeTeam);
  const selectedAgentSetId = activeTeam.id;

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const agent = selectedNpcIndex !== null ? agents.find(a => a.index === selectedNpcIndex) ?? null : null;

  // Combine store messages with project histories if needed,
  // but unified useCoreStore is the source of truth for history.
  const coreStore = useCoreStore();
  const chatMessages = selectedNpcIndex !== null
    ? (coreStore.agentHistories[selectedNpcIndex] || [])
    : [];


  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isThinking, isChatting]);

  useEffect(() => {
    // Initial scroll when chat opens
    if (isChatting && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }
  }, [isChatting]);

  const simulateTyping = (text: string) => {
    let currentIndex = 0;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);

    setIsTyping(true);

    typingIntervalRef.current = setInterval(() => {
      if (currentIndex < text.length) {
        const char = text[currentIndex];
        setInput((prev) => prev + char);
        currentIndex++;
      } else {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        setIsTyping(false);
      }
    }, 20); // 20ms per character for a natural feel
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    // simulateTyping(pastedText);
    setInput(pastedText);
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    setIsTyping(false);

    const text = input;
    setInput('');
    if (scene) {
      await scene.sendMessage(text);
    } else {
      await sendOverviewChatMessage(text);
    }
  };

  if (!isChatting || !agent) {
    return null;
  }

  const visibleMessages = chatMessages.filter((msg) => !msg.metadata?.internal);
  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
  const isStreamingReply = Boolean(lastVisibleMessage?.metadata?.streaming);
  const showThinkingDots = isThinking && (!isStreamingReply || !lastVisibleMessage?.content);
  const isEmptyChat = visibleMessages.length === 0 && !isThinking;
  const isLeadAgent = agent.index === activeTeam.leadAgent.index;
  const suggestedPrompts = isLeadAgent
    ? ['Review my brief and propose a plan', 'What should the team prioritize first?', 'Break this into tasks for the team']
    : ['What is your current progress?', 'Do you need anything from me?', 'Summarize what you have so far'];

  return (
    <div className="flex flex-col h-full theme-panel relative overflow-hidden shrink-0 pointer-events-auto">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-1 space-y-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:display-none"
      >
        {isEmptyChat && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border"
              style={{ backgroundColor: `${agent.color}12`, borderColor: `${agent.color}25` }}
            >
              <Avatar type={isLeadAgent ? 'lead' : 'sub'} color={agent.color} size={32} />
            </div>
            <p className="text-[14px] font-semibold text-[var(--apple-text)]">
              Chat with {agent.name.split(' ')[0]}
            </p>
            <p className="text-[12px] mt-1.5 max-w-[240px] leading-relaxed text-[var(--apple-text-secondary)]">
              {isLeadAgent
                ? 'Align on the brief and kick off the project.'
                : 'Ask about progress, blockers, or deliverables.'}
            </p>
            <div className="flex flex-col gap-2 mt-5 w-full max-w-[280px]">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  className="px-3 py-2.5 rounded-xl text-[12px] font-medium text-left theme-chip hover:bg-black/[0.04] transition-apple"
                  style={{ color: 'var(--apple-text)' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleMessages.map((msg, i) => {
          const isStreaming = Boolean(msg.metadata?.streaming);
          return (
          <div
            key={i}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} max-w-[90%]`}>
              {/* Avatar / Icon */}
              <div className="shrink-0 mt-1">
                {msg.role === 'assistant' ? (
                  <Avatar type={agent?.index === activeTeam.leadAgent.index ? 'lead' : 'sub'} color={agent?.color} size={32} />
                ) : (
                  <Avatar type="user" color={USER_COLOR} size={32} />
                )}
              </div>

              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2.5 rounded-[20px] text-[14px] leading-relaxed shadow-sm border ${msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'
                    }`}
                  style={msg.role === 'user' ? {
                    backgroundColor: USER_COLOR_LIGHT,
                    borderColor: USER_COLOR_SOFT,
                    color: '#27272a' // text-ink
                  } : {
                    backgroundColor: 'var(--apple-surface)',
                    borderColor: 'var(--apple-border)',
                    color: 'var(--apple-text)'
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || (isStreaming ? ' ' : '')}
                      </ReactMarkdown>
                      {isStreaming && (
                        <span
                          className="inline-block w-2 h-4 ml-0.5 align-middle rounded-sm animate-pulse"
                          style={{ backgroundColor: agent.color }}
                          aria-hidden
                        />
                      )}

                      {msg.metadata?.reviewTaskId && (
                        <div className="mt-4 p-4 bg-white/50 rounded-2xl border border-zinc-200/50 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <div className="flex items-center gap-2 pr-2">
                            <div
                              className="p-2 rounded-xl flex-shrink-0"
                              style={{ backgroundColor: USER_COLOR_LIGHT, color: USER_COLOR }}
                            >
                              <FileSearch size={18} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                              {coreStore.tasks.find(t => t.id === msg.metadata.reviewTaskId)?.status === 'on_hold'
                                ? 'Review Requested'
                                : 'Review Processed'}
                            </span>
                          </div>

                          {coreStore.tasks.find(t => t.id === msg.metadata.reviewTaskId)?.status === 'on_hold' && (
                            <button
                              onClick={() => setActiveAuditTaskId(msg.metadata.reviewTaskId)}
                              className="flex-1 min-w-[120px] px-4 py-2 bg-ink text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black active:scale-95 transition-all shadow-sm whitespace-nowrap"
                            >
                              Review Task
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>

                <div className={`flex items-center gap-2 mt-2 px-1`}>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    {msg.role === 'user' ? 'You' : (agent?.name?.split(' ')[0] || 'AI')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
        })}

        {showThinkingDots && (
          <div className="flex items-start gap-4">
            <div className="shrink-0 mt-1">
              <Avatar type={isLeadAgent ? 'lead' : 'sub'} color={agent.color} size={32} />
            </div>
            <div className="theme-chip px-4 py-3 rounded-[20px] rounded-tl-none shadow-sm">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: agent.color, animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: agent.color, animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: agent.color, animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-zinc-50">
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);

                // Show player talking animation while typing
                if (val.length > 0) {
                  setIsTyping(true);
                  if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
                  stopTypingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1000);
                } else {
                  setIsTyping(false);
                }
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message (Enter to send)"
              className="w-full theme-input rounded-2xl px-3 py-3 text-sm focus:outline-none focus:ring-2 transition-all resize-none pr-12 [scrollbar-width:none]"
              style={{
                borderColor: input.trim() ? USER_COLOR : undefined,
                boxShadow: input.trim() ? `0 0 0 2px ${USER_COLOR_LIGHT}` : undefined
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            style={{ backgroundColor: !input.trim() || isThinking ? undefined : agent.color }}
            className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${!input.trim() || isThinking
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              : 'text-white shadow-lg hover:brightness-90'
              }`}
          >
            <Send size={16} strokeWidth={3} />
          </button>
        </div>
        <p className="text-[8px] text-zinc-400 mt-2 text-center font-medium uppercase tracking-wider inline-flex items-center justify-center gap-1 w-full">
          <span>Shift +</span>
          <CornerDownLeft size={10} strokeWidth={2.5} aria-hidden />
          <span>for new line</span>
        </p>
      </div>
    </div>
  );
};

export default ChatPanel;
