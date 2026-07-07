import { MessageSquare, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAllAgents } from '../data/agents';
import { openOverviewChat, sendOverviewChatMessage } from '../integration/overviewChatService';
import { useCoreStore } from '../integration/store/coreStore';
import { useActiveTeam } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import { USER_COLOR, USER_COLOR_LIGHT, USER_COLOR_SOFT } from '../theme/brand';
import { Avatar } from './components/Avatar';

interface OverviewChatDrawerProps {
  onClose: () => void;
}

const EMPTY_CHAT: never[] = [];

const OverviewChatDrawer: React.FC<OverviewChatDrawerProps> = ({ onClose }) => {
  const activeTeam = useActiveTeam();
  const agents = getAllAgents(activeTeam);
  const lead = activeTeam.leadAgent;
  const { selectedNpcIndex, isThinking, setSettingsOpen } = useUiStore();
  const { llmConfig, isDemoMode } = useUiStore();
  const agentIndex = selectedNpcIndex ?? lead.index;
  const agent = agents.find((a) => a.index === agentIndex) ?? lead;
  const chatMessages = useCoreStore((s) => s.agentHistories[agentIndex] ?? EMPTY_CHAT);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openOverviewChat(agentIndex);
  }, [agentIndex]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages, isThinking]);

  const hasKey = !!llmConfig.apiKey;
  const canChat = hasKey && !isDemoMode;

  const handleSend = async () => {
    if (!input.trim() || isThinking || !canChat) return;
    const text = input;
    setInput('');
    await sendOverviewChatMessage(text);
  };

  return (
    <div className="fixed inset-y-[52px] right-0 w-[min(380px,92vw)] z-[640] flex flex-col glass-panel-elevated border-l shadow-2xl animate-modal-in">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--apple-border)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <MessageSquare size={16} className="text-appleBlue shrink-0" />
          <div className="min-w-0 text-left">
            <p className="text-[13px] font-semibold truncate text-[var(--apple-text)]">Chat — no 3D required</p>
            <p className="text-[11px] truncate text-[var(--apple-text-secondary)]">{agent.name}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04]" aria-label="Close chat">
          <X size={18} />
        </button>
      </div>

      {!canChat && (
        <div className="px-4 py-3 text-[12px] bg-orange-50 border-b border-orange-100 text-orange-900">
          {isDemoMode ? 'Add an API key in Settings to chat with agents.' : 'Connect an AI provider in Settings to chat.'}
          <button type="button" onClick={() => setSettingsOpen(true)} className="ml-2 text-appleBlue font-semibold hover:underline">
            Settings
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {chatMessages.filter((m) => !m.metadata?.internal).map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed border ${
                msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'
              }`}
              style={msg.role === 'user' ? { backgroundColor: USER_COLOR_LIGHT, borderColor: USER_COLOR_SOFT } : { backgroundColor: 'var(--apple-surface)' }}
            >
              {msg.role === 'assistant' ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || '…'}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex items-center gap-2 text-[12px] text-[var(--apple-text-secondary)]">
            <Avatar type={agent.index === lead.index ? 'lead' : 'sub'} color={agent.color} size={24} />
            Thinking…
          </div>
        )}
      </div>

      <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--apple-border)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder={canChat ? `Message ${agent.name.split(' ')[0]}…` : 'Add API key to chat'}
          disabled={!canChat || isThinking}
          className="flex-1 theme-input rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-appleBlue/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canChat || isThinking || !input.trim()}
          className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-appleBlue disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default OverviewChatDrawer;
