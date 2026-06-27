package com.chatbot.dto;

public record ChatResult(
    String reply,
    int totalTokens
) {}
