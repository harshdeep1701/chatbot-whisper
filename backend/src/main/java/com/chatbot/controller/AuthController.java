package com.chatbot.controller;

import com.chatbot.dto.AuthResponse;
import com.chatbot.dto.LoginRequest;
import com.chatbot.dto.RegisterRequest;
import com.chatbot.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        var response = userService.register(request);
        return response.success()
                ? ResponseEntity.ok(response)
                : ResponseEntity.badRequest().body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        var response = userService.login(request);
        return response.success()
                ? ResponseEntity.ok(response)
                : ResponseEntity.status(401).body(response);
    }
}
