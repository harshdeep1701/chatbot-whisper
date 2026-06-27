package com.chatbot.dto;

public record SttResponse(
    String transcribedText,
    boolean success,
    String error
) {
    public static SttResponse ok(String transcribedText) {
        return new SttResponse(transcribedText, true, null);
    }

    public static SttResponse error(String error) {
        return new SttResponse(null, false, error);
    }
}
