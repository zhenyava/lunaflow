import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Generate a valid 32-byte key from the provided secret
const getSecret = () => {
  const secret = process.env.SESSION_SECRET || 'default_secret_for_local_dev_only_12345';
  return crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
};

export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decrypt = (text: string): string => {
  const [ivHex, authTagHex, encryptedHex] = text.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid encrypted format');
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecret(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};
