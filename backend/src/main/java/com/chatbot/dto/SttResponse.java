package com.chatbot.dto;

public class SttResponse {

    private String transcribedText;
    private boolean success;
    private String error;

    public SttResponse() {}

    public SttResponse(String transcribedText) {
        this.transcribedText = transcribedText;
        this.success = true;
    }

    public static SttResponse error(String error) {
        SttResponse r = new SttResponse();
        r.success = false;
        r.error = error;
        return r;
    }

    // Getters and Setters
    public String getTranscribedText() { return transcribedText; }
    public void setTranscribedText(String transcribedText) { this.transcribedText = transcribedText; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
