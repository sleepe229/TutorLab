package project.TutorLab.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import project.TutorLab.service.MessageEncryptionService;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for AES-256-GCM message encryption.
 * No Spring context needed — tests the service in isolation.
 */
class MessageEncryptionServiceTest {

    // 32 random bytes, Base64-encoded — valid AES-256 key for tests
    private static final String TEST_KEY_B64 =
            Base64.getEncoder().encodeToString(new byte[]{
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                    17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
            });

    private MessageEncryptionService service;
    private MessageEncryptionService disabledService;

    @BeforeEach
    void setUp() throws Exception {
        service = new MessageEncryptionService();
        ReflectionTestUtils.setField(service, "encryptionKeyBase64", TEST_KEY_B64);
        // Call @PostConstruct manually
        var initMethod = service.getClass().getDeclaredMethod("init");
        initMethod.setAccessible(true);
        initMethod.invoke(service);

        disabledService = new MessageEncryptionService();
        ReflectionTestUtils.setField(disabledService, "encryptionKeyBase64", "");
        var disabledInitMethod = disabledService.getClass().getDeclaredMethod("init");
        disabledInitMethod.setAccessible(true);
        disabledInitMethod.invoke(disabledService);
    }

    @Test
    void isEnabled_withValidKey_returnsTrue() {
        assertTrue(service.isEnabled());
    }

    @Test
    void isEnabled_withNoKey_returnsFalse() {
        assertFalse(disabledService.isEnabled());
    }

    @Test
    void init_with31ByteKey_throwsIllegalArgument() {
        MessageEncryptionService bad = new MessageEncryptionService();
        byte[] shortKey = new byte[31];
        ReflectionTestUtils.setField(bad, "encryptionKeyBase64",
                Base64.getEncoder().encodeToString(shortKey));
        assertThrows(Exception.class, () -> {
            var m = bad.getClass().getDeclaredMethod("init");
            m.setAccessible(true);
            m.invoke(bad);
        });
    }

    @Test
    void encrypt_thenDecrypt_returnsOriginalPlaintext() {
        String original = "Привет, это тестовое сообщение!";
        String ciphertext = service.encrypt(original);
        String decrypted = service.decrypt(ciphertext);
        assertEquals(original, decrypted);
    }

    @Test
    void encrypt_producesDifferentCiphertextEachTime() {
        // GCM uses random IV — same plaintext produces different ciphertext
        String plain = "same text";
        String c1 = service.encrypt(plain);
        String c2 = service.encrypt(plain);
        assertNotEquals(c1, c2);
    }

    @Test
    void encrypt_ciphertextIsBase64AndNotPlaintext() {
        String plain = "secret message";
        String ciphertext = service.encrypt(plain);
        // Should be valid Base64
        assertDoesNotThrow(() -> Base64.getDecoder().decode(ciphertext));
        // Should not contain the plaintext
        assertFalse(ciphertext.contains("secret message"));
    }

    @Test
    void decrypt_legacyPlaintextMessage_returnsAsIs() {
        // Old messages stored before encryption was enabled — must not throw
        String legacy = "это старое сообщение без шифрования";
        String result = service.decrypt(legacy);
        assertEquals(legacy, result);
    }

    @Test
    void decrypt_emptyString_returnsEmpty() {
        assertEquals("", service.decrypt(""));
        assertEquals("", service.encrypt(""));
    }

    @Test
    void decrypt_null_returnsNull() {
        assertNull(service.decrypt(null));
        assertNull(service.encrypt(null));
    }

    @Test
    void encrypt_disabled_returnsPlaintextUnchanged() {
        String plain = "not encrypted";
        assertEquals(plain, disabledService.encrypt(plain));
    }

    @Test
    void decrypt_disabled_returnsInputUnchanged() {
        String input = "some input";
        assertEquals(input, disabledService.decrypt(input));
    }

    @Test
    void decrypt_tamperedCiphertext_fallsBackToPlaintext() {
        String plain = "tamper test";
        String ciphertext = service.encrypt(plain);
        // Flip the last character to corrupt the GCM tag
        char last = ciphertext.charAt(ciphertext.length() - 1);
        char flipped = last == 'A' ? 'B' : 'A';
        String tampered = ciphertext.substring(0, ciphertext.length() - 1) + flipped;
        // Should not throw — returns original tampered string as fallback
        String result = service.decrypt(tampered);
        assertNotNull(result);
    }

    @Test
    void encryptDecrypt_emojisAndSpecialCharacters_roundtrips() {
        String special = "🎓 Homework: solve x² + y² = r² — due «Monday»";
        assertEquals(special, service.decrypt(service.encrypt(special)));
    }

    @Test
    void encryptDecrypt_longMessage_roundtrips() {
        String long_ = "A".repeat(10_000);
        assertEquals(long_, service.decrypt(service.encrypt(long_)));
    }
}
