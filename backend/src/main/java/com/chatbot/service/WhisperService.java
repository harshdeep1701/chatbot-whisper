package com.chatbot.service;

import com.chatbot.client.SttClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class WhisperService {

    private static final Logger log = LoggerFactory.getLogger(WhisperService.class);

    private final SttClient sttClient;

    public WhisperService(SttClient sttClient) {
        this.sttClient = sttClient;
    }

    public String transcribe(MultipartFile audioFile) {
        log.info("Transcribing audio: file={}, size={} bytes",
                audioFile.getOriginalFilename(), audioFile.getSize());
        return sttClient.transcribe(audioFile);
    }
}
