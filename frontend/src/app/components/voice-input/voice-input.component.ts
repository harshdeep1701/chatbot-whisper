import { Component, EventEmitter, Output } from '@angular/core';
import { SpeechService } from '../../services/speech.service';

@Component({
  selector: 'app-voice-input',
  templateUrl: './voice-input.component.html',
  styleUrls: ['./voice-input.component.scss']
})
export class VoiceInputComponent {
  @Output() voiceText = new EventEmitter<string>();

  isListening = false;

  constructor(private speechService: SpeechService) {}

  toggleListening(): void {
    if (this.isListening) {
      this.speechService.stopListening();
      this.isListening = false;
    } else {
      this.isListening = true;
      this.speechService.startListening();
      this.speechService.speechEvents$.subscribe(event => {
        if (event.type === 'final' && event.text) {
          this.voiceText.emit(event.text);
          this.isListening = false;
        }
        if (event.type === 'error') {
          this.isListening = false;
        }
      });
    }
  }
}
