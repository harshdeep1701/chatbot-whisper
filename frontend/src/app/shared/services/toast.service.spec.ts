import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ToastService],
    });
    service = TestBed.inject(ToastService);
  });

  it('should emit a toast and auto-dismiss after default duration', (done) => {
    const sub = service.toasts$.subscribe(toasts => {
      if (toasts.length === 1) {
        expect(toasts[0].message).toBe('Test error');
        expect(toasts[0].type).toBe('error');
      }
      if (toasts.length === 0) {
        // Dismissed
        sub.unsubscribe();
        done();
      }
    });

    service.show('Test error', 'error', 50);
  });

  it('should dismiss a specific toast by id', () => {
    const id = service.show('Message', 'info');

    let toasts = (service as any).toastsSubject.value;
    expect(toasts.length).toBe(1);

    service.dismiss(id);

    toasts = (service as any).toastsSubject.value;
    expect(toasts.length).toBe(0);
  });

  it('should clear all toasts', () => {
    service.show('One', 'info');
    service.show('Two', 'success');

    service.clearAll();

    const toasts = (service as any).toastsSubject.value;
    expect(toasts.length).toBe(0);
  });
});
