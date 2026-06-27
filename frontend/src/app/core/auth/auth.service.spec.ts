import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/auth.models';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  const API = environment.apiUrl;

  beforeEach(() => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Clear localStorage between tests
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── login ──────────────────────────────────────────────

  it('should POST /api/auth/login and store token on success', () => {
    const mockResponse: AuthResponse = {
      token: 'header.eyJyb2xlIjoiVVNFUiJ9.signature',
      username: 'testuser',
      userId: 1,
      success: true,
    };

    service.login('testuser', 'password').subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.token).toBe('header.eyJyb2xlIjoiVVNFUiJ9.signature');
      expect(service.isAuthenticated()).toBeTrue();
      expect(service.isAdmin()).toBeFalse();
      expect(service.getCurrentUser()?.username).toBe('testuser');
    });

    const req = httpMock.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'testuser', password: 'password' });
    req.flush(mockResponse);
  });

  it('should handle 401 login failure', () => {
    service.login('bad', 'creds').subscribe(res => {
      expect(res.success).toBeFalse();
      expect(service.isAuthenticated()).toBeFalse();
    });

    const req = httpMock.expectOne(`${API}/auth/login`);
    req.flush(
      { success: false, error: 'Invalid credentials' },
      { status: 401, statusText: 'Unauthorized' },
    );
  });

  // ── register ───────────────────────────────────────────

  it('should POST /api/auth/register and store token on success', () => {
    const mockResponse: AuthResponse = {
      token: 'header.eyJyb2xlIjoiQURNSU4ifQ.signature',
      username: 'admin',
      userId: 2,
      success: true,
    };

    service.register('admin', 'admin@test.com', 'pass123').subscribe(res => {
      expect(res.success).toBeTrue();
      expect(service.isAdmin()).toBeTrue();
    });

    const req = httpMock.expectOne(`${API}/auth/register`);
    expect(req.request.body).toEqual({
      username: 'admin',
      email: 'admin@test.com',
      password: 'pass123',
    });
    req.flush(mockResponse);
  });

  // ── logout ─────────────────────────────────────────────

  it('should clear auth state and navigate to /login on logout', () => {
    // First login
    service
      .login('user', 'pass')
      .subscribe(() => {
        expect(service.isAuthenticated()).toBeTrue();

        service.logout();
        expect(service.isAuthenticated()).toBeFalse();
        expect(service.getToken()).toBeNull();
        expect(service.getCurrentUser()).toBeNull();
        expect(router.navigate).toHaveBeenCalledWith(['/login']);
      });

    const req = httpMock.expectOne(`${API}/auth/login`);
    req.flush({
      token: 'header.eyJyb2xlIjoiVVNFUiJ9.signature',
      username: 'user',
      userId: 3,
      success: true,
    });
  });

  // ── decodeJwt ──────────────────────────────────────────

  it('should decode JWT and extract role claim', () => {
    const token =
      'eyJhbGciOiJIUzI1NiJ9.' +
      btoa(JSON.stringify({ sub: 'test', userId: 1, role: 'ADMIN', exp: 9999999999 })) +
      '.signature';

    const payload = service.decodeJwt(token);
    expect(payload.role).toBe('ADMIN');
    expect(payload.sub).toBe('test');
    expect(payload.userId).toBe(1);
  });

  // ── isPublicApiUrl ─────────────────────────────────────

  it('should identify public API routes', () => {
    expect(service.isPublicApiUrl('http://localhost/api/auth/login')).toBeTrue();
    expect(service.isPublicApiUrl('/api/auth/register')).toBeTrue();
    expect(service.isPublicApiUrl('/api/chat/health')).toBeTrue();
    expect(service.isPublicApiUrl('/api/chat')).toBeFalse();
    expect(service.isPublicApiUrl('/api/admin/users')).toBeFalse();
  });

  // ── role$ ──────────────────────────────────────────────

  it('should expose role$ as an observable derived from currentUser$', (done) => {
    service.role$.subscribe(role => {
      // Initially null
      expect(role).toBeNull();
      done();
    });
  });
});
