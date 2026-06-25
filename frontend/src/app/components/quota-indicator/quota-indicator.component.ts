import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { QuotaService, QuotaInfo } from '../../services/quota.service';
import { interval, Subscription, switchMap } from 'rxjs';

export const FREE_DAILY_LIMIT = 100_000;
export const PREMIUM_DAILY_LIMIT = 1_000_000;

@Component({
  selector: 'app-quota-indicator',
  templateUrl: './quota-indicator.component.html',
  styleUrls: ['./quota-indicator.component.scss']
})
export class QuotaIndicatorComponent implements OnInit, OnDestroy {
  @Input() userId!: number;

  remainingTokens = 0;
  tier: string = 'free';
  isLoading = true;
  error = false;

  private sub = new Subscription();

  constructor(private quotaService: QuotaService) {}

  ngOnInit(): void {
    this.fetchQuota();
    // Refresh quota every 30 seconds
    this.sub.add(
      interval(30_000)
        .pipe(switchMap(() => this.quotaService.getQuota(this.userId)))
        .subscribe({
          next: (data) => this.updateQuota(data),
          error: () => { /* silently ignore poll errors */ }
        })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get dailyLimit(): number {
    return this.tier === 'premium' ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  }

  get usedTokens(): number {
    return this.dailyLimit - this.remainingTokens;
  }

  get usagePercent(): number {
    if (this.dailyLimit === 0) return 0;
    return Math.min(100, (this.usedTokens / this.dailyLimit) * 100);
  }

  /** SVG circle circumference for the progress ring */
  get circumference(): number {
    return 2 * Math.PI * 14; // r=14
  }

  get strokeDashoffset(): number {
    return this.circumference - (this.usagePercent / 100) * this.circumference;
  }

  get colorClass(): string {
    const pct = this.usagePercent;
    if (pct >= 90) return 'critical';
    if (pct >= 70) return 'warning';
    return 'ok';
  }

  get tooltipText(): string {
    const used = this.usedTokens.toLocaleString();
    const remaining = this.remainingTokens.toLocaleString();
    const limit = this.dailyLimit.toLocaleString();
    const pct = this.usagePercent.toFixed(0);
    return `${used} / ${limit} tokens used (${pct}%) — ${remaining} remaining • ${this.tier} tier`;
  }

  private fetchQuota(): void {
    this.isLoading = true;
    this.error = false;
    this.quotaService.getQuota(this.userId).subscribe({
      next: (data) => {
        this.updateQuota(data);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.error = true;
      }
    });
  }

  private updateQuota(data: QuotaInfo): void {
    this.remainingTokens = data.remainingTokens;
    this.tier = data.tier;
  }
}
