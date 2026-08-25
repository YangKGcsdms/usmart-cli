import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { encryptField, signBody, signWithHeaders } from '../src/lib/rsa.js';

describe('rsa', () => {
  let publicKeyBase64;
  let privateKeyBase64;

  before(() => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    privateKeyBase64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  });

  // 说明：不做「加密后再用私钥解密」的往返验证。Node 18.19+ 因 CVE-2023-46809（Marvin 攻击）
  // 禁止了 RSA_PKCS1_PADDING 的**私钥解密**，往返测试会在 CI 的 Node 18 上直接抛错。
  // 公钥加密（我们实际用到的方向）不受影响，因此这里改为验证密文的形态与随机性。
  it('encryptField 用公钥做 PKCS1 加密，输出 URL-safe Base64', () => {
    const plain = '13800138000';
    const encrypted = encryptField(plain, publicKeyBase64);

    // 2048 位密钥 → 密文 256 字节
    assert.equal(Buffer.from(encrypted, 'base64url').length, 256);
    // URL-safe Base64：不含 + / =
    assert.match(encrypted, /^[A-Za-z0-9_-]+$/);
    // PKCS1 v1.5 填充带随机数，同一明文两次加密结果必须不同
    assert.notEqual(encrypted, encryptField(plain, publicKeyBase64));
  });

  it('encryptField 对非法公钥给出清晰错误', () => {
    assert.throws(() => encryptField('x', 'not-a-key'), /publicKey 格式错误/);
  });

  it('signBody / signWithHeaders 对非法私钥给出清晰错误', () => {
    assert.throws(() => signBody('{}', 'not-a-key'), /privateKey 格式错误/);
  });

  it('私钥被截断时明确指出少了多少字节与字符（最常见的配置错误）', () => {
    const full = privateKeyBase64;
    const truncated = full.slice(0, full.length - 200);
    assert.throws(() => signBody('{}', truncated), (e) => {
      assert.match(e.message, /看起来是被截断了/);
      assert.match(e.message, /DER 头声明 \d+ 字节，实际只有 \d+ 字节/);
      assert.match(e.message, /完整应为 \d+ 个字符，少了 \d+ 个/);
      return true;
    });
  });

  it('完整密钥不会误报截断', () => {
    assert.doesNotThrow(() => signBody('{}', privateKeyBase64));
  });

  it('signBody 对 JSON body 签名，可用公钥验签', () => {
    const body = JSON.stringify({ phoneNumber: 'enc', password: 'enc', areaCode: '86' });
    const sig = signBody(body, privateKeyBase64);

    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const verify = crypto.createVerify('RSA-MD5');
    verify.update(body);
    assert.ok(verify.verify(publicKey, sig, 'base64'));
  });

  it('signWithHeaders 拼接 token+channel+lang+reqId+time+body 后签名', () => {
    const token = 'token123';
    const channel = 'test-channel';
    const lang = '1';
    const requestId = 'req123';
    const timestamp = 1234567890;
    const body = JSON.stringify({ secuIds: ['usAAPL'] });
    const sig = signWithHeaders(token, channel, lang, requestId, timestamp, body, privateKeyBase64);

    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const raw = token + channel + lang + requestId + timestamp + body;
    const verify = crypto.createVerify('RSA-MD5');
    verify.update(raw);
    assert.ok(verify.verify(publicKey, sig, 'base64url'));
  });
});
