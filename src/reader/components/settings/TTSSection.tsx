import { useState, useEffect } from 'react';
import { ttsService, type TTSVoice } from '@/lib/tts-service';
import type { ReaderSettings } from '@/types';

interface TTSSectionProps {
  settings: ReaderSettings;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
}

export default function TTSSection({ settings, updateSettings }: TTSSectionProps) {
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isAvailable = ttsService.isAvailable();

  // Load available voices
  useEffect(() => {
    if (!isAvailable) {
      setLoading(false);
      return;
    }

    ttsService.getVoices().then((v) => {
      setVoices(v);
      setLoading(false);
    });
  }, [isAvailable]);

  // Group voices by language
  const voicesByLang = voices.reduce((acc, voice) => {
    const lang = voice.lang.split('-')[0]; // 'en-US' -> 'en'
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(voice);
    return acc;
  }, {} as Record<string, TTSVoice[]>);

  // Test the current voice
  const testVoice = () => {
    ttsService.speak('Hello! This is a test of the text-to-speech voice.', {
      voiceId: settings.ttsVoiceId,
      rate: settings.ttsRate,
      pitch: settings.ttsPitch,
      volume: settings.ttsVolume,
    });
  };

  if (!isAvailable) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium opacity-60 uppercase tracking-wide">
          Text-to-Speech
        </h3>
        <p className="text-sm opacity-50">
          Text-to-speech is not available in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium opacity-60 uppercase tracking-wide">
        Text-to-Speech
      </h3>

      {/* Enable TTS */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">Enable TTS</span>
        <input
          type="checkbox"
          checked={settings.ttsEnabled}
          onChange={(e) => updateSettings({ ttsEnabled: e.target.checked })}
          className="w-5 h-5 rounded"
        />
      </label>

      {settings.ttsEnabled && (
        <>
          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="text-sm opacity-70">Voice</label>
            {loading ? (
              <div className="text-sm opacity-50">Loading voices...</div>
            ) : (
              <select
                value={settings.ttsVoiceId || ''}
                onChange={(e) => updateSettings({ ttsVoiceId: e.target.value || null })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  backgroundColor: 'rgba(128, 128, 128, 0.1)',
                  border: '1px solid rgba(128, 128, 128, 0.2)',
                }}
              >
                <option value="">System Default</option>
                {Object.entries(voicesByLang).map(([lang, langVoices]) => (
                  <optgroup key={lang} label={lang.toUpperCase()}>
                    {langVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} {voice.localService ? '(Local)' : '(Network)'}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Speed/Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm opacity-70">Speed</label>
              <span className="text-sm font-mono">{settings.ttsRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.ttsRate}
              onChange={(e) => updateSettings({ ttsRate: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Pitch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm opacity-70">Pitch</label>
              <span className="text-sm font-mono">{settings.ttsPitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={settings.ttsPitch}
              onChange={(e) => updateSettings({ ttsPitch: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm opacity-70">Volume</label>
              <span className="text-sm font-mono">{Math.round(settings.ttsVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.ttsVolume}
              onChange={(e) => updateSettings({ ttsVolume: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Highlight Mode */}
          <div className="space-y-2">
            <label className="text-sm opacity-70">Highlight during speech</label>
            <select
              value={settings.ttsHighlightMode}
              onChange={(e) => updateSettings({ ttsHighlightMode: e.target.value as 'none' | 'word' | 'sentence' })}
              className="w-full px-3 py-2 rounded text-sm"
              style={{
                backgroundColor: 'rgba(128, 128, 128, 0.1)',
                border: '1px solid rgba(128, 128, 128, 0.2)',
              }}
            >
              <option value="none">None</option>
              <option value="word">Current word</option>
              <option value="sentence">Current sentence</option>
            </select>
          </div>

          {/* Test Voice Button */}
          <button
            onClick={testVoice}
            className="w-full px-4 py-2 rounded text-sm transition-colors"
            style={{
              backgroundColor: 'rgba(128, 128, 128, 0.15)',
              border: '1px solid rgba(128, 128, 128, 0.2)',
            }}
          >
            Test Voice
          </button>
        </>
      )}
    </div>
  );
}
