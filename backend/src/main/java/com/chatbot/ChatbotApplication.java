package com.chatbot;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ChatbotApplication {

    private static final Logger log = LoggerFactory.getLogger(ChatbotApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(ChatbotApplication.class, args);
        log.info("Chatbot Whisper application started");
    }
}
