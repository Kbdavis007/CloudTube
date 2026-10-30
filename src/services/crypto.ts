/**
 * Secure AES-GCM Encrypted Local Storage Utility
 * Uses native Web Crypto API (SubtleCrypto) to protect Cloudflare API tokens and credentials.
 */

const STORAGE_KEY = 'cloudtube_encrypted_cf_vault';
const SALT_KEY = 'cloudtube_crypto_salt';
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM

// Derive an AES-GCM key from a master keyphrase or device seed
async function deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function getOrCreateSalt(): Uint8Array {
  const stored = localStorage.getItem(SALT_KEY);
  if (stored) {
    return new Uint8Array(JSON.parse(stored));
  }
  const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(newSalt)));
  return newSalt;
}

export async function encryptAndSaveCredentials(
  data: { accountId: string; apiToken: string; accountEmail?: string; authMode?: 'token' | 'global'; customSecret?: string },
  passphrase = 'CloudTube-Device-Vault-Key-2026'
): Promise<string> {
  const salt = getOrCreateSalt();
  const key = await deriveKey(passphrase, salt);
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedData
  );

  const payload = {
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(cipherBuffer)),
    timestamp: new Date().toISOString(),
  };

  const serialized = JSON.stringify(payload);
  localStorage.setItem(STORAGE_KEY, serialized);
  return serialized;
}

export async function loadAndDecryptCredentials(
  passphrase = 'CloudTube-Device-Vault-Key-2026'
): Promise<{ accountId: string; apiToken: string; customSecret?: string } | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    const payload = JSON.parse(stored);
    const salt = getOrCreateSalt();
    const key = await deriveKey(passphrase, salt);
    const iv = new Uint8Array(payload.iv);
    const ciphertext = new Uint8Array(payload.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decryptedBuffer));
  } catch (err) {
    console.error('Failed to decrypt credentials from storage', err);
    return null;
  }
}

export function clearCredentialsVault(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
}

export function isVaultConfigured(): boolean {
  return !!localStorage.getItem(STORAGE_KEY);
}
