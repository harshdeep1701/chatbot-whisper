package com.chatbot.client;

import com.chatbot.config.properties.OpenAiProperties;
import com.chatbot.config.properties.TtsProperties;
import com.chatbot.exception.TtsException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class TtsClient {

    private static final Logger log = LoggerFactory.getLogger(TtsClient.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final TtsProperties ttsProperties;
    private final OpenAiProperties openAiProperties;

    public TtsClient(WebClient.Builder webClientBuilder,
                     ObjectMapper objectMapper,
                     TtsProperties ttsProperties,
                     OpenAiProperties openAiProperties) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
        this.ttsProperties = ttsProperties;
        this.openAiProperties = openAiProperties;
    }

    public byte[] synthesize(String text) {
        log.info("Synthesizing speech: textLength={} chars", text.length());

        var requestBody = objectMapper.createObjectNode();
        requestBody.put("model", ttsProperties.model());
        requestBody.put("input", text);
        requestBody.put("voice", ttsProperties.voice());
        requestBody.put("response_format", "mp3");

        try {
            var response = webClient.post()
                    .uri(ttsProperties.apiUrl())
                    .header("Authorization", "Bearer " + openAiProperties.key())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .block();

            if (response != null && response.length > 0) {
                log.info("Speech synthesized: audioSize={} bytes", response.length);
                return response;
            }

            throw new TtsException("TTS API returned empty response");
        } catch (TtsException e) {
            throw e;
        } catch (Exception e) {
            log.error("TTS synthesis failed: textLength={}, error={}", text.length(), e.getMessage());
            throw new TtsException("Failed to synthesize speech: " + e.getMessage(), e);
        }
    }
}
