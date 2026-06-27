package com.chatbot.service;

import com.chatbot.model.AuditLog;
import com.chatbot.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private static final int MAX_DATA_LENGTH = 2000;

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void log(String action, String endpoint, Long userId, String username,
                    String requestData, String responseData, String conversationId,
                    HttpServletRequest request) {
        try {
            var ipAddress = request != null ? request.getRemoteAddr() : null;
            var auditLog = AuditLog.builder()
                    .userId(userId)
                    .username(username)
                    .action(action)
                    .endpoint(endpoint)
                    .requestData(truncate(requestData))
                    .responseData(truncate(responseData))
                    .conversationId(conversationId)
                    .ipAddress(ipAddress)
                    .build();
            auditLogRepository.save(auditLog);
            log.debug("Audit log saved: action={}, userId={}", action, userId);
        } catch (Exception e) {
            log.warn("Failed to save audit log: {}", e.getMessage());
        }
    }

    public void log(String action, String endpoint, Long userId, String username,
                    String requestData, String responseData, String conversationId) {
        log(action, endpoint, userId, username, requestData, responseData, conversationId, null);
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= MAX_DATA_LENGTH ? s : s.substring(0, MAX_DATA_LENGTH) + "... [truncated]";
    }
}
