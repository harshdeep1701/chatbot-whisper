package com.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class WhisperService {

    private static final Logger log = LoggerFactory.getLogger(WhisperService.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${openai.whisper.api.url:https://api.openai.com/v1/audio/transcriptions}")
    private String apiUrl;

    @Value("${openai.api.key}")
    private String apiKey;

    @Value("${openai.whisper.model:whisper-1}")
    private String model;

    public WhisperService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
    }

    public String transcribe(MultipartFile audioFile) {
        String filename = audioFile.getOriginalFilename();
        long size = audioFile.getSize();
        log.info("Calling Whisper API — file={}, size={} bytes", filename, size);

        long start = System.currentTimeMillis();
        try {
            MultipartBodyBuilder bodyBuilder = new MultipartBodyBuilder();
            bodyBuilder.part("file", new ByteArrayResource(audioFile.getBytes()) {
                @Override
                public String getFilename() {
                    return audioFile.getOriginalFilename() != null
                            ? audioFile.getOriginalFilename()
                            : "audio.webm";
                }
            });
            bodyBuilder.part("model", model);
            bodyBuilder.part("response_format", "json");
            bodyBuilder.part("language", "en");

            JsonNode response = webClient.post()
                    .uri(apiUrl)
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(bodyBuilder.build()))
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();

            if (response != null && response.has("text")) {
                String text = response.get("text").asText();
                long elapsed = System.currentTimeMillis() - start;
                log.info("Whisper transcription succeeded — file={}, size={} bytes, textLength={} chars, took={}ms",
                        filename, size, text.length(), elapsed);
                return text;
            }

            long elapsed = System.currentTimeMillis() - start;
            log.error("Whisper API returned empty response — file={}, size={} bytes, took={}ms",
                    filename, size, elapsed);
            throw new RuntimeException("Failed to transcribe audio: empty response");
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            log.error("Whisper API call failed — file={}, size={} bytes, took={}ms, error: {}",
                    filename, size, elapsed, e.getMessage(), e);
            throw new RuntimeException("Failed to transcribe audio: " + e.getMessage(), e);
        }
    }
}
