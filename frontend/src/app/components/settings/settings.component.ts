import { Component, EventEmitter, Output } from '@angular/core';
import { environment } from '../../../environments/environment';

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
    this.checkBackendHealth();
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
