import { AlertTriangle, RefreshCcw } from 'lucide-react';
import React from 'react';
import Modal from './components/Modal';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ResetModal: React.FC<ResetModalProps> = ({ isOpen, onClose, onConfirm }) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    title="Start New Project?"
    subtitle="This clears your brief, tasks, logs, and conversation history"
    icon={<AlertTriangle size={18} className="text-orange-500" />}
    size="md"
  >
    <p className="text-[14px] leading-relaxed text-[var(--apple-text-secondary)] mb-6">
      Your team will return to their starting positions and the project will revert to idle. This cannot be undone.
    </p>
    <div className="flex flex-col gap-2.5">
      <button
        onClick={() => { onConfirm(); onClose(); }}
        className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-white bg-[var(--apple-text)] hover:opacity-90 transition-apple active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <RefreshCcw size={15} />
        Reset Everything
      </button>
      <button
        onClick={onClose}
        className="w-full py-3.5 rounded-xl text-[14px] font-medium text-zinc-600 bg-black/[0.04] hover:bg-black/[0.07] transition-apple"
      >
        Cancel
      </button>
    </div>
  </Modal>
);

export default ResetModal;
