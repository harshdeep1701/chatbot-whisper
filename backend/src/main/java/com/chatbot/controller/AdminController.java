package com.chatbot.controller;

import com.chatbot.model.User;
import com.chatbot.service.TokenQuotaService;
import com.chatbot.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Admin-only endpoints. Secured by JWT + ADMIN role.
 * Used for user management, tier upgrades, and system oversight.
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
     * Lists all registered users with token usage and tier info.
     * GET /api/admin/users
     */
    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> listUsers() {
        try {
            List<User> users = userService.listAllUsers();
            List<Map<String, Object>> result = new ArrayList<>();

            for (User user : users) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("id", user.getId());
                entry.put("username", user.getUsername());
                entry.put("email", user.getEmail());
                entry.put("role", user.getRole());
                entry.put("tier", user.isPremium() ? "premium" : "free");
                entry.put("totalTokensUsed", tokenQuotaService.getTotalTokensUsed(user.getId()));
                entry.put("remainingToday", tokenQuotaService.getRemainingTokens(user.getId()));
                entry.put("premiumSince", user.getPremiumUpgradedAt());
                entry.put("createdAt", user.getCreatedAt());
                result.add(entry);
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "count", result.size(),
                    "users", result
            ));
        } catch (Exception e) {
            log.error("Admin list users failed: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false, "error", e.getMessage()
            ));
        }
    }

    /**
     * Upgrades a user to the premium tier.
     * POST /api/admin/users/{userId}/premium
     */
    @PostMapping("/users/{userId}/premium")
    public ResponseEntity<Map<String, Object>> upgradeUser(@PathVariable Long userId) {
        try {
            userService.upgradeToPremium(userId);
            log.info("Admin upgrade — userId={}", userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "userId", userId,
                    "tier", "premium"
            ));
        } catch (Exception e) {
            log.error("Admin upgrade failed — userId={}, error: {}", userId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "error", e.getMessage()
            ));
        }
    }

    /**
     * Downgrades a user back to the free tier.
     * POST /api/admin/users/{userId}/free
     */
    @PostMapping("/users/{userId}/free")
    public ResponseEntity<Map<String, Object>> downgradeUser(@PathVariable Long userId) {
        try {
            userService.downgradeToFree(userId);
            log.info("Admin downgrade — userId={}", userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "userId", userId,
                    "tier", "free"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "error", e.getMessage()
            ));
        }
    }

    /**
     * Grants ADMIN role to a user.
     * POST /api/admin/users/{userId}/make-admin
     */
    @PostMapping("/users/{userId}/make-admin")
    public ResponseEntity<Map<String, Object>> makeAdmin(@PathVariable Long userId) {
        try {
            userService.makeAdmin(userId);
            log.info("Admin promotion — userId={}", userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "userId", userId,
                    "role", "ADMIN"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "error", e.getMessage()
            ));
        }
    }

    /**
     * Removes ADMIN role from a user.
     * POST /api/admin/users/{userId}/remove-admin
     */
    @PostMapping("/users/{userId}/remove-admin")
    public ResponseEntity<Map<String, Object>> removeAdmin(@PathVariable Long userId) {
        try {
            userService.removeAdmin(userId);
            log.info("Admin demotion — userId={}", userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "userId", userId,
                    "role", "USER"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "error", e.getMessage()
            ));
        }
    }

    /**
     * Returns quota info for a specific user.
     * GET /api/admin/quota/{userId}
     */
    @GetMapping("/quota/{userId}")
    public ResponseEntity<Map<String, Object>> getUserQuota(@PathVariable Long userId) {
        try {
            String tier = userService.getUserTier(userId);
            int remaining = tokenQuotaService.getRemainingTokens(userId);
            int totalUsed = tokenQuotaService.getTotalTokensUsed(userId);
            return ResponseEntity.ok(Map.of(
                    "userId", userId,
                    "tier", tier,
                    "remainingToday", remaining,
                    "totalTokensUsed", totalUsed
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false, "error", e.getMessage()
            ));
        }
    }
}
