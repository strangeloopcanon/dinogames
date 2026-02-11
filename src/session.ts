/**
 * Session token management for player reconnection
 */

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Generate a short room code (4 uppercase letters)
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate a session token format
 */
export function isValidSessionToken(token: string): boolean {
  return typeof token === 'string' && token.length === 32 && /^[A-Za-z0-9]+$/.test(token);
}

/**
 * Validate a room code format
 */
export function isValidRoomCode(code: string): boolean {
  return typeof code === 'string' && code.length === 4 && /^[A-Z]+$/.test(code.toUpperCase());
}
