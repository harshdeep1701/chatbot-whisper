package com.chatbot.service;

/**
 * Thrown when a user has exceeded their daily token quota.
 */
public class RateLimitExceededException extends RuntimeException {
    public RateLimitExceededException(String message) {
        super(message);
    }
}
