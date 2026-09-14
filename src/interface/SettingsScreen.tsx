import { Settings } from 'lucide-react';
import React from 'react';
import Modal from './components/Modal';
import SettingsPanel from './SettingsPanel';

interface SettingsScreenProps {
  open: boolean;
  onClose: () => void;
  onReplayOnboarding?: () => void;
  onOpenShortcuts?: () => void;
  onOpenAdvanced?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({
  open,
  onClose,
  onReplayOnboarding,
  onOpenShortcuts,
  onOpenAdvanced,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Settings"
    subtitle="Companion preferences — Advanced tools are optional"
    size="lg"
    icon={<Settings size={18} className="text-appleBlue" />}
  >
    <SettingsPanel
      onReplayOnboarding={onReplayOnboarding}
      onOpenShortcuts={onOpenShortcuts}
      onOpenAdvanced={onOpenAdvanced}
    />
  </Modal>
);

export default SettingsScreen;
