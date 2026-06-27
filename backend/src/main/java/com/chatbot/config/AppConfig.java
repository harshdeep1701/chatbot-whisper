package com.chatbot.config;

import com.chatbot.config.properties.*;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
@EnableConfigurationProperties({
    LlmProperties.class,
    WhisperProperties.class,
    TtsProperties.class,
    OpenAiProperties.class,
    GeminiProperties.class,
    RateLimitProperties.class,
    JwtProperties.class
})
public class AppConfig {

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder()
                .codecs(configurer -> configurer
                        .defaultCodecs()
                        .maxInMemorySize(10 * 1024 * 1024));
    }
}
