package com.chatbot.service;

import com.chatbot.config.JwtTokenProvider;
import com.chatbot.dto.AuthResponse;
import com.chatbot.dto.LoginRequest;
import com.chatbot.dto.RegisterRequest;
import com.chatbot.exception.AuthException;
import com.chatbot.exception.UserNotFoundException;
import com.chatbot.model.User;
import com.chatbot.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            log.warn("Registration failed: username={}, reason=already exists", request.username());
            return AuthResponse.error("Username already taken");
        }
        if (userRepository.existsByEmail(request.email())) {
            log.warn("Registration failed: email={}, reason=already exists", request.email());
            return AuthResponse.error("Email already registered");
        }

        var user = new User(
                request.username(),
                request.email(),
                passwordEncoder.encode(request.password())
        );
        user = userRepository.save(user);

        var token = jwtTokenProvider.generateToken(user.getUsername(), user.getId(), user.getRole());
        log.info("User registered successfully: username={}, id={}", user.getUsername(), user.getId());
        return AuthResponse.ok(token, user.getUsername(), user.getId());
    }

    public AuthResponse login(LoginRequest request) {
        var user = userRepository.findByUsername(request.username()).orElse(null);
        if (user == null || !passwordEncoder.matches(request.password(), user.getPassword())) {
            log.warn("Login failed: username={}", request.username());
            return AuthResponse.error("Invalid username or password");
        }

        var token = jwtTokenProvider.generateToken(user.getUsername(), user.getId(), user.getRole());
        log.info("User logged in: username={}, id={}", user.getUsername(), user.getId());
        return AuthResponse.ok(token, user.getUsername(), user.getId());
    }

    public void upgradeToPremium(Long userId) {
        var user = findUser(userId);
        user.setPremium(true);
        user.setPremiumUpgradedAt(LocalDateTime.now());
        userRepository.save(user);
        log.info("User upgraded to premium: id={}", userId);
    }

    public String getUserTier(Long userId) {
        var user = findUser(userId);
        return user.isPremium() ? "premium" : "free";
    }

    public List<User> listAllUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc();
    }

    public void downgradeToFree(Long userId) {
        var user = findUser(userId);
        user.setPremium(false);
        user.setPremiumUpgradedAt(null);
        userRepository.save(user);
        log.info("User downgraded to free: id={}", userId);
    }

    public void makeAdmin(Long userId) {
        var user = findUser(userId);
        user.setRole("ADMIN");
        userRepository.save(user);
        log.info("User promoted to ADMIN: id={}", userId);
    }

    public void removeAdmin(Long userId) {
        var user = findUser(userId);
        user.setRole("USER");
        userRepository.save(user);
        log.info("ADMIN role removed: id={}", userId);
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> {
                    log.warn("User not found: id={}", userId);
                    return new UserNotFoundException(userId);
                });
    }
}
