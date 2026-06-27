package com.chatbot.dto;

public record ChatResponse(
    String reply,
    String conversationId,
    boolean success,
    String error
) {
    public static ChatResponse ok(String reply, String conversationId) {
        return new ChatResponse(reply, conversationId, true, null);
    }

    public static ChatResponse error(String error) {
        return new ChatResponse(null, null, false, error);
    }
}
