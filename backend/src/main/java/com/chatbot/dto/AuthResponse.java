package com.chatbot.dto;

public class AuthResponse {

    private String token;
    private String username;
    private Long userId;
    private boolean success;
    private String error;

    public AuthResponse() {}

    public AuthResponse(String token, String username, Long userId) {
        this.token = token;
        this.username = username;
        this.userId = userId;
        this.success = true;
    }

    public static AuthResponse error(String error) {
        AuthResponse r = new AuthResponse();
        r.success = false;
        r.error = error;
        return r;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
