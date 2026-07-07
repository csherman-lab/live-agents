import { Info } from 'lucide-react';
import React from 'react';
import Modal from './components/Modal';

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ open, onClose }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="About Live Agents"
    subtitle="Your command center for autonomous AI teams"
    size="md"
    icon={<Info size={18} className="text-appleBlue" />}
  >
    <div className="flex justify-center mb-6">
      <img src="/images/live-agents-mark.svg" alt="" className="w-14 h-14" />
    </div>

    <div className="space-y-4 text-[15px] leading-relaxed text-[var(--apple-text-secondary)]">
      <p>
        Live Agents is a workspace for running multi-agent AI projects. You write a brief, assign a team of specialists, and watch them plan, collaborate, and deliver — in a living 3D office you can walk through.
      </p>
      <p>
        Start in the Command Center to configure your team, pick a project template, and connect your Gemini API key. When you are ready, Go Live to enter the immersive workspace, follow each agent&apos;s progress, review outputs, and export finished deliverables.
      </p>
      <p>
        Design mode lets you customize teams, roles, and workflows. Agent memory, activity logs, and cost tracking persist across sessions — all stored locally in your browser.
      </p>
    </div>
  </Modal>
);

export default InfoModal;
