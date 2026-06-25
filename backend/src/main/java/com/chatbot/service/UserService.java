package com.chatbot.service;

import com.chatbot.config.JwtTokenProvider;
import com.chatbot.dto.AuthResponse;
import com.chatbot.dto.LoginRequest;
import com.chatbot.dto.RegisterRequest;
import com.chatbot.model.User;
import com.chatbot.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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
        if (userRepository.existsByUsername(request.getUsername())) {
            log.warn("Registration failed — username already exists: {}", request.getUsername());
            return AuthResponse.error("Username already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            log.warn("Registration failed — email already exists: {}", request.getEmail());
            return AuthResponse.error("Email already registered");
        }

        User user = new User(
                request.getUsername(),
                request.getEmail(),
                passwordEncoder.encode(request.getPassword())
        );
        user = userRepository.save(user);

        String token = jwtTokenProvider.generateToken(user.getUsername(), user.getId(), user.getRole());
        log.info("User registered successfully: username={}, id={}", user.getUsername(), user.getId());
        return new AuthResponse(token, user.getUsername(), user.getId());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername()).orElse(null);
        if (user == null) {
            log.warn("Login failed — user not found: {}", request.getUsername());
            return AuthResponse.error("Invalid username or password");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            log.warn("Login failed — invalid password for user: {}", request.getUsername());
            return AuthResponse.error("Invalid username or password");
        }

        String token = jwtTokenProvider.generateToken(user.getUsername(), user.getId(), user.getRole());
        log.info("User logged in: username={}, id={}", user.getUsername(), user.getId());
        return new AuthResponse(token, user.getUsername(), user.getId());
    }

    /**
     * Upgrades a user to premium tier (1M tokens/day).
     * Intended for admin use only — not exposed via UI.
     */
    public void upgradeToPremium(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        user.setPremium(true);
        user.setPremiumUpgradedAt(java.time.LocalDateTime.now());
        userRepository.save(user);
        log.info("User upgraded to premium: username={}, id={}", user.getUsername(), userId);
    }

    /**
     * Returns the user's current tier.
     */
    public String getUserTier(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        return user.isPremium() ? "premium" : "free";
    }

    /**
     * Returns all users ordered by creation date (newest first).
     */
    public List<User> listAllUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * Downgrades a user from premium back to free tier.
     */
    public void downgradeToFree(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        user.setPremium(false);
        user.setPremiumUpgradedAt(null);
        userRepository.save(user);
        log.info("User downgraded to free: username={}, id={}", user.getUsername(), userId);
    }

    /**
     * Grants ADMIN role to a user.
     */
    public void makeAdmin(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        user.setRole("ADMIN");
        userRepository.save(user);
        log.info("User promoted to ADMIN: username={}, id={}", user.getUsername(), userId);
    }

    /**
     * Removes ADMIN role from a user (demotes to USER).
     */
    public void removeAdmin(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        user.setRole("USER");
        userRepository.save(user);
        log.info("ADMIN role removed: username={}, id={}", user.getUsername(), userId);
    }
}
