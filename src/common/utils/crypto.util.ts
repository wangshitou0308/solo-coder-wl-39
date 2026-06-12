import * as CryptoJS from 'crypto-js';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export class CryptoUtil {
  static generateHash(data: string | object): string {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.SHA256(content).toString(CryptoJS.enc.Hex);
  }

  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(): string {
    return uuidv4().replace(/-/g, '');
  }

  static generateContractNumber(tenantId: string): string {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const tenantShort = tenantId.substring(0, 4).toUpperCase();
    return `HT${tenantShort}${dateStr}${rand}`;
  }
}
