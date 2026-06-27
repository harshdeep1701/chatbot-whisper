package com.chatbot.exception;

public class TtsException extends RuntimeException {
    public TtsException(String message, Throwable cause) {
        super(message, cause);
    }

    public TtsException(String message) {
        super(message);
    }
}
