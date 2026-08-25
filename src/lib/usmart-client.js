import { encryptField, signBody, signWithHeaders } from './rsa.js';
import { nextRequestId } from './request-id.js';
import { parseJsonSafe } from './json-safe.js';
import { CliError, EXIT, toCliError } from './errors.js';
import { acquire, bucketForQuotePath } from './rate-limit.js';

const DEFAULT_TIMEOUT_MS = Number(process.env.USMART_TIMEOUT_MS) || 20_000;

/**
 * uSMART HTTP 客户端。只负责构造请求、签名、发送 HTTP，不维护会话状态。
 *
 * 签名规则（官方文档）：
 * - 账户交易 API：X-Sign = safeBase64(MD5withRSA(body))
 * - 基础行情 API：X-Sign = safeBase64(MD5withRSA(Authorization + X-Channel + X-Lang + X-Request-Id + X-Time + body))
 * - 两侧都要求 X-Request-Id 为 19 位唯一数字、X-Time 为 unix 秒时间戳。
 */
export class UsmartClient {
  constructor(config, { dryRun = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.config = config;
    this.account = config.account;
    this.env = config.env;
    this.token = '';
    this.dryRun = dryRun;
    this.timeoutMs = timeoutMs;
  }

  /** 用渠道公钥加密敏感字段（手机号 / 密码）。 */
  encrypt(plain) {
    return encryptField(String(plain), this.account.publicKey);
  }

  dryRunResult(method, url, body, headers) {
    return { code: 0, __dryRun: { method, url, body, headers: redactHeaders(headers) } };
  }

  // =========================================================
  // 登录 / 交易解锁
  // =========================================================

  async login() {
    const body = {
      phoneNumber: this.encrypt(this.account.phoneNumber),
      password: this.encrypt(this.account.loginPassword),
      areaCode: this.account.areaCode,
    };
    const resp = await this.postTrade('/user-server/open-api/login', body, { auth: false });
    if (isSuccess(resp)) this.token = resp.data?.token || '';
    return resp;
  }

  /** 验证码登录（1.3）：需先 sendCaptcha(type=106)。 */
  async loginCaptcha(captcha) {
    const body = {
      phoneNumber: this.encrypt(this.account.phoneNumber),
      captcha: String(captcha),
      areaCode: this.account.areaCode,
    };
    const resp = await this.postTrade('/user-server/open-api/loginCaptcha', body, { auth: false });
    if (isSuccess(resp)) this.token = resp.data?.token || '';
    return resp;
  }

  async sendCaptcha(type) {
    return this.postTrade('/user-server/open-api/send-phone-captcha', {
      phoneNumber: this.encrypt(this.account.phoneNumber),
      areaCode: this.account.areaCode,
      type: String(type),
    }, { auth: false });
  }

  async tradeLogin() {
    return this.postTrade('/user-server/open-api/trade-login', {
      password: this.encrypt(this.account.tradePassword),
    });
  }

  // =========================================================
  // 业务 API
  // =========================================================

  async postTrade(path, body, { auth = true } = {}) {
    const requestId = nextRequestId();
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyStr = JSON.stringify(body);
    const headers = {
      ...this.baseHeaders(requestId, timestamp),
      'X-Sign': signBody(bodyStr, this.account.privateKey),
    };
    if (auth) headers.Authorization = this.token;
    const url = this.env.tradeHost.replace(/\/+$/, '') + path;
    if (this.dryRun) return this.dryRunResult('POST', url, body, headers);
    return this.send(url, bodyStr, headers);
  }

  async postQuote(path, body) {
    const requestId = nextRequestId();
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyStr = JSON.stringify(body);
    const headers = {
      ...this.baseHeaders(requestId, timestamp),
      Authorization: this.token,
      'X-Sign': signWithHeaders(this.token, this.account.channel, this.account.lang, requestId, timestamp, bodyStr, this.account.privateKey),
    };
    const url = this.env.quoteHost.replace(/\/+$/, '') + path;
    if (this.dryRun) return this.dryRunResult('POST', url, body, headers);
    await acquire(bucketForQuotePath(path));
    return this.send(url, bodyStr, headers, { retry: 1 });
  }

  // =========================================================
  // 内部工具
  // =========================================================

  baseHeaders(requestId, timestamp) {
    return {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Lang': String(this.account.lang),
      'X-Channel': String(this.account.channel),
      'X-Dt': this.account.deviceType || 't5',
      'X-Request-Id': requestId,
      'X-Time': String(timestamp),
    };
  }

  async send(url, bodyStr, headers, { retry = 0 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        return await postJson(url, bodyStr, headers, this.timeoutMs);
      } catch (err) {
        lastErr = toCliError(err);
        if (!lastErr.retryable || attempt === retry) throw lastErr;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    throw lastErr;
  }
}

function redactHeaders(headers) {
  const out = { ...headers };
  if (out.Authorization) out.Authorization = maskToken(out.Authorization);
  if (out['X-Sign']) out['X-Sign'] = out['X-Sign'].slice(0, 8) + '…';
  return out;
}

export function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

// =========================================================
// HTTP 工具
// =========================================================

async function postJson(url, bodyStr, headers, timeoutMs) {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyStr,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? parseJsonSafe(text) : {};
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    // HTTP 层错误（404/5xx…）：统一成失败响应，由输出层映射退出码 2。
    return {
      code: parsed && parsed.code !== undefined ? parsed.code : `HTTP_${res.status}`,
      msg: (parsed && (parsed.msg || parsed.message || parsed.error)) || `HTTP ${res.status} ${res.statusText}`,
      httpStatus: res.status,
      raw: parsed ?? text.slice(0, 500),
    };
  }
  if (parsed === null) {
    return { code: -1, msg: '非 JSON 响应', httpStatus: res.status, raw: text.slice(0, 500) };
  }
  return parsed;
}

export function isSuccess(response) {
  return response != null && String(response.code) === '0';
}

/** 把失败响应转成 CliError（退出码 2）。 */
export function apiError(response) {
  const code = response?.code;
  return new CliError('api_error', response?.msg || `uSMART 返回错误码 ${code}`, {
    exitCode: EXIT.API_ERROR,
    code,
    httpStatus: response?.httpStatus,
    raw: response?.raw ?? response,
  });
}
