package com.chatbot.controller;

import com.chatbot.dto.ChatRequest;
import com.chatbot.dto.ChatResponse;
import com.chatbot.dto.ChatResult;
import com.chatbot.service.AuditService;
import com.chatbot.service.DeepSeekService;
import com.chatbot.service.RateLimitExceededException;
import com.chatbot.service.TokenQuotaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final DeepSeekService deepSeekService;
    private final AuditService auditService;
    private final TokenQuotaService tokenQuotaService;

    public ChatController(DeepSeekService deepSeekService,
                          AuditService auditService,
                          TokenQuotaService tokenQuotaService) {
        this.deepSeekService = deepSeekService;
        this.auditService = auditService;
        this.tokenQuotaService = tokenQuotaService;
    }

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request,
                                              Authentication auth,
                                              HttpServletRequest httpRequest) {
        String username = auth != null ? auth.getName() : "anonymous";
        Long userId = auth != null ? (Long) auth.getCredentials() : 0L;
        String convHint = request.getConversationId();
        String msgPreview = request.getMessage().length() > 100
                ? request.getMessage().substring(0, 100) + "..."
                : request.getMessage();
        log.info("Chat request received — user={}, conversationId={}, messageLength={}",
                username, convHint != null ? convHint : "new", request.getMessage().length());

        try {
            // ── 1. Check daily token quota ──
            tokenQuotaService.checkQuota(userId);

            // ── 2. Process the chat ──
            String conversationId = deepSeekService.getConversationId(request.getConversationId());
            ChatResult result = deepSeekService.sendMessage(
                    request.getMessage(),
                    conversationId,
                    request.getHistory()
            );

            // ── 3. Record token usage ──
            tokenQuotaService.recordUsage(userId, result.getTotalTokens());

            // ── 4. Audit log ──
            auditService.log(
                    "CHAT_MESSAGE", "/api/chat", userId, username,
                    "message=" + msgPreview + " | historySize=" +
                            (request.getHistory() != null ? request.getHistory().size() : 0) +
                            " | tokens=" + result.getTotalTokens(),
                    "responseLength=" + result.getReply().length() + " chars",
                    conversationId, httpRequest
            );

            log.info("Chat response sent — user={}, conversationId={}, responseLength={} chars, tokens={}",
                    username, conversationId, result.getReply().length(), result.getTotalTokens());
            return ResponseEntity.ok(new ChatResponse(result.getReply(), conversationId));

        } catch (RateLimitExceededException e) {
            log.warn("Chat rejected — daily limit reached — user={}, message={}",
                    username, e.getMessage());
            auditService.log(
                    "CHAT_RATE_LIMITED", "/api/chat", userId, username,
                    "messageLength=" + request.getMessage().length(),
                    "error=" + e.getMessage(),
                    request.getConversationId(), httpRequest
            );
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS.value())
                    .body(ChatResponse.error(e.getMessage()));

        } catch (Exception e) {
            String errorMsg = e.getMessage();
            boolean isSearchError = errorMsg != null &&
                    errorMsg.contains("Web search is temporarily unavailable");

            if (isSearchError) {
                log.warn("Chat aborted — search service unavailable — user={}, error: {}",
                        username, errorMsg);
                auditService.log(
                        "CHAT_SEARCH_ERROR", "/api/chat", userId, username,
                        "messageLength=" + request.getMessage().length(),
                        "error=" + errorMsg,
                        request.getConversationId(), httpRequest
                );
                return ResponseEntity.status(503)
                        .body(ChatResponse.error(errorMsg));
            }

            log.error("Chat request failed — user={}, messageLength={}, error: {}",
                    username, request.getMessage().length(), errorMsg, e);
            auditService.log(
                    "CHAT_ERROR", "/api/chat", userId, username,
                    "messageLength=" + request.getMessage().length(),
                    "error=" + errorMsg,
                    request.getConversationId(), httpRequest
            );
            return ResponseEntity.internalServerError()
                    .body(ChatResponse.error("Failed to process chat: " + errorMsg));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        log.debug("Health check requested");
        return ResponseEntity.ok("Chat service is running");
    }
}
