import {
  Component,
  Input,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quota-ring',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quota-ring.component.html',
  styleUrls: ['./quota-ring.component.scss'],
})
export class QuotaRingComponent {
  @Input() totalQuota = 1_000_000;
  @Input() remainingQuota = 1_000_000;

  showTooltip = false;

  private readonly radius = 14;
  readonly circumference = 2 * Math.PI * this.radius;

  get usedQuota(): number {
    return Math.max(0, this.totalQuota - this.remainingQuota);
  }

  get percentUsed(): number {
    if (this.totalQuota <= 0) return 0;
    return Math.round((this.usedQuota / this.totalQuota) * 100);
  }

  get dashOffset(): number {
    return this.circumference * (1 - this.percentUsed / 100);
  }

  get arcColor(): string {
    if (this.percentUsed >= 86) return '#c94f4f';
    if (this.percentUsed >= 61) return '#e0913a';
    return '#6c4fd0';
  }

  get formattedUsed(): string {
    return this.usedQuota.toLocaleString();
  }

  get formattedRemaining(): string {
    return this.remainingQuota.toLocaleString();
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.showTooltip = true;
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.showTooltip = false;
  }
}
