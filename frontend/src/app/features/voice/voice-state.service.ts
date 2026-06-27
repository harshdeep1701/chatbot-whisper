import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { VoiceState } from '../../core/models/speech.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VoiceStateService {
  // ── Configuration ───────────────────────────────────────
  readonly bargeInThreshold = (environment as any).bargeInThreshold ?? 0.04;
  private readonly BARGE_IN_DURATION_MS = 200;
  private readonly INTERRUPTED_DEBOUNCE_MS = 300;

  // ── State ───────────────────────────────────────────────
  private stateSubject = new BehaviorSubject<VoiceState>('IDLE');
  readonly state$: Observable<VoiceState> = this.stateSubject.asObservable();

  // ── Volume level (0–1) with EMA smoothing ────────────────
  private volumeSubject = new BehaviorSubject<number>(0);
  readonly volumeLevel$: Observable<number> = this.volumeSubject.asObservable();

  private readonly SMOOTHING = 0.28;
  private smoothedVolume = 0;

  // ── Barge-in detection state ─────────────────────────────
  private bargeInTimer: ReturnType<typeof setTimeout> | null = null;
  private bargeInAboveThresholdSince: number | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micAnimationFrameId: number | null = null;
  private isMonitoringMic = false;

  // ── Getters ──────────────────────────────────────────────
  get state(): VoiceState {
    return this.stateSubject.value;
  }

  get volumeLevel(): number {
    return this.volumeSubject.value;
  }

  // ── State transitions ────────────────────────────────────
  setState(state: VoiceState): void {
    const prev = this.stateSubject.value;
    this.stateSubject.next(state);

    // Start / stop mic monitoring based on state
    if (state === 'SPEAKING') {
      this.startMicMonitoring();
    } else if (state !== 'LISTENING') {
      this.stopMicMonitoring();
    }

    // Reset barge-in state when leaving SPEAKING
    if (prev === 'SPEAKING' && state !== 'SPEAKING') {
      this.clearBargeInDetection();
    }
  }

  /** Update volume (0–1 raw) — applies EMA smoothing */
  setVolume(raw: number): void {
    const clamped = Math.min(1, Math.max(0, raw));
    this.smoothedVolume =
      this.SMOOTHING * clamped + (1 - this.SMOOTHING) * this.smoothedVolume;
    this.volumeSubject.next(this.smoothedVolume);
  }

  /** Reset to IDLE */
  reset(): void {
    this.stateSubject.next('IDLE');
    this.smoothedVolume = 0;
    this.volumeSubject.next(0);
    this.stopMicMonitoring();
    this.clearBargeInDetection();
  }

  // ── Barge-in via AnalyserNode RMS ────────────────────────

  /**
   * Must be called with a working AnalyserNode connected to the mic
   * stream. The service will start monitoring and auto-trigger barge-in.
   */
  setMicAnalyser(analyser: AnalyserNode | null): void {
    this.micAnalyser = analyser;
  }

  private startMicMonitoring(): void {
    if (this.isMonitoringMic || !this.micAnalyser) return;
    this.isMonitoringMic = true;
    const dataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);

    const tick = () => {
      if (!this.micAnalyser || !this.isMonitoringMic) return;

      this.micAnalyser.getByteTimeDomainData(dataArray);

      // RMS
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const centered = dataArray[i] - 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length) / 128;

      // Update volume for the sphere
      this.setVolume(rms);

      // Barge-in detection (only while SPEAKING)
      if (this.state === 'SPEAKING' && rms > this.bargeInThreshold) {
        if (this.bargeInAboveThresholdSince === null) {
          this.bargeInAboveThresholdSince = Date.now();
        } else if (
          Date.now() - this.bargeInAboveThresholdSince >=
          this.BARGE_IN_DURATION_MS
        ) {
          // Threshold exceeded for required duration → barge-in!
          this.triggerBargeIn();
          return;
        }
      } else {
        this.bargeInAboveThresholdSince = null;
      }

      this.micAnimationFrameId = requestAnimationFrame(tick);
    };
    tick();
  }

  private stopMicMonitoring(): void {
    this.isMonitoringMic = false;
    if (this.micAnimationFrameId) {
      cancelAnimationFrame(this.micAnimationFrameId);
      this.micAnimationFrameId = null;
    }
    this.bargeInAboveThresholdSince = null;
  }

  private triggerBargeIn(): void {
    this.clearBargeInDetection();
    this.stateSubject.next('INTERRUPTED');

    // After debounce, transition back to LISTENING
    this.bargeInTimer = setTimeout(() => {
      this.stateSubject.next('LISTENING');
    }, this.INTERRUPTED_DEBOUNCE_MS);
  }

  private clearBargeInDetection(): void {
    this.bargeInAboveThresholdSince = null;
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
    }
  }
}
