package com.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Base64;

@Service
public class TextToSpeechService {

    private static final Logger log = LoggerFactory.getLogger(TextToSpeechService.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${openai.tts.api.url:https://api.openai.com/v1/audio/speech}")
    private String apiUrl;

    @Value("${openai.api.key}")
    private String apiKey;

    @Value("${openai.tts.model:tts-1}")
    private String model;

    @Value("${openai.tts.voice:alloy}")
    private String voice;

    public TextToSpeechService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    public byte[] synthesizeSpeech(String text) {
        String preview = text.length() > 80 ? text.substring(0, 80) + "..." : text;
        log.info("Calling TTS API — textLength={}, preview=\"{}\"", text.length(), preview);

        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("model", model);
        requestBody.put("input", text);
        requestBody.put("voice", voice);
        requestBody.put("response_format", "mp3");

        long start = System.currentTimeMillis();
        try {
            byte[] response = webClient.post()
                    .uri(apiUrl)
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .block();

            long elapsed = System.currentTimeMillis() - start;

            if (response != null && response.length > 0) {
                log.info("TTS synthesis succeeded — audioSize={} bytes, textLength={}, took={}ms",
                        response.length, text.length(), elapsed);
                return response;
            }

            log.error("TTS API returned empty response — textLength={}, took={}ms", text.length(), elapsed);
            throw new RuntimeException("Failed to synthesize speech: empty response");
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("TTS API call failed — textLength={}, took={}ms, error: {}",
                    text.length(), elapsed, e.getMessage(), e);
            throw new RuntimeException("Failed to synthesize speech: " + e.getMessage(), e);
        }
    }
}
