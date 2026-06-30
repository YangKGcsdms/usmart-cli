import { encryptField, signBody, signWithHeaders } from './rsa.js';

let reqIdSeq = BigInt(Date.now()) * 100n;

/**
 * uSMART HTTP 客户端（对应 Java UsmartClient）。
 * 只负责构造请求、签名、发送 HTTP，不维护会话状态。
 */
export class UsmartClient {
  constructor(config) {
    this.config = config;
    this.account = config.account;
    this.env = config.env;
    this.token = '';
    // dry-run 模式下不发任何网络请求，返回请求描述符（用于预览写操作）。
    this.dryRun = false;
  }

  dryRunResult(method, url, body) {
    return { code: '0', __dryRun: { method, url, body } };
  }

  // =========================================================
  // 登录 / 交易解锁
  // =========================================================

  async login() {
    if (this.dryRun) return { code: '0', data: { token: '<dry-run>' } };
    const body = {
      phoneNumber: encryptField(this.account.phoneNumber, this.account.publicKey),
      password: encryptField(this.account.loginPassword, this.account.publicKey),
      areaCode: this.account.areaCode,
    };
    const bodyStr = JSON.stringify(body);
    const xSign = signBody(bodyStr, this.account.privateKey);
    const headers = this.buildBaseHeaders(xSign, nextRequestId());

    const resp = await postJson(this.env.tradeHost + '/user-server/open-api/login', body, headers);
    if (isSuccess(resp)) {
      this.token = resp.data?.token || '';
    }
    return resp;
  }

  async tradeLogin() {
    if (this.dryRun) return { code: '0' };
    const body = {
      password: encryptField(this.account.tradePassword, this.account.publicKey),
    };
    const bodyStr = JSON.stringify(body);
    const xSign = signBody(bodyStr, this.account.privateKey);
    const headers = {
      ...this.buildBaseHeaders(xSign, nextRequestId()),
      Authorization: this.token,
    };

    return postJson(this.env.tradeHost + '/user-server/open-api/trade-login', body, headers);
  }

  // =========================================================
  // 业务 API
  // =========================================================

  async postTrade(path, body) {
    if (this.dryRun) return this.dryRunResult('POST', this.env.tradeHost + path, body);
    const requestId = nextRequestId();
    const bodyStr = JSON.stringify(body);
    const xSign = signBody(bodyStr, this.account.privateKey);
    const headers = {
      ...this.buildBaseHeaders(xSign, requestId),
      Authorization: this.token,
    };
    return postJson(this.env.tradeHost + path, body, headers);
  }

  async postQuote(path, body) {
    if (this.dryRun) return this.dryRunResult('POST', this.env.quoteHost + path, body);
    const requestId = nextRequestId();
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyStr = JSON.stringify(body);
    const xSign = signWithHeaders(
      this.token,
      this.account.channel,
      this.account.lang,
      requestId,
      timestamp,
      bodyStr,
      this.account.privateKey
    );
    const headers = {
      ...this.buildBaseHeaders(xSign, requestId),
      Authorization: this.token,
      'X-Time': String(timestamp),
    };
    return postJson(this.env.quoteHost + path, body, headers);
  }

  // =========================================================
  // 内部工具
  // =========================================================

  buildBaseHeaders(xSign, requestId) {
    return {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Lang': this.account.lang,
      'X-Channel': this.account.channel,
      'X-Dt': 't5',
      'X-Sign': xSign,
      'X-Request-Id': requestId,
    };
  }
}

// =========================================================
// HTTP 工具
// =========================================================

async function postJson(url, body, headers) {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { code: -1, msg: `非 JSON 响应：${text}`, raw: text };
  }
}

function nextRequestId() {
  reqIdSeq += 1n;
  return reqIdSeq.toString();
}

export function isSuccess(response) {
  return response != null && String(response.code) === '0';
}
