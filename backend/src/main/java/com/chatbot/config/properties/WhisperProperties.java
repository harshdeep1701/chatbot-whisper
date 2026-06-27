package com.chatbot.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "openai.whisper")
public record WhisperProperties(
    String apiUrl,
    String model
) {}
