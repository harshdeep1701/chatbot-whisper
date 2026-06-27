import { Directive, OnDestroy, Renderer2, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Directive({
  selector: '[appCursor]',
  standalone: true,
})
export class CursorDirective implements OnDestroy {
  private dotEl!: HTMLDivElement;
  private ringEl!: HTMLDivElement;
  private animFrameId: number | null = null;
  private mouseX = 0;
  private mouseY = 0;
  private dotX = 0;
  private dotY = 0;
  private ringX = 0;
  private ringY = 0;

  constructor(
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.dotEl = this.renderer.createElement('div');
    this.ringEl = this.renderer.createElement('div');

    // ── Dot (fast follower) ──
    this.renderer.setStyle(this.dotEl, 'position', 'fixed');
    this.renderer.setStyle(this.dotEl, 'pointer-events', 'none');
    this.renderer.setStyle(this.dotEl, 'z-index', '9999');
    this.renderer.setStyle(this.dotEl, 'width', '12px');
    this.renderer.setStyle(this.dotEl, 'height', '12px');
    this.renderer.setStyle(this.dotEl, 'border-radius', '50%');
    this.renderer.setStyle(this.dotEl, 'background', 'var(--color-accent, #6366f1)');
    this.renderer.setStyle(this.dotEl, 'transform', 'translate(-50%, -50%)');
    this.renderer.setStyle(this.dotEl, 'will-change', 'left, top');

    // ── Ring (slow follower) ──
    this.renderer.setStyle(this.ringEl, 'position', 'fixed');
    this.renderer.setStyle(this.ringEl, 'pointer-events', 'none');
    this.renderer.setStyle(this.ringEl, 'z-index', '9998');
    this.renderer.setStyle(this.ringEl, 'width', '36px');
    this.renderer.setStyle(this.ringEl, 'height', '36px');
    this.renderer.setStyle(this.ringEl, 'border-radius', '50%');
    this.renderer.setStyle(this.ringEl, 'border', '2px solid var(--color-accent, #6366f1)');
    this.renderer.setStyle(this.ringEl, 'opacity', '0.5');
    this.renderer.setStyle(this.ringEl, 'transform', 'translate(-50%, -50%)');
    this.renderer.setStyle(this.ringEl, 'will-change', 'left, top');

    this.renderer.appendChild(this.document.body, this.dotEl);
    this.renderer.appendChild(this.document.body, this.ringEl);

    this.renderer.listen(this.document, 'mousemove', (e: MouseEvent) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    this.startLoop();
  }

  private startLoop(): void {
    const tick = () => {
      const lerpFactorDot = 0.25;
      const lerpFactorRing = 0.1;

      this.dotX += (this.mouseX - this.dotX) * lerpFactorDot;
      this.dotY += (this.mouseY - this.dotY) * lerpFactorDot;
      this.ringX += (this.mouseX - this.ringX) * lerpFactorRing;
      this.ringY += (this.mouseY - this.ringY) * lerpFactorRing;

      this.renderer.setStyle(this.dotEl, 'left', `${this.dotX}px`);
      this.renderer.setStyle(this.dotEl, 'top', `${this.dotY}px`);
      this.renderer.setStyle(this.ringEl, 'left', `${this.ringX}px`);
      this.renderer.setStyle(this.ringEl, 'top', `${this.ringY}px`);

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.dotEl && this.dotEl.parentNode) {
      this.renderer.removeChild(this.document.body, this.dotEl);
    }
    if (this.ringEl && this.ringEl.parentNode) {
      this.renderer.removeChild(this.document.body, this.ringEl);
    }
  }
}
