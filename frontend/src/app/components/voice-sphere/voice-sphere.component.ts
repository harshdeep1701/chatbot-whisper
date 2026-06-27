import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { VoiceState } from '../../services/voice-state.service';

@Component({
  selector: 'app-voice-sphere',
  templateUrl: './voice-sphere.component.html',
  styleUrls: ['./voice-sphere.component.scss'],
})
export class VoiceSphereComponent implements OnChanges {
  @Input() voiceState: VoiceState | null = null;
  @Input() volume: number = 0;

  /** CSS custom-property values bound via [style] */
  ringColor = 'rgba(255, 255, 255, 0.3)';
  ringDuration = '1.5s';
  ringMaxScale = '2.5';

  /** Which state-class to apply */
  stateClass: string = 'idle';

  /** Resolved voice state, falling back to IDLE when null */
  get resolvedState(): VoiceState {
    return this.voiceState ?? VoiceState.IDLE;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['voiceState']) {
      this.updateRingColor();
      this.stateClass = this.resolvedState.toLowerCase();
    }
    if (changes['volume'] || changes['voiceState']) {
      this.updateRingParams();
    }
  }

  private updateRingColor(): void {
    switch (this.resolvedState) {
      case VoiceState.LISTENING:
      case VoiceState.PROCESSING:
        this.ringColor = '#4A9EFF';
        break;
      case VoiceState.SPEAKING:
        this.ringColor = '#FF8C42';
        break;
      case VoiceState.INTERRUPTED:
        this.ringColor = '#FFD700';
        break;
      default:
        this.ringColor = 'rgba(255, 255, 255, 0.3)';
        break;
    }
  }

  private updateRingParams(): void {
    // Map volume 0–1 → duration 2.2s–0.7s (louder = faster)
    const speed = 2.2 - this.volume * 1.5;
    this.ringDuration = `${Math.max(0.7, speed)}s`;

    // Map volume 0–1 → max-scale 2–5 (louder = bigger rings)
    const scale = 2 + this.volume * 3;
    this.ringMaxScale = `${scale}`;
  }
}
