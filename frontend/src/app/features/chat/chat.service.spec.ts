import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ChatService } from './chat.service';
import { environment } from '../../../environments/environment';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;
  const API = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatService],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should POST /api/chat and return ChatResponse', () => {
    const mockReply = {
      reply: 'Hello!',
      conversationId: 'conv-1',
      success: true,
    };

    service.sendMessage('Hi').subscribe(res => {
      expect(res.reply).toBe('Hello!');
      expect(res.conversationId).toBe('conv-1');
      expect(res.success).toBeTrue();
    });

    const req = httpMock.expectOne(`${API}/chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.message).toBe('Hi');
    req.flush(mockReply);
  });

  it('should include conversationId and history when provided', () => {
    service
      .sendMessage('Follow up', 'conv-1', [{ role: 'user', content: 'Hi' }])
      .subscribe();

    const req = httpMock.expectOne(`${API}/chat`);
    expect(req.request.body.conversationId).toBe('conv-1');
    expect(req.request.body.history.length).toBe(1);
    req.flush({ reply: 'Ok', conversationId: 'conv-1', success: true });
  });

  it('should GET /api/chat/health', () => {
    service.checkHealth().subscribe(res => {
      expect(res).toBe('ok');
    });

    const req = httpMock.expectOne(`${API}/chat/health`);
    expect(req.request.method).toBe('GET');
    req.flush('ok');
  });
});
