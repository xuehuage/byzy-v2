import axios from "axios"
import crypto from "crypto"
import { AppDataSource } from "../data-source"
import { Terminal } from "../entity/Terminal"

export interface PrepayParams {
    clientSn: string
    totalAmount: number // cents
    subject: string
    payway: string // "2" for Alipay, "3" for WeChat
}

export class PaymentService {
    private static readonly BASE_URL = "https://vsi-api.shouqianba.com" // Vendor Service Integration URL
    private static readonly DEVICE_ID = process.env.DEVICE_ID || 'byzy_pc_02'

    private static readonly SHOUQIANBA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5+MNqcjgw4bsSWhJfw2M
+gQB7P+pEiYOfvRmA6kt7Wisp0J3JbOtsLXGnErn5ZY2D8KkSAHtMYbeddphFZQJ
zUbiaDi75GUAG9XS3MfoKAhvNkK15VcCd8hFgNYCZdwEjZrvx6Zu1B7c29S64LQP
HceS0nyXF8DwMIVRcIWKy02cexgX0UmUPE0A2sJFoV19ogAHaBIhx5FkTy+eeBJE
bU03Do97q5G9IN1O3TssvbYBAzugz+yUPww2LadaKexhJGg+5+ufoDd0+V3oFL0/
ebkJvD0uiBzdE3/ci/tANpInHAUDIHoWZCKxhn60f3/3KiR8xuj2vASgEqphxT5O
fwIDAQAB
-----END PUBLIC KEY-----`

    static fixPublicKeyFormat(publicKey: string): string {
        if (publicKey.includes('-----BEGIN PUBLIC KEY-----') &&
            publicKey.includes('-----END PUBLIC KEY-----')) {
            return publicKey;
        }

        let fixedKey = publicKey;
        fixedKey = fixedKey.replace('---BEGIN PUBLIC KEY---', '-----BEGIN PUBLIC KEY-----');
        fixedKey = fixedKey.replace('---END PUBLIC KEY---', '-----END PUBLIC KEY-----');

        if (!fixedKey.includes('\n')) {
            const base64Content = fixedKey
                .replace('-----BEGIN PUBLIC KEY-----', '')
                .replace('-----END PUBLIC KEY-----', '')
                .trim();

            const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
            fixedKey = `-----BEGIN PUBLIC KEY-----\n${formattedContent}\n-----END PUBLIC KEY-----`;
        }

        return fixedKey;
    }

    static verifyCallbackSignature(rawBody: string, signature: string): boolean {
        try {
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(rawBody, 'utf8');
            verify.end();
            const bytesSign = Buffer.from(signature, 'base64');
            const formattedKey = this.fixPublicKeyFormat(this.SHOUQIANBA_PUBLIC_KEY);
            const isValid = verify.verify(formattedKey, bytesSign);

            if (!isValid) {
                console.warn("[Payment RSA] Verification failed for signature:", signature);
            } else {
                console.log("[Payment RSA] Verification successful");
            }

            return isValid;
        } catch (error) {
            console.error('RSA Verify Error:', error);
            return false;
        }
    }

    private static generateSign(body: string, key: string): string {
        return crypto.createHash("md5").update(body + key).digest("hex").toUpperCase()
    }

    private static async getTerminal(): Promise<Terminal> {
        const terminal = await AppDataSource.getRepository(Terminal).findOne({
            where: { deviceId: this.DEVICE_ID }
        });
        if (!terminal || !terminal.terminalSn || !terminal.terminalKey) {
            throw new Error('终端信息不完整，请检查数据库 terminals 表');
        }
        return terminal;
    }

    private static async requestThirdParty(path: string, data: any, sn: string, key: string): Promise<any> {
        try {
            // Stringify once to ensure the same string is used for signing and sending
            const body = JSON.stringify(data);
            const sign = this.generateSign(body, key);

            console.log(`[Payment Debug] URL: ${this.BASE_URL}${path}`);
            console.log(`[Payment Debug] Final Body: ${body}`);
            console.log(`[Payment Debug] SN: ${sn}, Sign: ${sign}`);

            const response = await axios.post(`${this.BASE_URL}${path}`, body, {
                headers: {
                    'Authorization': `${sn} ${sign}`,
                    'Content-Type': 'application/json',
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('第三方请求失败:', error.response?.data || error.message);
            throw new Error(`第三方接口调用失败: ${(error as Error).message}`);
        }
    }

    static async createPrepayment(params: PrepayParams) {
        const terminal = await this.getTerminal();

        const payload = {
            terminal_sn: terminal.terminalSn,
            client_sn: params.clientSn,
            total_amount: params.totalAmount.toString(),
            payway: params.payway,
            subject: params.subject,
            operator: 'byzy_fyh',
            notify_url: 'https://www.byzy.online/api/public/payment/callback'
        }

        return this.requestThirdParty('/upay/v2/precreate', payload, terminal.terminalSn, terminal.terminalKey)
    }

    static async searchPaymentStatus(clientSn: string) {
        const terminal = await this.getTerminal();

        const payload = {
            terminal_sn: terminal.terminalSn,
            client_sn: clientSn
        }

        return this.requestThirdParty('/upay/v2/query', payload, terminal.terminalSn, terminal.terminalKey)
    }
}
