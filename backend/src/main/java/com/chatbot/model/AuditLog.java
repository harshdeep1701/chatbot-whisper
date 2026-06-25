package com.chatbot.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "username", nullable = false, length = 100)
    private String username;

    @Column(name = "action", nullable = false, length = 50)
    private String action;

    @Column(name = "endpoint", length = 200)
    private String endpoint;

    @Column(name = "request_data", columnDefinition = "TEXT")
    private String requestData;

    @Column(name = "response_data", columnDefinition = "TEXT")
    private String responseData;

    @Column(name = "conversation_id", length = 100)
    private String conversationId;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Constructors
    public AuditLog() {}

    // Builder pattern
    public static AuditLogBuilder builder() {
        return new AuditLogBuilder();
    }

    public static class AuditLogBuilder {
        private final AuditLog log = new AuditLog();

        public AuditLogBuilder userId(Long userId) { log.userId = userId; return this; }
        public AuditLogBuilder username(String username) { log.username = username; return this; }
        public AuditLogBuilder action(String action) { log.action = action; return this; }
        public AuditLogBuilder endpoint(String endpoint) { log.endpoint = endpoint; return this; }
        public AuditLogBuilder requestData(String requestData) { log.requestData = requestData; return this; }
        public AuditLogBuilder responseData(String responseData) { log.responseData = responseData; return this; }
        public AuditLogBuilder conversationId(String conversationId) { log.conversationId = conversationId; return this; }
        public AuditLogBuilder ipAddress(String ipAddress) { log.ipAddress = ipAddress; return this; }
        public AuditLog build() { return log; }
    }

    // Getters
    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getUsername() { return username; }
    public String getAction() { return action; }
    public String getEndpoint() { return endpoint; }
    public String getRequestData() { return requestData; }
    public String getResponseData() { return responseData; }
    public String getConversationId() { return conversationId; }
    public String getIpAddress() { return ipAddress; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
