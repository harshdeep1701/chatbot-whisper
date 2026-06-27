package com.chatbot.service;

import com.chatbot.config.properties.RateLimitProperties;
import com.chatbot.exception.RateLimitExceededException;
import com.chatbot.exception.UserNotFoundException;
import com.chatbot.model.TokenUsage;
import com.chatbot.repository.TokenUsageRepository;
import com.chatbot.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
public class TokenQuotaService {

    private static final Logger log = LoggerFactory.getLogger(TokenQuotaService.class);

    private final TokenUsageRepository tokenUsageRepository;
    private final UserRepository userRepository;
    private final RateLimitProperties rateLimitProperties;

    public TokenQuotaService(TokenUsageRepository tokenUsageRepository,
                             UserRepository userRepository,
                             RateLimitProperties rateLimitProperties) {
        this.tokenUsageRepository = tokenUsageRepository;
        this.userRepository = userRepository;
        this.rateLimitProperties = rateLimitProperties;
    }

    public void checkQuota(Long userId) {
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        var limit = user.isPremium()
                ? rateLimitProperties.premium().dailyTokens()
                : rateLimitProperties.free().dailyTokens();

        var todayUsage = tokenUsageRepository
                .findByUserIdAndUsageDate(userId, LocalDate.now())
                .orElse(null);

        var used = todayUsage != null ? todayUsage.getTokensUsed() : 0;

        if (used >= limit) {
            var tier = user.isPremium() ? "premium" : "free";
            log.warn("Daily token limit reached: userId={}, tier={}, used={}, limit={}",
                    userId, tier, used, limit);
            throw new RateLimitExceededException(
                    "Daily token limit reached (%d/%d). Your %s tier allows %d tokens per day."
                            .formatted(used, limit, tier, limit));
        }

        log.debug("Quota OK: userId={}, used={}, limit={}", userId, used, limit);
    }

    @Transactional
    public void recordUsage(Long userId, int tokens) {
        if (tokens <= 0) return;

        var today = LocalDate.now();
        var usage = tokenUsageRepository
                .findByUserIdAndUsageDate(userId, today)
                .orElse(new TokenUsage(userId, today, 0));

        usage.setTokensUsed(usage.getTokensUsed() + tokens);
        tokenUsageRepository.save(usage);

        log.info("Token usage recorded: userId={}, todayTotal={}, added={}",
                userId, usage.getTokensUsed(), tokens);
    }

    public int getRemainingTokens(Long userId) {
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        var limit = user.isPremium()
                ? rateLimitProperties.premium().dailyTokens()
                : rateLimitProperties.free().dailyTokens();

        var todayUsage = tokenUsageRepository
                .findByUserIdAndUsageDate(userId, LocalDate.now())
                .orElse(null);

        var used = todayUsage != null ? todayUsage.getTokensUsed() : 0;
        return Math.max(0, limit - used);
    }

    public int getTotalTokensUsed(Long userId) {
        return tokenUsageRepository.getTotalTokensUsedByUser(userId);
    }
}
