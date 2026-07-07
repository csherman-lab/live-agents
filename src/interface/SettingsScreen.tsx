import { Settings } from 'lucide-react';
import React from 'react';
import Modal from './components/Modal';
import SettingsPanel from './SettingsPanel';

interface SettingsScreenProps {
  open: boolean;
  onClose: () => void;
  onReplayOnboarding?: () => void;
  onOpenShortcuts?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ open, onClose, onReplayOnboarding, onOpenShortcuts }) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Settings"
    subtitle="Configure API keys, display preferences, and your workspace"
    size="lg"
    icon={<Settings size={18} className="text-appleBlue" />}
  >
    <SettingsPanel onReplayOnboarding={onReplayOnboarding} onOpenShortcuts={onOpenShortcuts} />
  </Modal>
);

export default SettingsScreen;
