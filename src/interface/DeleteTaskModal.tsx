import { Trash2 } from 'lucide-react';
import React from 'react';
import Modal from './components/Modal';

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  taskTitle?: string;
}

const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({ isOpen, onClose, onConfirm, taskTitle }) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    title="Delete Task?"
    subtitle="This action cannot be undone"
    icon={<Trash2 size={18} className="text-red-500" />}
    size="md"
  >
    <p className="text-[14px] leading-relaxed text-[var(--apple-text-secondary)] mb-6">
      {taskTitle ? (
        <>Delete <span className="font-semibold text-[var(--apple-text)]">"{taskTitle}"</span>?</>
      ) : (
        'Are you sure you want to delete this task?'
      )}
    </p>
    <div className="flex gap-2.5">
      <button
        onClick={onClose}
        className="flex-1 py-3 rounded-xl text-[14px] font-medium text-zinc-600 bg-black/[0.04] hover:bg-black/[0.07] transition-apple"
      >
        Cancel
      </button>
      <button
        onClick={() => { onConfirm(); onClose(); }}
        className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-apple active:scale-[0.98]"
      >
        Delete
      </button>
    </div>
  </Modal>
);

export default DeleteTaskModal;
