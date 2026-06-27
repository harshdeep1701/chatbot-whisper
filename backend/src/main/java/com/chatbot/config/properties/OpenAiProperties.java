package com.chatbot.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "openai.api")
public record OpenAiProperties(
    String key
) {}
