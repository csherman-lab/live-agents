import {
  Briefcase,
  CheckCircle2,
  Coffee,
  Footprints,
  Loader2,
  MessageCircle,
  PartyPopper,
  Sparkles,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import React from 'react';
import type { AgentBubbleContent, BubbleIcon } from '../../utils/agentStatus';
import { withHexAlpha } from '../../theme/brand';

const ICON_MAP: Record<BubbleIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  brief: Briefcase,
  work: Wrench,
  walk: Footprints,
  chat: MessageCircle,
  alert: TriangleAlert,
  check: CheckCircle2,
  sparkle: Sparkles,
  loader: Loader2,
  coffee: Coffee,
  party: PartyPopper,
};

const TONE_RING: Record<AgentBubbleContent['tone'], string> = {
  idle: 'ring-zinc-200/80',
  ready: 'ring-appleBlue/25',
  working: 'ring-emerald-400/30',
  moving: 'ring-sky-400/30',
  talking: 'ring-violet-400/30',
  approval: 'ring-orange-400/40',
  done: 'ring-amber-400/35',
  delivering: 'ring-indigo-400/35',
  waiting: 'ring-zinc-300/70',
};

interface AgentHeadBubbleProps {
  content: AgentBubbleContent;
  agentColor: string;
  agentName?: string;
  variant?: 'ambient' | 'focused';
  position: { x: number; y: number };
  yOffset?: number;
  onClick?: () => void;
}

const AgentHeadBubble: React.FC<AgentHeadBubbleProps> = ({
  content,
  agentColor,
  agentName,
  variant = 'ambient',
  position,
  yOffset = -20,
  onClick,
}) => {
  if (!content.primary?.trim()) return null;

  const Icon = ICON_MAP[content.icon];
  const isFocused = variant === 'focused';
  const interactive = !!onClick && (content.clickable || isFocused);

  return (
    <div
      className={`absolute z-[15] transition-all duration-300 ease-out ${
        interactive ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
      }`}
      style={{
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -100%) translateY(${yOffset}px)`,
      }}
      onClick={(e) => {
        if (!interactive || !onClick) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <div
        className={[
          'relative flex items-center gap-2.5 rounded-2xl border backdrop-blur-xl',
          'bg-white/[0.94] border-black/[0.07]',
          'shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)]',
          isFocused ? 'px-3.5 py-2.5 min-w-[140px] max-w-[240px]' : 'px-2.5 py-2 max-w-[200px]',
          interactive ? 'hover:shadow-[0_14px_44px_-10px_rgba(0,0,0,0.22)] hover:-translate-y-0.5 active:scale-[0.98]' : '',
          'ring-1 transition-transform',
          TONE_RING[content.tone],
          content.urgent && !isFocused ? 'animate-bubble-attention' : '',
        ].join(' ')}
      >
        <div
          className={`shrink-0 rounded-full flex items-center justify-center ring-1 ring-black/[0.04] ${
            isFocused ? 'w-8 h-8' : 'w-7 h-7'
          }`}
          style={{ backgroundColor: withHexAlpha(agentColor, '24'), color: agentColor }}
        >
          <Icon
            size={isFocused ? 15 : 13}
            className={content.icon === 'loader' ? 'animate-spin' : ''}
          />
        </div>

        <div className="min-w-0 flex-1">
          {isFocused && agentName && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 truncate mb-0.5">
              {agentName}
            </p>
          )}
          <p
            className={`font-semibold text-[#1D1D1F] leading-snug ${
              isFocused ? 'text-[12px] line-clamp-2' : 'text-[11px] truncate'
            }`}
          >
            {content.primary}
          </p>
          {content.secondary && (
            <p
              className={`text-zinc-500 leading-snug mt-0.5 ${
                isFocused ? 'text-[11px] line-clamp-2' : 'text-[10px] truncate'
              }`}
            >
              {content.secondary}
            </p>
          )}
        </div>

        {/* Speech tail */}
        <div
          className="absolute left-1/2 -bottom-[5px] w-2.5 h-2.5 -translate-x-1/2 rotate-45 bg-white/[0.94] border-r border-b border-black/[0.07]"
          aria-hidden
        />
      </div>
    </div>
  );
};

export default AgentHeadBubble;
