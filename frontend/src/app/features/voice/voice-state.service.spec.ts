import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { VoiceStateService } from './voice-state.service';
import { VoiceState } from '../../core/models/speech.models';

describe('VoiceStateService', () => {
  let service: VoiceStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VoiceStateService],
    });
    service = TestBed.inject(VoiceStateService);
  });

  it('should start in IDLE state', () => {
    expect(service.state).toBe('IDLE');
  });

  it('should transition through states', () => {
    const states: VoiceState[] = [];
    service.state$.subscribe(s => states.push(s));

    service.setState('LISTENING');
    service.setState('PROCESSING');
    service.setState('SPEAKING');

    expect(states).toContain('LISTENING');
    expect(states).toContain('PROCESSING');
    expect(states).toContain('SPEAKING');
    expect(service.state).toBe('SPEAKING');
  });

  it('should apply EMA smoothing to volume', () => {
    service.setVolume(0.8);
    // After first set, smoothed = 0.28 * 0.8 + 0.72 * 0 = 0.224
    expect(service.volumeLevel).toBeCloseTo(0.224, 2);

    service.setVolume(0.8);
    // Second set: 0.28 * 0.8 + 0.72 * 0.224 ≈ 0.385
    expect(service.volumeLevel).toBeCloseTo(0.385, 2);
  });

  it('should clamp volume to 0–1', () => {
    service.setVolume(2);
    expect(service.volumeLevel).toBeLessThanOrEqual(1);
    service.setVolume(-0.5);
    expect(service.volumeLevel).toBeGreaterThanOrEqual(0);
  });

  it('should reset to IDLE with zero volume', () => {
    service.setState('SPEAKING');
    service.setVolume(0.5);
    service.reset();

    expect(service.state).toBe('IDLE');
    expect(service.volumeLevel).toBe(0);
  });

  it('should start mic monitoring when entering SPEAKING', () => {
    // Create a mock AnalyserNode
    const mockAnalyser = {
      frequencyBinCount: 128,
      getByteTimeDomainData: jasmine.createSpy('getByteTimeDomainData'),
    } as unknown as AnalyserNode;

    service.setMicAnalyser(mockAnalyser);
    service.setState('SPEAKING');

    // Monitoring should be active
    expect((service as any).isMonitoringMic).toBeTrue();
  });

  it('should stop mic monitoring when leaving SPEAKING', () => {
    service.setState('LISTENING');
    expect((service as any).isMonitoringMic).toBeFalse();
  });
});
