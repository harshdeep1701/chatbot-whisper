import { Component, Input, OnChanges, SimpleChanges, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceState } from '../../../core/models/speech.models';

@Component({
  selector: 'app-voice-sphere',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voice-sphere.component.html',
  styleUrls: ['./voice-sphere.component.scss'],
})
export class VoiceSphereComponent implements OnChanges {
  @Input() state: VoiceState = 'IDLE';
  @Input() volume: number = 0;

  /** Bound to [style.--ring-duration] in the template */
  ringDuration = '1.5s';
  /** Bound to [style.--ring-max-scale] */
  ringMaxScale = '2.5';

  /** Current CSS state class */
  stateClass = 'idle';

  /** For rendering inside the center circle */
  ringCount = Array.from({ length: 3 }, (_, i) => i + 1);

  constructor(
    private ngZone: NgZone,
    private el: ElementRef<HTMLElement>,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['state']) {
      this.stateClass = this.state?.toLowerCase() ?? 'idle';
    }
    if (changes['volume'] || changes['state']) {
      this.updateRingParams();
    }
  }

  /**
   * Called externally or by a parent requestAnimationFrame loop to
   * apply smooth CSS-var updates. The parent drives this to avoid
   * multiple animation loops.
   */
  update(): void {
    const state = this.state ?? 'IDLE';
    let vol = this.volume ?? 0;

    // Boost idle volume so rings are always slightly visible
    if (state === 'IDLE') {
      vol = 0.05 + Math.sin(Date.now() / 1000) * 0.05;
    }

    this.ringDuration = `${Math.max(0.6, 1.8 - vol * 1.2).toFixed(2)}s`;
    this.ringMaxScale = `${(1 + vol * 2.5).toFixed(2)}`;
    this.stateClass = state.toLowerCase();
  }

  private updateRingParams(): void {
    this.update();
  }
}
