package com.chatbot.service;

import com.chatbot.client.TtsClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class TextToSpeechService {

    private static final Logger log = LoggerFactory.getLogger(TextToSpeechService.class);

    private final TtsClient ttsClient;

    public TextToSpeechService(TtsClient ttsClient) {
        this.ttsClient = ttsClient;
    }

    public byte[] synthesizeSpeech(String text) {
        log.info("Synthesizing speech: textLength={} chars", text.length());
        return ttsClient.synthesize(text);
    }
}
