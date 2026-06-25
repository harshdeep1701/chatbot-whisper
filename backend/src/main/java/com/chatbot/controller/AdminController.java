package com.chatbot.controller;

import com.chatbot.service.TokenQuotaService;
import com.chatbot.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin-only endpoints — NOT exposed on the UI.
 * Used for manual operations like upgrading users to premium tier.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    private final UserService userService;
    private final TokenQuotaService tokenQuotaService;

    public AdminController(UserService userService, TokenQuotaService tokenQuotaService) {
        this.userService = userService;
        this.tokenQuotaService = tokenQuotaService;
    }

    /**
     * Upgrades a user to the premium tier (1M tokens/day).
     * <p>
     * Usage:  POST /api/admin/upgrade
     * Body:   { "userId": 123 }
     * <p>
     * This endpoint is intentionally NOT exposed in the frontend UI.
     */
    @PostMapping("/upgrade")
    public ResponseEntity<Map<String, Object>> upgradeUser(@RequestBody Map<String, Long> request) {
        Long userId = request.get("userId");
        if (userId == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "error", "userId is required"
            ));
        }

        try {
            userService.upgradeToPremium(userId);
            log.info("Admin upgrade — userId={}", userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "userId", userId,
                    "tier", "premium",
                    "dailyTokenLimit", 1_000_000
            ));
        } catch (Exception e) {
            log.error("Admin upgrade failed — userId={}, error: {}", userId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "error", e.getMessage()
            ));
        }
    }

    /**
     * Returns the user's current tier and remaining tokens.
     */
    @GetMapping("/quota/{userId}")
    public ResponseEntity<Map<String, Object>> getUserQuota(@PathVariable Long userId) {
        try {
            String tier = userService.getUserTier(userId);
            int remaining = tokenQuotaService.getRemainingTokens(userId);
            return ResponseEntity.ok(Map.of(
                    "userId", userId,
                    "tier", tier,
                    "remainingTokens", remaining
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "error", e.getMessage()
            ));
        }
    }
}
