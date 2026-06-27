package com.chatbot.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "openai.tts")
public record TtsProperties(
    String apiUrl,
    String model,
    String voice
) {}
