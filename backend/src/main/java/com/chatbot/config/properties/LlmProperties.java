package com.chatbot.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "deepseek")
public record LlmProperties(
    String apiKey,
    String apiUrl,
    String model,
    int maxTokens,
    double temperature
) {}
