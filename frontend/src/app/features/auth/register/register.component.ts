import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  Renderer2,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CursorDirective } from '../../../shared/directives/cursor.directive';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CursorDirective],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('particleCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = '';
  isLoading = false;

  private particles: Particle[] = [];
  private particleAnimFrameId: number | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private renderer: Renderer2,
    private hostRef: ElementRef,
  ) {}

  ngOnInit(): void {
    this.renderer.setStyle(document.body, 'cursor', 'none');
  }

  ngAfterViewInit(): void {
    this.initParticleCanvas();
  }

  ngOnDestroy(): void {
    this.renderer.removeStyle(document.body, 'cursor');
    if (this.particleAnimFrameId !== null) {
      cancelAnimationFrame(this.particleAnimFrameId);
      this.particleAnimFrameId = null;
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    this.renderer.setStyle(this.hostRef.nativeElement, '--mx', `${mx}%`);
    this.renderer.setStyle(this.hostRef.nativeElement, '--my', `${my}%`);
  }

  register(): void {
    if (!this.username.trim() || !this.email.trim() || !this.password.trim()) {
      this.error = 'Please fill in all fields';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }
    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService
      .register(this.username.trim(), this.email.trim(), this.password)
      .subscribe({
        next: res => {
          this.isLoading = false;
          if (res.success) {
            this.router.navigate(['/chat']);
          } else {
            this.error = res.error || 'Registration failed';
          }
        },
        error: () => {
          this.isLoading = false;
          this.error = 'Connection error. Is the server running?';
        },
      });
  }

  private initParticleCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    this.particles = [];
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 2 + Math.random() * 2,
      });
    }

    const loop = () => {
      if (!this.ctx || !canvas) return;
      const ctx = this.ctx;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
        ctx.fill();
      }

      this.particleAnimFrameId = requestAnimationFrame(loop);
    };
    this.particleAnimFrameId = requestAnimationFrame(loop);
  }
}
