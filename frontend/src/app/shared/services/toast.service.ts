import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

let nextId = 0;

/**
 * Lightweight, no-library toast notification service.
 *
 * Components subscribe to `toasts$` and render them. Each toast
 * auto-dismisses after `durationMs` (default 5000).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  readonly toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  private readonly DEFAULT_DURATION_MS = 5000;

  /** Show a toast. Returns the toast id so the caller can dismiss early. */
  show(message: string, type: Toast['type'] = 'info', durationMs?: number): number {
    const toast: Toast = { id: nextId++, message, type };
    const current = this.toastsSubject.value;
    this.toastsSubject.next([...current, toast]);

    const ms = durationMs ?? this.DEFAULT_DURATION_MS;
    setTimeout(() => this.dismiss(toast.id), ms);

    return toast.id;
  }

  /** Dismiss a specific toast by id */
  dismiss(id: number): void {
    const current = this.toastsSubject.value;
    this.toastsSubject.next(current.filter(t => t.id !== id));
  }

  /** Clear all toasts immediately */
  clearAll(): void {
    this.toastsSubject.next([]);
  }
}
