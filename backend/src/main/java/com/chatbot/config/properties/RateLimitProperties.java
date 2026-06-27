package com.chatbot.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ratelimit")
public record RateLimitProperties(
    Tier free,
    Tier premium
) {
    public record Tier(int dailyTokens) {}
}
