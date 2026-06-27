package com.chatbot.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "google.gemini")
public record GeminiProperties(
    String apiKey,
    String model,
    boolean googleSearch,
    boolean logRequests,
    boolean logResponses
) {}
