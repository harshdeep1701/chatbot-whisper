import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, shareReplay, switchMap, map, Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { QuotaInfo } from '../../core/models/chat.models';

/**
 * Polls GET /api/chat/quota every `QUOTA_POLL_INTERVAL_MS` (default 30s)
 * and exposes derived observables for the chat UI.
 */
@Injectable({ providedIn: 'root' })
export class QuotaService implements OnDestroy {
  private readonly API = environment.apiUrl;
  private readonly POLL_INTERVAL = (environment as any).quotaPollIntervalMs ?? 30_000;

  private destroy$ = new Subject<void>();

  /** Polled quota data — shared replay so all subscribers get the latest */
  readonly quota$: Observable<QuotaInfo | null> = timer(0, this.POLL_INTERVAL).pipe(
    switchMap(() =>
      this.http.get<QuotaInfo>(`${this.API}/chat/quota`),
    ),
    shareReplay({ refCount: false, bufferSize: 1 }),
    takeUntil(this.destroy$),
  );

  /** Derived: remaining tokens (null while loading) */
  readonly remainingTokens$: Observable<number | null> = this.quota$.pipe(
    map(q => q?.remainingTokens ?? null),
  );

  /** Derived: total quota (used + remaining) */
  readonly quotaTotal$: Observable<number | null> = this.quota$.pipe(
    map(q => q ? (q.remainingTokens + q.totalTokensUsed) : null),
  );

  /** Derived: true when quota is exhausted */
  readonly quotaExceeded$: Observable<boolean> = this.quota$.pipe(
    map(q => q !== null && q.remainingTokens === 0),
  );

  /** Derived: true when remaining tokens are below 10% of a typical free-tier limit (100k tokens) */
  readonly quotaLow$: Observable<boolean> = this.quota$.pipe(
    map(q => {
      if (!q) return false;
      // Assume free tier = 100k, premium = 1M
      const limit = q.tier === 'premium' ? 1_000_000 : 100_000;
      return q.remainingTokens < limit * 0.1;
    }),
  );

  constructor(private http: HttpClient) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
