import crypto from 'crypto';

const RSA_ALGORITHM = 'RSA/ECB/PKCS1Padding';
const SIGN_ALGORITHM = 'RSA-MD5';

/**
 * 加载 X509 公钥（Base64 编码）。
 */
export function loadPublicKey(base64Key) {
  try {
    const keyBytes = Buffer.from(base64Key, 'base64');
    return crypto.createPublicKey({
      key: keyBytes,
      format: 'der',
      type: 'spki',
    });
  } catch (err) {
    throw new Error(`publicKey 格式错误，应为 Base64 编码的 X509/SPKI 公钥：${err.message}`);
  }
}

/**
 * 加载 PKCS8 私钥（Base64 编码）。
 */
export function loadPrivateKey(base64Key) {
  try {
    const keyBytes = Buffer.from(base64Key, 'base64');
    return crypto.createPrivateKey({
      key: keyBytes,
      format: 'der',
      type: 'pkcs8',
    });
  } catch (err) {
    throw new Error(`privateKey 格式错误，应为 Base64 编码的 PKCS8 私钥：${err.message}`);
  }
}

/**
 * 加密敏感字段（手机号、密码），使用 public_key 公钥，输出 URL-safe Base64。
 * 对应 Java UsmartRsaUtil.encryptField
 */
export function encryptField(plainText, publicKeyBase64) {
  const publicKey = loadPublicKey(publicKeyBase64);
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(plainText, 'utf-8')
  );
  return encrypted.toString('base64url');
}

/**
 * 登录请求签名：仅对 JSON Body 签名，输出标准 Base64。
 * 对应 Java UsmartRsaUtil.signBody
 */
export function signBody(jsonBody, privateKeyBase64) {
  const privateKey = loadPrivateKey(privateKeyBase64);
  const signer = crypto.createSign(SIGN_ALGORITHM);
  signer.update(jsonBody, 'utf-8');
  return signer.sign(privateKey, 'base64');
}

/**
 * 交易/行情请求签名：拼接 token+channel+lang+reqId+time+body 后签名，输出 URL-safe Base64。
 * 对应 Java UsmartRsaUtil.signWithHeaders
 */
export function signWithHeaders(token, channel, lang, requestId, timestamp, jsonBody, privateKeyBase64) {
  const raw = `${token}${channel}${lang}${requestId}${timestamp}${jsonBody}`;
  const privateKey = loadPrivateKey(privateKeyBase64);
  const signer = crypto.createSign(SIGN_ALGORITHM);
  signer.update(raw, 'utf-8');
  return signer.sign(privateKey, 'base64url');
}
