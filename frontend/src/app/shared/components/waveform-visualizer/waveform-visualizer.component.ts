import {
  Component,
  Input,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-waveform-visualizer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <canvas
      #waveCanvas
      class="wave-canvas"
      width="120"
      height="40"
    ></canvas>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
      }
      .wave-canvas {
        display: block;
        border-radius: 4px;
      }
      @media (prefers-reduced-motion: reduce) {
        .wave-canvas {
          display: none;
        }
      }
    `,
  ],
})
export class WaveformVisualizerComponent
  implements AfterViewInit, OnDestroy, OnChanges
{
  @ViewChild('waveCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** AnalyserNode from the mic stream for recording visualisation */
  @Input() analyserNode: AnalyserNode | null = null;

  /** Whether TTS is currently playing (for pulsing output visualisation) */
  @Input() isPlaying = false;

  private animFrameId: number | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly BAR_COUNT = 24;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['analyserNode'] || changes['isPlaying']) {
      this.restartLoop();
    }
  }

  ngOnDestroy(): void {
    this.cancelLoop();
  }

  private restartLoop(): void {
    this.cancelLoop();
    if (this.analyserNode) {
      this.startRecordingLoop();
    } else if (this.isPlaying) {
      this.startPlayingLoop();
    }
  }

  private cancelLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // ── Recording mode: use AnalyserNode frequency data ──────
  private startRecordingLoop(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.ctx || !this.analyserNode) return;
    const ctx = this.ctx;
    const w = canvas.width;
    const h = canvas.height;
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Pre-compute gradient
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#6366f1');   // accent blue
    gradient.addColorStop(1, '#8b5cf6');   // accent purple

    const tick = () => {
      if (!this.analyserNode) return;
      this.analyserNode.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, w, h);

      const barWidth = (w / this.BAR_COUNT) - 1;
      const step = Math.floor(bufferLength / this.BAR_COUNT);

      for (let i = 0; i < this.BAR_COUNT; i++) {
        const value = dataArray[i * step] || 0;
        const barHeight = Math.max(2, (value / 255) * h);
        const x = i * (barWidth + 1);
        const y = h - barHeight;

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  // ── TTS playing mode: sine-wave driven pulsing bars ──────
  private startPlayingLoop(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = canvas.width;
    const h = canvas.height;
    const barCount = 7;

    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(1, '#22d3ee');

    const tick = () => {
      const t = Date.now() / 800;
      ctx.clearRect(0, 0, w, h);

      const barWidth = (w / barCount) - 2;

      for (let i = 0; i < barCount; i++) {
        const phase = (i / barCount) * Math.PI * 2;
        const amplitude = 0.4 + 0.6 * Math.abs(Math.sin(t + phase));
        const barHeight = Math.max(3, amplitude * h);
        const x = i * (barWidth + 2);
        const y = h - barHeight;

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }
}
