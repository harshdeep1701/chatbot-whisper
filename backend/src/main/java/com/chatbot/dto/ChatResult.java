package com.chatbot.dto;

/**
 * Wraps the chat reply along with the total tokens consumed
 * (prompt + completion) from all DeepSeek API calls made
 * to produce this response (including tool-call rounds).
 */
public class ChatResult {
    private final String reply;
    private final int totalTokens;

    public ChatResult(String reply, int totalTokens) {
        this.reply = reply;
        this.totalTokens = totalTokens;
    }

    public String getReply() { return reply; }
    public int getTotalTokens() { return totalTokens; }
}
