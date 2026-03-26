package project.TutorLab.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encryption for chat message text.
 *
 * Ciphertext format (Base64-encoded): [12-byte IV][ciphertext + 16-byte GCM tag]
 *
 * If decryption fails (e.g., legacy plaintext message), the original value is
 * returned as-is so existing unencrypted messages remain readable.
 */
@Service
public class MessageEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(MessageEncryptionService.class);

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;

    @Value("${app.chat.encryption-key:}")
    private String encryptionKeyBase64;

    private SecretKey secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    @PostConstruct
    void init() {
        if (encryptionKeyBase64 == null || encryptionKeyBase64.isBlank()) {
            log.warn("app.chat.encryption-key is not set — message encryption is DISABLED");
            return;
        }
        byte[] keyBytes = Base64.getDecoder().decode(encryptionKeyBase64);
        if (keyBytes.length != 32) {
            throw new IllegalArgumentException(
                "app.chat.encryption-key must be a Base64-encoded 32-byte (256-bit) key, got " + keyBytes.length + " bytes");
        }
        secretKey = new SecretKeySpec(keyBytes, "AES");
        log.info("Message encryption enabled (AES-256-GCM)");
    }

    public boolean isEnabled() {
        return secretKey != null;
    }

    /** Encrypts plaintext. Returns original value if encryption is disabled or input is null/empty. */
    public String encrypt(String plaintext) {
        if (!isEnabled() || plaintext == null || plaintext.isEmpty()) return plaintext;
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            byte[] combined = new byte[IV_LENGTH_BYTES + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH_BYTES);
            System.arraycopy(ciphertext, 0, combined, IV_LENGTH_BYTES, ciphertext.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("Failed to encrypt message", e);
            return plaintext;
        }
    }

    /**
     * Decrypts ciphertext. Returns original value if decryption fails
     * (handles legacy plaintext messages transparently).
     */
    public String decrypt(String ciphertext) {
        if (!isEnabled() || ciphertext == null || ciphertext.isEmpty()) return ciphertext;
        try {
            byte[] combined = Base64.getDecoder().decode(ciphertext);
            if (combined.length <= IV_LENGTH_BYTES) return ciphertext; // too short — plaintext

            byte[] iv = new byte[IV_LENGTH_BYTES];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH_BYTES);
            byte[] encrypted = new byte[combined.length - IV_LENGTH_BYTES];
            System.arraycopy(combined, IV_LENGTH_BYTES, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] plainBytes = cipher.doFinal(encrypted);

            return new String(plainBytes, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            // Not encrypted (legacy plaintext) — return as-is
            return ciphertext;
        }
    }
}
