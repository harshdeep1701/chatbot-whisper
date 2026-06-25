package com.chatbot.repository;

import com.chatbot.model.TokenUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface TokenUsageRepository extends JpaRepository<TokenUsage, Long> {
    Optional<TokenUsage> findByUserIdAndUsageDate(Long userId, LocalDate usageDate);

    @Query("SELECT COALESCE(SUM(t.tokensUsed), 0) FROM TokenUsage t WHERE t.userId = :userId")
    int getTotalTokensUsedByUser(@Param("userId") Long userId);
}
