package com.chatbot.controller;

import com.chatbot.model.User;
import com.chatbot.service.TokenQuotaService;
import com.chatbot.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserService userService;
    private final TokenQuotaService tokenQuotaService;

    public AdminController(UserService userService, TokenQuotaService tokenQuotaService) {
        this.userService = userService;
        this.tokenQuotaService = tokenQuotaService;
    }

    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> listUsers() {
        var users = userService.listAllUsers();
        var result = users.stream().map(this::toUserMap).toList();

        return ResponseEntity.ok(Map.of(
                "success", true, "count", result.size(), "users", result));
    }

    @PostMapping("/users/{userId}/premium")
    public ResponseEntity<Map<String, Object>> upgradeUser(@PathVariable Long userId) {
        userService.upgradeToPremium(userId);
        return ResponseEntity.ok(Map.of(
                "success", true, "userId", userId, "tier", "premium"));
    }

    @PostMapping("/users/{userId}/free")
    public ResponseEntity<Map<String, Object>> downgradeUser(@PathVariable Long userId) {
        userService.downgradeToFree(userId);
        return ResponseEntity.ok(Map.of(
                "success", true, "userId", userId, "tier", "free"));
    }

    @PostMapping("/users/{userId}/make-admin")
    public ResponseEntity<Map<String, Object>> makeAdmin(@PathVariable Long userId) {
        userService.makeAdmin(userId);
        return ResponseEntity.ok(Map.of(
                "success", true, "userId", userId, "role", "ADMIN"));
    }

    @PostMapping("/users/{userId}/remove-admin")
    public ResponseEntity<Map<String, Object>> removeAdmin(@PathVariable Long userId) {
        userService.removeAdmin(userId);
        return ResponseEntity.ok(Map.of(
                "success", true, "userId", userId, "role", "USER"));
    }

    @GetMapping("/quota/{userId}")
    public ResponseEntity<Map<String, Object>> getUserQuota(@PathVariable Long userId) {
        var tier = userService.getUserTier(userId);
        var remaining = tokenQuotaService.getRemainingTokens(userId);
        var totalUsed = tokenQuotaService.getTotalTokensUsed(userId);
        return ResponseEntity.ok(Map.of(
                "userId", userId, "tier", tier,
                "remainingTokens", remaining, "totalTokensUsed", totalUsed));
    }

    private Map<String, Object> toUserMap(User user) {
        var map = new LinkedHashMap<String, Object>();
        map.put("id", user.getId());
        map.put("username", user.getUsername());
        map.put("email", user.getEmail());
        map.put("role", user.getRole());
        map.put("tier", user.isPremium() ? "premium" : "free");
        map.put("totalTokensUsed", tokenQuotaService.getTotalTokensUsed(user.getId()));
        map.put("remainingTokens", tokenQuotaService.getRemainingTokens(user.getId()));
        map.put("premiumSince", user.getPremiumUpgradedAt());
        map.put("createdAt", user.getCreatedAt());
        return map;
    }
}
