package com.chatbot.service;

import com.chatbot.model.TokenUsage;
import com.chatbot.model.User;
import com.chatbot.repository.TokenUsageRepository;
import com.chatbot.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Tracks daily token usage per user and enforces per-user rate limits.
 * <p>
 * Free tier:  {@code 100,000} tokens/day
 * Premium tier: {@code 1,000,000} tokens/day
 */
@Service
public class TokenQuotaService {

    private static final Logger log = LoggerFactory.getLogger(TokenQuotaService.class);

    private final TokenUsageRepository tokenUsageRepository;
    private final UserRepository userRepository;

    @Value("${ratelimit.free.daily-tokens:100000}")
    private int freeDailyLimit;

    @Value("${ratelimit.premium.daily-tokens:1000000}")
    private int premiumDailyLimit;

    public TokenQuotaService(TokenUsageRepository tokenUsageRepository,
                             UserRepository userRepository) {
        this.tokenUsageRepository = tokenUsageRepository;
        this.userRepository = userRepository;
    }

    /**
     * Checks whether the user has quota remaining for today.
     *
     * @throws RateLimitExceededException if the user is over their daily limit
     */
    public void checkQuota(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        int limit = user.isPremium() ? premiumDailyLimit : freeDailyLimit;

        TokenUsage todayUsage = tokenUsageRepository
                .findByUserIdAndUsageDate(userId, LocalDate.now())
                .orElse(null);

        int used = (todayUsage != null) ? todayUsage.getTokensUsed() : 0;

        if (used >= limit) {
            String tier = user.isPremium() ? "premium" : "free";
            log.warn("Daily token limit reached — userId={}, tier={}, used={}, limit={}",
                    userId, tier, used, limit);
            throw new RateLimitExceededException(
                    "Daily token limit reached (" + used + "/" + limit + "). " +
                    "Your " + tier + " tier allows " + limit + " tokens per day. " +
                    (user.isPremium() ? "Please try again tomorrow." : "Upgrade to premium for higher limits.")
            );
        }

        log.debug("Quota OK — userId={}, used={}, limit={}", userId, used, limit);
    }

    /**
     * Records token consumption for a user on today's date.
     * Accumulates with any existing usage for today.
     */
    @Transactional
    public void recordUsage(Long userId, int tokens) {
        if (tokens <= 0) return;

        LocalDate today = LocalDate.now();
        TokenUsage usage = tokenUsageRepository
                .findByUserIdAndUsageDate(userId, today)
                .orElse(new TokenUsage(userId, today, 0));

        usage.setTokensUsed(usage.getTokensUsed() + tokens);
        tokenUsageRepository.save(usage);

        log.info("Token usage recorded — userId={}, todayTotal={}, added={}",
                userId, usage.getTokensUsed(), tokens);
    }

    /**
     * Returns the user's remaining tokens for today.
     */
    public int getRemainingTokens(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));

        int limit = user.isPremium() ? premiumDailyLimit : freeDailyLimit;
        TokenUsage todayUsage = tokenUsageRepository
                .findByUserIdAndUsageDate(userId, LocalDate.now())
                .orElse(null);

        int used = (todayUsage != null) ? todayUsage.getTokensUsed() : 0;
        return Math.max(0, limit - used);
    }
}
