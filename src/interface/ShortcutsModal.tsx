import { Keyboard } from 'lucide-react';
import React from 'react';
import Modal from './components/Modal';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['G'], label: 'Go Live (enter workspace)' },
  { keys: ['O'], label: 'Overview (Command Center)' },
  { keys: ['T'], label: 'Teams (Design mode)' },
  { keys: ['S'], label: 'Settings' },
  { keys: ['1', '–', '9'], label: 'Select agent by number' },
  { keys: ['Esc'], label: 'Close modal / panel' },
  { keys: ['?'], label: 'Keyboard shortcuts' },
];

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Keyboard Shortcuts"
    subtitle="Works when you are not typing in a text field"
    size="md"
    icon={<Keyboard size={18} className="text-appleBlue" />}
  >
    <ul className="flex flex-col gap-2">
      {SHORTCUTS.map((item) => (
        <li
          key={item.label}
          className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-xl border bg-[var(--apple-surface)]"
          style={{ borderColor: 'var(--apple-border)' }}
        >
          <span className="text-[13px] text-[var(--apple-text)]">{item.label}</span>
          <span className="flex items-center gap-1 shrink-0">
            {item.keys.map((key, i) => (
              <React.Fragment key={`${item.label}-${key}-${i}`}>
                {i > 0 && key === '–' ? (
                  <span className="text-[10px] text-zinc-400 px-0.5">–</span>
                ) : key !== '–' ? (
                  <kbd className="min-w-[28px] text-center px-2 py-1 rounded-lg bg-black/[0.05] text-[11px] font-semibold text-[var(--apple-text-secondary)]">
                    {key}
                  </kbd>
                ) : null}
              </React.Fragment>
            ))}
          </span>
        </li>
      ))}
    </ul>
  </Modal>
);

export default ShortcutsModal;
