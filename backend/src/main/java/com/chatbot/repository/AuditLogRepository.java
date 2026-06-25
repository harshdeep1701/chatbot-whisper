package com.chatbot.repository;

import com.chatbot.model.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<AuditLog> findByConversationIdOrderByCreatedAtAsc(String conversationId);
    List<AuditLog> findByActionOrderByCreatedAtDesc(String action);
}
