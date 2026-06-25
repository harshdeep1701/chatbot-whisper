package com.chatbot.dto;

public class ChatResponse {

    private String reply;
    private String conversationId;
    private boolean success;
    private String error;

    public ChatResponse() {}

    public ChatResponse(String reply, String conversationId) {
        this.reply = reply;
        this.conversationId = conversationId;
        this.success = true;
    }

    public static ChatResponse error(String error) {
        ChatResponse r = new ChatResponse();
        r.success = false;
        r.error = error;
        return r;
    }

    // Getters and Setters
    public String getReply() { return reply; }
    public void setReply(String reply) { this.reply = reply; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
