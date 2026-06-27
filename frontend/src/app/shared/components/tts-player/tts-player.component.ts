import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SpeechService } from '../../services/speech.service';

@Component({
  selector: 'app-tts-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tts-player.component.html',
  styleUrls: ['./tts-player.component.scss'],
})
export class TtsPlayerComponent implements OnChanges, OnDestroy {
  /** Text to synthesise and play */
  @Input() text = '';

  /** If true, play immediately on text change */
  @Input() autoPlay = false;

  /** Emitted when playback begins */
  @Output() started = new EventEmitter<void>();

  /** Emitted when playback finishes naturally */
  @Output() ended = new EventEmitter<void>();

  /** Emitted when playback is interrupted */
  @Output() interrupted = new EventEmitter<void>();

  // ── UI state ─────────────────────────────────────────────
  isPlaying = false;
  progress = 0; // 0–100

  private subs: Subscription[] = [];
  private progressInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private speechService: SpeechService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['text'] && this.autoPlay && this.text) {
      this.play();
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  // ── Public API ───────────────────────────────────────────

  /** Start playback */
  play(): void {
    if (!this.text || this.isPlaying) return;

    this.isPlaying = true;
    this.progress = 0;
    this.started.emit();

    this.speechService.synthesize(this.text).subscribe({
      next: buffer => {
        this.startProgressTracking();
        const sub = this.speechService.playTts(buffer).subscribe({
          next: event => {
            if (event.type === 'ended') {
              this.onFinished();
              this.ended.emit();
            }
            if (event.type === 'interrupted') {
              this.onFinished();
              this.interrupted.emit();
            }
          },
          error: () => this.onFinished(),
        });
        this.subs.push(sub);
      },
      error: () => this.onFinished(),
    });
  }

  /** Stop playback immediately */
  stop(): void {
    if (this.isPlaying) {
      this.speechService.stopTts();
      this.onFinished();
      this.interrupted.emit();
    }
  }

  // ── Internals ────────────────────────────────────────────

  private startProgressTracking(): void {
    this.progress = 0;
    this.progressInterval = setInterval(() => {
      if (this.progress < 95) {
        this.progress += 0.5;
      }
    }, 100);
  }

  private onFinished(): void {
    this.isPlaying = false;
    this.progress = 100;
    this.stopProgressTracking();
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}
