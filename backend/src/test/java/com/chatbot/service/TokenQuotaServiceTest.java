package com.chatbot.service;

import com.chatbot.config.JwtTokenProvider;
import com.chatbot.model.TokenUsage;
import com.chatbot.model.User;
import com.chatbot.repository.TokenUsageRepository;
import com.chatbot.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenQuotaServiceTest {

    @Mock
    private TokenUsageRepository tokenUsageRepository;

    @Mock
    private UserRepository userRepository;

    private TokenQuotaService service;

    private User freeUser;
    private User premiumUser;

    @BeforeEach
    void setUp() {
        service = new TokenQuotaService(tokenUsageRepository, userRepository);
        // Free tier: 10,000 tokens/day; Premium: 1,000,000 tokens/day
        ReflectionTestUtils.setField(service, "freeDailyLimit", 10_000);
        ReflectionTestUtils.setField(service, "premiumDailyLimit", 1_000_000);

        freeUser = new User("freeuser", "free@test.com", "pass");
        freeUser.setId(1L);
        freeUser.setPremium(false);

        premiumUser = new User("premuser", "prem@test.com", "pass");
        premiumUser.setId(2L);
        premiumUser.setPremium(true);
    }

    // ── checkQuota ──────────────────────────────────────────

    @Test
    void checkQuota_shouldPass_whenFreeUserHasNotExceeded10kLimit() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(freeUser));
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(1L), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        assertDoesNotThrow(() -> service.checkQuota(1L));
    }

    @Test
    void checkQuota_shouldPass_whenFreeUserExactlyAt10kLimit() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(freeUser));
        TokenUsage usage = new TokenUsage(1L, LocalDate.now(), 9_999);
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(1L), any(LocalDate.class)))
                .thenReturn(Optional.of(usage));

        assertDoesNotThrow(() -> service.checkQuota(1L));
    }

    @Test
    void checkQuota_shouldThrow_whenFreeUserExceeds10kLimit() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(freeUser));
        TokenUsage usage = new TokenUsage(1L, LocalDate.now(), 10_000);
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(1L), any(LocalDate.class)))
                .thenReturn(Optional.of(usage));

        assertThrows(RateLimitExceededException.class, () -> service.checkQuota(1L));
    }

    @Test
    void checkQuota_shouldPass_whenPremiumUserHasUsed900kTokens() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(premiumUser));
        TokenUsage usage = new TokenUsage(2L, LocalDate.now(), 900_000);
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(2L), any(LocalDate.class)))
                .thenReturn(Optional.of(usage));

        assertDoesNotThrow(() -> service.checkQuota(2L));
    }

    @Test
    void checkQuota_shouldThrow_whenPremiumUserExceeds1MLimit() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(premiumUser));
        TokenUsage usage = new TokenUsage(2L, LocalDate.now(), 1_000_000);
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(2L), any(LocalDate.class)))
                .thenReturn(Optional.of(usage));

        assertThrows(RateLimitExceededException.class, () -> service.checkQuota(2L));
    }

    // ── getRemainingTokens ──────────────────────────────────

    @Test
    void getRemainingTokens_shouldReturn10kForFreeUserWithNoUsage() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(freeUser));
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(1L), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        assertEquals(10_000, service.getRemainingTokens(1L));
    }

    @Test
    void getRemainingTokens_shouldReturnCorrectRemainingAfterUsage() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(freeUser));
        TokenUsage usage = new TokenUsage(1L, LocalDate.now(), 6_500);
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(1L), any(LocalDate.class)))
                .thenReturn(Optional.of(usage));

        assertEquals(3_500, service.getRemainingTokens(1L));
    }

    @Test
    void getRemainingTokens_shouldReturnZeroWhenExactlyAtLimit() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(freeUser));
        TokenUsage usage = new TokenUsage(1L, LocalDate.now(), 10_000);
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(1L), any(LocalDate.class)))
                .thenReturn(Optional.of(usage));

        assertEquals(0, service.getRemainingTokens(1L));
    }

    @Test
    void getRemainingTokens_shouldNotReturnNegative() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(freeUser));
        TokenUsage usage = new TokenUsage(1L, LocalDate.now(), 15_000);
        when(tokenUsageRepository.findByUserIdAndUsageDate(eq(1L), any(LocalDate.class)))
                .thenReturn(Optional.of(usage));

        assertEquals(0, service.getRemainingTokens(1L));
    }

    // ── getTotalTokensUsed ──────────────────────────────────

    @Test
    void getTotalTokensUsed_shouldReturnZeroForNewUser() {
        when(tokenUsageRepository.getTotalTokensUsedByUser(1L)).thenReturn(0);
        assertEquals(0, service.getTotalTokensUsed(1L));
    }

    @Test
    void getTotalTokensUsed_shouldReturnSummedTotal() {
        when(tokenUsageRepository.getTotalTokensUsedByUser(1L)).thenReturn(65_432);
        assertEquals(65_432, service.getTotalTokensUsed(1L));
    }

    // ════════════════════════════════════════════════════════
    //  UserService tests (inlined — same mock context)
    // ════════════════════════════════════════════════════════

    private UserService makeUserService() {
        return new UserService(userRepository, null, null);
    }

    @Test
    void userService_upgradeToPremium_shouldSetPremiumTrue() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(3L);
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        makeUserService().upgradeToPremium(3L);
        assertTrue(user.isPremium());
        verify(userRepository).save(user);
    }

    @Test
    void userService_downgradeToFree_shouldSetPremiumFalse() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(3L);
        user.setPremium(true);
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        makeUserService().downgradeToFree(3L);
        assertFalse(user.isPremium());
        verify(userRepository).save(user);
    }

    @Test
    void userService_makeAdmin_shouldSetRoleToADMIN() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(3L);
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        makeUserService().makeAdmin(3L);
        assertEquals("ADMIN", user.getRole());
    }

    @Test
    void userService_getUserTier_shouldReturnFree() {
        User user = new User("test", "test@test.com", "pass");
        user.setId(3L);
        when(userRepository.findById(3L)).thenReturn(Optional.of(user));
        assertEquals("free", makeUserService().getUserTier(3L));
    }
}
