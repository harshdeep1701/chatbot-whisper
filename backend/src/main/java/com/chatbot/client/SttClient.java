package com.chatbot.client;

import com.chatbot.config.properties.OpenAiProperties;
import com.chatbot.config.properties.WhisperProperties;
import com.chatbot.exception.SttException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class SttClient {

    private static final Logger log = LoggerFactory.getLogger(SttClient.class);

    private final WebClient webClient;
    private final WhisperProperties whisperProperties;
    private final OpenAiProperties openAiProperties;

    public SttClient(WebClient.Builder webClientBuilder,
                     ObjectMapper objectMapper,
                     WhisperProperties whisperProperties,
                     OpenAiProperties openAiProperties) {
        this.webClient = webClientBuilder.build();
        this.whisperProperties = whisperProperties;
        this.openAiProperties = openAiProperties;
    }

    public String transcribe(MultipartFile audioFile) {
        var filename = audioFile.getOriginalFilename();
        log.info("Transcribing audio: file={}, size={} bytes", filename, audioFile.getSize());

        try {
            var bodyBuilder = new MultipartBodyBuilder();
            bodyBuilder.part("file", new ByteArrayResource(audioFile.getBytes()) {
                @Override
                public String getFilename() {
                    return audioFile.getOriginalFilename() != null
                            ? audioFile.getOriginalFilename() : "audio.webm";
                }
            });
            bodyBuilder.part("model", whisperProperties.model());
            bodyBuilder.part("response_format", "json");
            bodyBuilder.part("language", "en");

            var response = webClient.post()
                    .uri(whisperProperties.apiUrl())
                    .header("Authorization", "Bearer " + openAiProperties.key())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(bodyBuilder.build()))
                    .retrieve()
                    .bodyToMono(JsonNode.class)
                    .block();

            if (response != null && response.has("text")) {
                var text = response.get("text").asText();
                log.info("Transcription completed: file={}, textLength={} chars", filename, text.length());
                return text;
            }

            throw new SttException("Whisper API returned empty response");
        } catch (SttException e) {
            throw e;
        } catch (Exception e) {
            log.error("Transcription failed: file={}, error={}", filename, e.getMessage());
            throw new SttException("Failed to transcribe audio: " + e.getMessage(), e);
        }
    }
}
