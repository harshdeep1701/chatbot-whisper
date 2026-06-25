package com.chatbot.controller;

import com.chatbot.dto.SttResponse;
import com.chatbot.service.AuditService;
import com.chatbot.service.TextToSpeechService;
import com.chatbot.service.WhisperService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/speech")
public class SpeechController {

    private static final Logger log = LoggerFactory.getLogger(SpeechController.class);

    private final WhisperService whisperService;
    private final TextToSpeechService textToSpeechService;
    private final AuditService auditService;

    public SpeechController(WhisperService whisperService,
                            TextToSpeechService textToSpeechService,
                            AuditService auditService) {
        this.whisperService = whisperService;
        this.textToSpeechService = textToSpeechService;
        this.auditService = auditService;
    }

    /**
     * Speech-to-Text: Transcribe audio using OpenAI Whisper
     */
    @PostMapping(value = "/stt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SttResponse> speechToText(@RequestParam("audio") MultipartFile audioFile,
                                                     Authentication auth,
                                                     HttpServletRequest httpRequest) {
        String username = auth != null ? auth.getName() : "anonymous";
        Long userId = auth != null ? (Long) auth.getCredentials() : 0L;
        String filename = audioFile.getOriginalFilename();
        long size = audioFile.getSize();
        String contentType = audioFile.getContentType();
        log.info("STT request received — user={}, file={}, size={} bytes, contentType={}",
                username, filename, size, contentType);

        try {
            if (audioFile.isEmpty()) {
                log.warn("STT aborted — audio file is empty");
                return ResponseEntity.badRequest().body(SttResponse.error("Audio file is empty"));
            }
            String transcribedText = whisperService.transcribe(audioFile);
            log.info("STT completed — user={}, transcribedTextLength={} chars", username, transcribedText.length());

            auditService.log(
                    "STT", "/api/speech/stt", userId, username,
                    "audio(size=" + size + " bytes, type=" + contentType + ")",
                    "transcribedTextLength=" + transcribedText.length() + " chars",
                    null, httpRequest
            );

            return ResponseEntity.ok(new SttResponse(transcribedText));
        } catch (Exception e) {
            log.error("STT failed — user={}, file={}, size={}, error: {}", username, filename, size, e.getMessage(), e);
            auditService.log(
                    "STT_ERROR", "/api/speech/stt", userId, username,
                    "audio(size=" + size + " bytes)",
                    "error=" + e.getMessage(),
                    null, httpRequest
            );
            return ResponseEntity.internalServerError()
                    .body(SttResponse.error("Transcription failed: " + e.getMessage()));
        }
    }

    /**
     * Text-to-Speech: Synthesize speech from text using OpenAI TTS
     */
    @PostMapping(value = "/tts", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> textToSpeech(@RequestBody Map<String, String> request,
                                                Authentication auth,
                                                HttpServletRequest httpRequest) {
        String username = auth != null ? auth.getName() : "anonymous";
        Long userId = auth != null ? (Long) auth.getCredentials() : 0L;
        String text = request.get("text");
        String textPreview = text != null
                ? (text.length() > 80 ? text.substring(0, 80) + "..." : text)
                : "null";
        log.info("TTS request received — user={}, textLength={}", username,
                text != null ? text.length() : 0);

        try {
            if (text == null || text.isBlank()) {
                log.warn("TTS aborted — text is null or blank");
                return ResponseEntity.badRequest().build();
            }

            byte[] audioData = textToSpeechService.synthesizeSpeech(text);
            log.info("TTS completed — user={}, audioSize={} bytes", username, audioData.length);

            auditService.log(
                    "TTS", "/api/speech/tts", userId, username,
                    "textLength=" + text.length() + " chars",
                    "audioSize=" + audioData.length + " bytes",
                    null, httpRequest
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
            headers.setContentLength(audioData.length);

            return ResponseEntity.ok().headers(headers).body(audioData);
        } catch (Exception e) {
            log.error("TTS failed — user={}, textLength={}, error: {}",
                    username, text != null ? text.length() : 0, e.getMessage(), e);
            auditService.log(
                    "TTS_ERROR", "/api/speech/tts", userId, username,
                    "textLength=" + (text != null ? text.length() : 0),
                    "error=" + e.getMessage(),
                    null, httpRequest
            );
            return ResponseEntity.internalServerError().build();
        }
    }
}
