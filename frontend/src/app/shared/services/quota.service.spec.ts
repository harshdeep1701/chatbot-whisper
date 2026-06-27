import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { QuotaService } from './quota.service';
import { environment } from '../../../environments/environment';

describe('QuotaService', () => {
  let service: QuotaService;
  let httpMock: HttpTestingController;
  const API = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [QuotaService],
    });
    service = TestBed.inject(QuotaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.ngOnDestroy();
    httpMock.verify();
  });

  it('should poll GET /api/chat/quota and expose quota$', (done) => {
    const mockQuota = {
      userId: 1,
      tier: 'free',
      remainingTokens: 50000,
      totalTokensUsed: 50000,
    };

    service.quota$.subscribe(quota => {
      if (quota) {
        expect(quota.remainingTokens).toBe(50000);
        expect(quota.tier).toBe('free');
        done();
      }
    });

    const req = httpMock.expectOne(`${API}/chat/quota`);
    expect(req.request.method).toBe('GET');
    req.flush(mockQuota);
  });

  it('should derive quotaExceeded$ correctly', (done) => {
    service.quotaExceeded$.subscribe(exceeded => {
      expect(exceeded).toBeFalse();
      done();
    });

    const req = httpMock.expectOne(`${API}/chat/quota`);
    req.flush({ userId: 1, tier: 'free', remainingTokens: 50000, totalTokensUsed: 50000 });
  });
});
