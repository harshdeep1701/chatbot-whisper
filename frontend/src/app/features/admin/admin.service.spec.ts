import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AdminService } from './admin.service';
import { environment } from '../../../environments/environment';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;
  const API = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdminService],
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should GET /api/admin/users', () => {
    const mockUsers = {
      success: true,
      count: 1,
      users: [
        {
          id: 1,
          username: 'admin',
          email: 'admin@test.com',
          role: 'ADMIN',
          tier: 'premium',
          totalTokensUsed: 1000,
          remainingTokens: 999000,
          premiumSince: null,
          createdAt: '2024-01-01',
        },
      ],
    };

    service.listUsers().subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.users.length).toBe(1);
      expect(res.users[0].role).toBe('ADMIN');
    });

    httpMock.expectOne(`${API}/admin/users`).flush(mockUsers);
  });

  it('should POST /api/admin/users/{id}/premium', () => {
    service.upgradeToPremium(5).subscribe(res => {
      expect(res.success).toBeTrue();
    });

    const req = httpMock.expectOne(`${API}/admin/users/5/premium`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true });
  });

  it('should POST /api/admin/users/{id}/free', () => {
    service.downgradeToFree(5).subscribe();

    const req = httpMock.expectOne(`${API}/admin/users/5/free`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true });
  });

  it('should POST /api/admin/users/{id}/make-admin', () => {
    service.makeAdmin(3).subscribe(res => {
      expect(res.success).toBeTrue();
    });

    const req = httpMock.expectOne(`${API}/admin/users/3/make-admin`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true });
  });

  it('should POST /api/admin/users/{id}/remove-admin', () => {
    service.removeAdmin(3).subscribe();

    const req = httpMock.expectOne(`${API}/admin/users/3/remove-admin`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true });
  });
});
