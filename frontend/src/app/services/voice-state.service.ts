import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export enum VoiceState {
  IDLE        = 'IDLE',
  LISTENING   = 'LISTENING',
  PROCESSING  = 'PROCESSING',
  SPEAKING    = 'SPEAKING',
  INTERRUPTED = 'INTERRUPTED',
}

@Injectable({
  providedIn: 'root',
})
export class VoiceStateService {
  // ── State machine ────────────────────────────────────────
  private stateSubject = new BehaviorSubject<VoiceState>(VoiceState.IDLE);
  readonly state$: Observable<VoiceState> = this.stateSubject.asObservable();

  // ── Volume level (0–1) with EMA smoothing ────────────────
  private volumeSubject = new BehaviorSubject<number>(0);
  readonly volumeLevel$: Observable<number> = this.volumeSubject.asObservable();

  /** Smoothing factor (0–1). Lower = smoother/slower, higher = more responsive. */
  private readonly SMOOTHING = 0.28;
  private smoothedVolume = 0;

  // ── Interruption flag ────────────────────────────────────
  private interruptedSubject = new BehaviorSubject<boolean>(false);
  readonly isInterrupted$: Observable<boolean> = this.interruptedSubject.asObservable();

  // ── Getters ──────────────────────────────────────────────
  get state(): VoiceState {
    return this.stateSubject.value;
  }

  get volumeLevel(): number {
    return this.volumeSubject.value;
  }

  get isInterrupted(): boolean {
    return this.interruptedSubject.value;
  }

  // ── Setters ──────────────────────────────────────────────
  setState(state: VoiceState): void {
    this.stateSubject.next(state);
  }

  /**
   * Set volume level with EMA smoothing so raw noise spikes
   * translate into flowing, natural-feeling motion.
   */
  setVolume(level: number): void {
    const raw = Math.min(1, Math.max(0, level));
    this.smoothedVolume = this.SMOOTHING * raw + (1 - this.SMOOTHING) * this.smoothedVolume;
    this.volumeSubject.next(this.smoothedVolume);
  }

  setInterrupted(val: boolean): void {
    this.interruptedSubject.next(val);
  }

  /** Reset all state to defaults */
  reset(): void {
    this.stateSubject.next(VoiceState.IDLE);
    this.smoothedVolume = 0;
    this.volumeSubject.next(0);
    this.interruptedSubject.next(false);
  }
}
