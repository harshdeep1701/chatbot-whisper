package com.chatbot.dto;

public record AuthResponse(
    String token,
    String username,
    Long userId,
    boolean success,
    String error
) {
    public static AuthResponse ok(String token, String username, Long userId) {
        return new AuthResponse(token, username, userId, true, null);
    }

    public static AuthResponse error(String error) {
        return new AuthResponse(null, null, null, false, error);
    }
}
