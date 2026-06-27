package com.chatbot.exception;

public class SttException extends RuntimeException {
    public SttException(String message, Throwable cause) {
        super(message, cause);
    }

    public SttException(String message) {
        super(message);
    }
}
