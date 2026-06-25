import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { QuotaIndicatorComponent, FREE_DAILY_LIMIT, PREMIUM_DAILY_LIMIT } from './quota-indicator.component';
import { QuotaService } from '../../services/quota.service';

describe('QuotaIndicatorComponent', () => {
  let component: QuotaIndicatorComponent;
  let fixture: ComponentFixture<QuotaIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [QuotaIndicatorComponent],
      providers: [QuotaService]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuotaIndicatorComponent);
    component = fixture.componentInstance;
    component.userId = 1;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to free tier with 10k daily limit', () => {
    expect(component.tier).toBe('free');
    expect(component.dailyLimit).toBe(10_000);
  });

  it('FREE_DAILY_LIMIT should be 10,000', () => {
    expect(FREE_DAILY_LIMIT).toBe(10_000);
  });

  it('PREMIUM_DAILY_LIMIT should be 1,000,000', () => {
    expect(PREMIUM_DAILY_LIMIT).toBe(1_000_000);
  });

  it('dailyLimit should change when tier is premium', () => {
    component.tier = 'premium';
    expect(component.dailyLimit).toBe(1_000_000);
  });

  it('usedTokens should be dailyLimit when remaining is 0', () => {
    component.tier = 'free';
    component.remainingTokens = 0;
    expect(component.usedTokens).toBe(10_000);
  });

  it('usedTokens should reflect partial usage', () => {
    component.tier = 'free';
    component.remainingTokens = 6_500;
    expect(component.usedTokens).toBe(3_500);
  });

  it('usagePercent should be 0 when no tokens used', () => {
    component.tier = 'free';
    component.remainingTokens = 10_000;
    expect(component.usagePercent).toBe(0);
  });

  it('usagePercent should be 50 when half used', () => {
    component.tier = 'free';
    component.remainingTokens = 5_000;
    expect(component.usagePercent).toBe(50);
  });

  it('usagePercent should be 100 when all tokens used', () => {
    component.tier = 'free';
    component.remainingTokens = 0;
    expect(component.usagePercent).toBe(100);
  });

  it('usagePercent should cap at 100 even if remaining is negative', () => {
    component.tier = 'free';
    component.remainingTokens = -500;
    expect(component.usagePercent).toBe(100);
  });
});
