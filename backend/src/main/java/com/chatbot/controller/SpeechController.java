package com.chatbot.controller;

import com.chatbot.dto.SttResponse;
import com.chatbot.service.AuditService;
import com.chatbot.service.TextToSpeechService;
import com.chatbot.service.WhisperService;
import jakarta.servlet.http.HttpServletRequest;
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

    @PostMapping(value = "/stt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SttResponse> speechToText(@RequestParam("audio") MultipartFile audioFile,
                                                     Authentication auth,
                                                     HttpServletRequest httpRequest) {
        var username = auth != null ? auth.getName() : "anonymous";
        var userId = auth != null ? (Long) auth.getCredentials() : 0L;

        if (audioFile.isEmpty()) {
            return ResponseEntity.badRequest().body(SttResponse.error("Audio file is empty"));
        }

        var transcribedText = whisperService.transcribe(audioFile);

        auditService.log("STT", "/api/speech/stt", userId, username,
                "file=" + audioFile.getOriginalFilename() + ", size=" + audioFile.getSize() + " bytes",
                "transcribedTextLength=" + transcribedText.length() + " chars",
                null, httpRequest);

        return ResponseEntity.ok(SttResponse.ok(transcribedText));
    }

    @PostMapping(value = "/tts", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> textToSpeech(@RequestBody Map<String, String> request,
                                                Authentication auth,
                                                HttpServletRequest httpRequest) {
        var username = auth != null ? auth.getName() : "anonymous";
        var userId = auth != null ? (Long) auth.getCredentials() : 0L;
        var text = request.get("text");

        if (text == null || text.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        var audioData = textToSpeechService.synthesizeSpeech(text);

        auditService.log("TTS", "/api/speech/tts", userId, username,
                "textLength=" + text.length() + " chars",
                "audioSize=" + audioData.length + " bytes",
                null, httpRequest);

        var headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("audio/mpeg"));
        headers.setContentLength(audioData.length);

        return ResponseEntity.ok().headers(headers).body(audioData);
    }
}
