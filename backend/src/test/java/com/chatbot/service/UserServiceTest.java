package com.chatbot.service;

import com.chatbot.config.JwtTokenProvider;
import com.chatbot.model.User;
import com.chatbot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserServiceTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private JwtTokenProvider jwtTokenProvider;
    private UserService userService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenProvider = mock(JwtTokenProvider.class);
        userService = new UserService(userRepository, passwordEncoder, jwtTokenProvider);
    }

    @Test
    void upgradeToPremium_shouldSetPremiumTrue() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        userService.upgradeToPremium(1L);
        assertTrue(user.isPremium());
        assertNotNull(user.getPremiumUpgradedAt());
        verify(userRepository).save(user);
    }

    @Test
    void downgradeToFree_shouldSetPremiumFalse() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(1L);
        user.setPremium(true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        userService.downgradeToFree(1L);
        assertFalse(user.isPremium());
        assertNull(user.getPremiumUpgradedAt());
        verify(userRepository).save(user);
    }

    @Test
    void makeAdmin_shouldSetRoleToADMIN() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        userService.makeAdmin(1L);
        assertEquals("ADMIN", user.getRole());
        assertTrue(user.isAdmin());
        verify(userRepository).save(user);
    }

    @Test
    void removeAdmin_shouldSetRoleToUSER() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(1L);
        user.setRole("ADMIN");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        userService.removeAdmin(1L);
        assertEquals("USER", user.getRole());
        verify(userRepository).save(user);
    }

    @Test
    void getUserTier_shouldReturnFreeForDefaultUser() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertEquals("free", userService.getUserTier(1L));
    }

    @Test
    void getUserTier_shouldReturnPremiumForPremiumUser() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(1L);
        user.setPremium(true);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertEquals("premium", userService.getUserTier(1L));
    }

    @Test
    void listAllUsers_shouldReturnAllUsers() {
        User u1 = new User("a", "a@test.com", "pass");
        User u2 = new User("b", "b@test.com", "pass");
        when(userRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(u2, u1));

        List<User> users = userService.listAllUsers();
        assertEquals(2, users.size());
        assertEquals("b", users.get(0).getUsername());
    }

    @Test
    void upgradeToPremium_shouldThrowWhenUserNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(RuntimeException.class, () -> userService.upgradeToPremium(99L));
    }
}
