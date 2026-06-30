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

  it('encryptField 使用公钥加密，结果可用对应私钥解密', () => {
    const plain = '13800138000';
    const encrypted = encryptField(plain, publicKeyBase64);
    assert.ok(encrypted.length > 0);

    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyBase64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
    const decrypted = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(encrypted, 'base64url')
    );
    assert.equal(decrypted.toString('utf-8'), plain);
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
