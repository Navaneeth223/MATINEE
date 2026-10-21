import { useState, useEffect } from 'react';

interface SettingsPanelProps {
  onClose: () => void;
  onVolumeChange?: (volume: number) => void;
  onQualityChange?: (quality: 'auto' | 'high' | 'medium' | 'low') => void;
  currentVolume?: number;
  currentQuality?: 'auto' | 'high' | 'medium' | 'low';
}

const QUALITY_PRESETS = {
  auto: { label: 'Auto', description: 'Adapt to network' },
  high: { label: 'High', description: '1080p • 5 Mbps' },
  medium: { label: 'Medium', description: '720p • 2.5 Mbps' },
  low: { label: 'Low', description: '480p • 1 Mbps' },
};

export function SettingsPanel({
  onClose,
  onVolumeChange,
  onQualityChange,
  currentVolume = 100,
  currentQuality = 'auto',
}: SettingsPanelProps) {
  const [volume, setVolume] = useState(currentVolume);
  const [quality, setQuality] = useState<'auto' | 'high' | 'medium' | 'low'>(currentQuality);

  useEffect(() => {
    setVolume(currentVolume);
  }, [currentVolume]);

  useEffect(() => {
    setQuality(currentQuality);
  }, [currentQuality]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    onVolumeChange?.(newVolume);
  };

  const handleQualityChange = (newQuality: 'auto' | 'high' | 'medium' | 'low') => {
    setQuality(newQuality);
    onQualityChange?.(newQuality);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button onClick={onClose} className="settings-close">✕</button>
        </div>

        <div className="settings-section">
          <label className="settings-label">
            Volume
            <span className="settings-value">{volume}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="settings-slider"
          />
        </div>

        <div className="settings-section">
          <label className="settings-label">Video Quality</label>
          <div className="settings-options">
            {(Object.keys(QUALITY_PRESETS) as Array<keyof typeof QUALITY_PRESETS>).map((key) => (
              <button
                key={key}
                onClick={() => handleQualityChange(key)}
                className={`settings-option ${quality === key ? 'active' : ''}`}
              >
                <div className="settings-option-label">{QUALITY_PRESETS[key].label}</div>
                <div className="settings-option-desc">{QUALITY_PRESETS[key].description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <label className="settings-label">Keyboard Shortcuts</label>
          <div className="settings-shortcuts">
            <div className="shortcut-row">
              <kbd>Space</kbd>
              <span>Play / Pause</span>
            </div>
            <div className="shortcut-row">
              <kbd>F</kbd>
              <span>Fullscreen</span>
            </div>
            <div className="shortcut-row">
              <kbd>M</kbd>
              <span>Mute / Unmute</span>
            </div>
            <div className="shortcut-row">
              <kbd>←</kbd> <kbd>→</kbd>
              <span>Seek ±10s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
