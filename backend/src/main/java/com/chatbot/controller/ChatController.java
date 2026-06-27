package com.chatbot.controller;

import com.chatbot.dto.ChatRequest;
import com.chatbot.dto.ChatResponse;
import com.chatbot.service.AuditService;
import com.chatbot.service.DeepSeekService;
import com.chatbot.service.TokenQuotaService;
import com.chatbot.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final DeepSeekService deepSeekService;
    private final AuditService auditService;
    private final TokenQuotaService tokenQuotaService;
    private final UserService userService;

    public ChatController(DeepSeekService deepSeekService,
                          AuditService auditService,
                          TokenQuotaService tokenQuotaService,
                          UserService userService) {
        this.deepSeekService = deepSeekService;
        this.auditService = auditService;
        this.tokenQuotaService = tokenQuotaService;
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request,
                                              Authentication auth,
                                              HttpServletRequest httpRequest) {
        var username = auth != null ? auth.getName() : "anonymous";
        var userId = auth != null ? (Long) auth.getCredentials() : 0L;

        tokenQuotaService.checkQuota(userId);

        var conversationId = deepSeekService.getConversationId(request.conversationId());
        var result = deepSeekService.sendMessage(request.message(), conversationId, request.history());

        tokenQuotaService.recordUsage(userId, result.totalTokens());

        auditService.log("CHAT_MESSAGE", "/api/chat", userId, username,
                "messageLength=" + request.message().length() + " | tokens=" + result.totalTokens(),
                "responseLength=" + result.reply().length() + " chars",
                conversationId, httpRequest);

        return ResponseEntity.ok(ChatResponse.ok(result.reply(), conversationId));
    }

    @GetMapping("/quota")
    public ResponseEntity<Map<String, Object>> getMyQuota(Authentication auth) {
        var userId = auth != null ? (Long) auth.getCredentials() : 0L;
        var tier = userService.getUserTier(userId);
        var remaining = tokenQuotaService.getRemainingTokens(userId);
        var totalUsed = tokenQuotaService.getTotalTokensUsed(userId);
        return ResponseEntity.ok(Map.of(
                "userId", userId, "tier", tier,
                "remainingTokens", remaining, "totalTokensUsed", totalUsed));
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Chat service is running");
    }
}
