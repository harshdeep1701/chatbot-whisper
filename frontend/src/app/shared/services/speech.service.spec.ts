import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { SpeechService } from './speech.service';
import { environment } from '../../../environments/environment';

describe('SpeechService', () => {
  let service: SpeechService;
  let httpMock: HttpTestingController;
  const API = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SpeechService],
    });
    service = TestBed.inject(SpeechService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── transcribe ──────────────────────────────────────────

  it('should POST /api/speech/stt with FormData', () => {
    const blob = new Blob(['audio data'], { type: 'audio/webm' });

    service.transcribe(blob).subscribe(res => {
      expect(res.success).toBeTrue();
      expect(res.transcribedText).toBe('hello world');
    });

    const req = httpMock.expectOne(`${API}/speech/stt`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush({ transcribedText: 'hello world', success: true });
  });

  // ── synthesize ──────────────────────────────────────────

  it('should POST /api/speech/tts and return ArrayBuffer', () => {
    const buffer = new ArrayBuffer(8);

    service.synthesize('hello').subscribe(res => {
      expect(res).toBeInstanceOf(ArrayBuffer);
      expect(res.byteLength).toBe(8);
    });

    const req = httpMock.expectOne(`${API}/speech/tts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'hello' });
    expect(req.request.responseType).toBe('arraybuffer');
    req.flush(buffer);
  });

  // ── stopTts ─────────────────────────────────────────────

  it('should emit interrupted event on stopTts', (done) => {
    service.ttsEvents$.subscribe(event => {
      expect(event.type).toBe('interrupted');
      done();
    });

    service.stopTts();
  });

  // ── volumeLevel$ ────────────────────────────────────────

  it('should expose volumeLevel$ starting at 0', (done) => {
    service.volumeLevel$.subscribe(vol => {
      expect(vol).toBe(0);
      done();
    });
  });
});
