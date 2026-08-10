import React from 'react';

interface NameplateProps {
  name: string;
  agentColor: string;
  position: { x: number; y: number };
  yOffset?: number;
  dimmed?: boolean;
}

/**
 * Minimal, low-noise in-sim label anchored above an NPC's head.
 *
 * Deliberately styled as a dark HUD chip (distinct from the light glass
 * AgentHeadBubble "speech" bubbles) so it reads as persistent command-center
 * chrome rather than a transient thought/status callout. Mirrors the
 * absolute + translate(-50%, -100%) anchoring pattern used by
 * AgentHeadBubble, reusing the same `npcScreenPositions` projection.
 */
const Nameplate: React.FC<NameplateProps> = ({
  name,
  agentColor,
  position,
  yOffset = -10,
  dimmed = false,
}) => {
  return (
    <div
      className="absolute z-[12] pointer-events-none transition-all duration-300 ease-out"
      style={{
        left: position.x,
        top: position.y,
        transform: `translate(-50%, -100%) translateY(${yOffset}px)`,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 backdrop-blur-md px-2 py-[3px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 ring-1 ring-white/20"
          style={{ backgroundColor: agentColor }}
          aria-hidden
        />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-white/90 leading-none whitespace-nowrap">
          {name}
        </span>
      </div>
    </div>
  );
};

export default Nameplate;
