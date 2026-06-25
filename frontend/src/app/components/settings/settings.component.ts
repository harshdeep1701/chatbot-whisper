import { Component, EventEmitter, Output } from '@angular/core';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'cosmo-chat-settings';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  @Output() close = new EventEmitter<void>();

  // Backend connection
  backendUrl = environment.apiUrl;
  backendStatus: 'checking' | 'connected' | 'disconnected' = 'checking';

  // Speech settings
  sttProvider: 'browser' | 'whisper' = 'browser';
  ttsProvider: 'browser' | 'server' = 'browser';
  voiceName = 'alloy';
  autoSpeak = false;

  // LLM settings
  modelName = environment.deepseekModel;
  temperature = 0.7;
  maxTokens = 2048;

  ngOnInit(): void {
    this.loadSettings();
    this.checkBackendHealth();
  }

  /** Load persisted settings from localStorage */
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.sttProvider) this.sttProvider = settings.sttProvider;
        if (settings.ttsProvider) this.ttsProvider = settings.ttsProvider;
        if (settings.voiceName) this.voiceName = settings.voiceName;
        if (settings.autoSpeak !== undefined) this.autoSpeak = settings.autoSpeak;
      }
    } catch { /* ignore corrupt data */ }
  }

  /** Persist settings to localStorage whenever a value changes */
  onSttChange(): void {
    this.saveSettings();
  }

  onTtsChange(): void {
    this.saveSettings();
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sttProvider: this.sttProvider,
        ttsProvider: this.ttsProvider,
        voiceName: this.voiceName,
        autoSpeak: this.autoSpeak
      }));
    } catch { /* storage full — ignore */ }
  }

  private checkBackendHealth(): void {
    import('../../services/chat.service').then(({ ChatService }) => {
      // We check via import - but since we can't inject here easily,
      // we'll use fetch directly
      fetch(`${this.backendUrl}/chat/health`, { mode: 'cors' })
        .then(res => {
          this.backendStatus = res.ok ? 'connected' : 'disconnected';
        })
        .catch(() => {
          this.backendStatus = 'disconnected';
        });
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
