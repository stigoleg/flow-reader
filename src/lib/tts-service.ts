/**
 * Text-to-Speech Service
 * 
 * Provides text-to-speech functionality using the Web Speech API.
 * Features:
 * - Voice selection
 * - Rate and pitch control
 * - Pause/resume
 * - Boundary events for word highlighting
 */

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export interface TTSSettings {
  enabled: boolean;
  voiceId: string | null;
  rate: number;  // 0.5 - 2.0
  pitch: number; // 0 - 2
  volume: number; // 0 - 1
  highlightMode: 'none' | 'word' | 'sentence';
}

export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  enabled: false,
  voiceId: null,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  highlightMode: 'sentence',
};

export type TTSState = 'idle' | 'speaking' | 'paused';

export interface TTSBoundaryEvent {
  charIndex: number;
  charLength: number;
  name: string;
}

type BoundaryCallback = (event: TTSBoundaryEvent) => void;
type StateCallback = (state: TTSState) => void;
type EndCallback = () => void;

class TTSService {
  private synth: SpeechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  private voiceLoadPromise: Promise<SpeechSynthesisVoice[]> | null = null;
  
  private boundaryCallbacks: BoundaryCallback[] = [];
  private stateCallbacks: StateCallback[] = [];
  private endCallbacks: EndCallback[] = [];
  
  private currentState: TTSState = 'idle';
  private settings: TTSSettings = DEFAULT_TTS_SETTINGS;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  /**
   * Get available voices, waiting for them to load if necessary
   */
  async getVoices(): Promise<TTSVoice[]> {
    // Return cached promise if already loading
    if (this.voiceLoadPromise) {
      const voices = await this.voiceLoadPromise;
      return this.mapVoices(voices);
    }
    
    // Try to get voices immediately
    const voices = this.synth.getVoices();
    if (voices.length > 0) {
      return this.mapVoices(voices);
    }
    
    // Wait for voices to load (Chrome)
    this.voiceLoadPromise = new Promise((resolve) => {
      const checkVoices = () => {
        const v = this.synth.getVoices();
        if (v.length > 0) {
          resolve(v);
          return;
        }
        // Keep checking
        setTimeout(checkVoices, 100);
      };
      
      // Set up voiceschanged handler
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          resolve(this.synth.getVoices());
        };
      }
      
      // Start polling as fallback
      checkVoices();
      
      // Timeout after 5 seconds
      setTimeout(() => {
        resolve(this.synth.getVoices());
      }, 5000);
    });
    
    const loadedVoices = await this.voiceLoadPromise;
    return this.mapVoices(loadedVoices);
  }

  private mapVoices(voices: SpeechSynthesisVoice[]): TTSVoice[] {
    return voices.map(v => ({
      id: v.voiceURI,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      default: v.default,
    }));
  }

  private findVoice(voiceId: string | null): SpeechSynthesisVoice | null {
    if (!voiceId) return null;
    const voices = this.synth.getVoices();
    return voices.find(v => v.voiceURI === voiceId) || null;
  }

  /**
   * Update TTS settings
   */
  updateSettings(settings: Partial<TTSSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): TTSSettings {
    return { ...this.settings };
  }

  /**
   * Start speaking text
   */
  speak(text: string, options?: Partial<TTSSettings>): void {
    // Cancel any ongoing speech
    this.stop();
    
    const mergedSettings = { ...this.settings, ...options };
    
    this.utterance = new SpeechSynthesisUtterance(text);
    
    // Apply settings
    this.utterance.rate = mergedSettings.rate;
    this.utterance.pitch = mergedSettings.pitch;
    this.utterance.volume = mergedSettings.volume;
    
    // Set voice if specified
    const voice = this.findVoice(mergedSettings.voiceId);
    if (voice) {
      this.utterance.voice = voice;
    }
    
    // Set up event handlers
    this.utterance.onstart = () => {
      this.setState('speaking');
    };
    
    this.utterance.onend = () => {
      this.setState('idle');
      this.endCallbacks.forEach(cb => cb());
    };
    
    this.utterance.onerror = (event) => {
      // 'interrupted' and 'canceled' are not errors
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.error('[TTS] Speech error:', event.error);
      }
      this.setState('idle');
    };
    
    this.utterance.onpause = () => {
      this.setState('paused');
    };
    
    this.utterance.onresume = () => {
      this.setState('speaking');
    };
    
    this.utterance.onboundary = (event) => {
      this.boundaryCallbacks.forEach(cb => cb({
        charIndex: event.charIndex,
        charLength: event.charLength || 0,
        name: event.name,
      }));
    };
    
    // Start speaking
    this.synth.speak(this.utterance);
  }

  /**
   * Pause speech
   */
  pause(): void {
    if (this.currentState === 'speaking') {
      this.synth.pause();
    }
  }

  /**
   * Resume speech
   */
  resume(): void {
    if (this.currentState === 'paused') {
      this.synth.resume();
    }
  }

  /**
   * Stop speech entirely
   */
  stop(): void {
    this.synth.cancel();
    this.utterance = null;
    this.setState('idle');
  }

  /**
   * Toggle pause/resume
   */
  toggle(): void {
    if (this.currentState === 'speaking') {
      this.pause();
    } else if (this.currentState === 'paused') {
      this.resume();
    }
  }

  /**
   * Get current state
   */
  getState(): TTSState {
    return this.currentState;
  }

  /**
   * Check if TTS is available
   */
  isAvailable(): boolean {
    return 'speechSynthesis' in window;
  }

  /**
   * Subscribe to boundary events (word boundaries during speech)
   */
  onBoundary(callback: BoundaryCallback): () => void {
    this.boundaryCallbacks.push(callback);
    return () => {
      this.boundaryCallbacks = this.boundaryCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Subscribe to speech end events
   */
  onEnd(callback: EndCallback): () => void {
    this.endCallbacks.push(callback);
    return () => {
      this.endCallbacks = this.endCallbacks.filter(cb => cb !== callback);
    };
  }

  private setState(state: TTSState): void {
    if (this.currentState !== state) {
      this.currentState = state;
      this.stateCallbacks.forEach(cb => cb(state));
    }
  }
}

// Singleton instance
export const ttsService = new TTSService();
