import { UsmartClient, isSuccess } from './usmart-client.js';
import { loadSession, saveSession, clearSession } from './session-cache.js';
import { CliError, EXIT, describeCode } from './errors.js';

export const CODE_TOKEN_INVALID = '300101';
export const CODE_TRADE_LOCKED = '409984';

/**
 * uSMART 会话状态管理器。
 * 职责：维护登录/交易解锁状态，按需自动登录/解锁，并像 AOP 一样透明处理过期重试。
 */
export class UsmartSessionManager {
  constructor(config, { profile = 'default', dryRun = false } = {}) {
    this.config = config;
    this.profile = profile;
    this.client = new UsmartClient(config, { dryRun });
    this.loggedIn = false;
    this.tradeUnlocked = false;

    const cached = loadSession(config, profile);
    if (cached && cached.token) {
      this.client.token = cached.token;
      this.loggedIn = true;
      this.tradeUnlocked = !!cached.tradeUnlocked;
    }
  }

  persist() {
    if (this.client.dryRun) return;
    saveSession(this.config, { token: this.client.token, tradeUnlocked: this.tradeUnlocked }, this.profile);
  }

  async ensureLogin() {
    if (this.loggedIn) return;
    if (this.client.dryRun) { this.loggedIn = true; this.client.token = this.client.token || '<dry-run>'; return; }
    const result = await this.client.login();
    if (!isSuccess(result)) {
      // 错误码表里的 hint 更具体（如 107012 的签名不匹配），优先用它
      const known = describeCode(result.code);
      throw new CliError('login_failed', `登录失败：${result.msg || known?.msg || JSON.stringify(result)}`, {
        exitCode: EXIT.API_ERROR, code: result.code, raw: result.raw,
        hint: known?.hint || '检查 account.phoneNumber / loginPassword / areaCode / publicKey；若账号需短信验证，使用 usmart auth send-captcha + login-captcha',
      });
    }
    this.loggedIn = true;
    this.tradeUnlocked = false;
    this.persist();
  }

  /** 验证码登录。 */
  async loginWithCaptcha(captcha) {
    const result = await this.client.loginCaptcha(captcha);
    if (!isSuccess(result)) {
      throw new CliError('login_failed', `验证码登录失败：${result.msg || JSON.stringify(result)}`, { exitCode: EXIT.API_ERROR, code: result.code, raw: result.raw });
    }
    this.loggedIn = true;
    this.tradeUnlocked = false;
    this.persist();
    return result;
  }

  async ensureTradeUnlocked() {
    if (this.tradeUnlocked) return;
    await this.ensureLogin();
    if (this.client.dryRun) { this.tradeUnlocked = true; return; }
    const result = await this.client.tradeLogin();
    if (!isSuccess(result)) {
      const known = describeCode(result.code);
      throw new CliError('trade_unlock_failed', `交易解锁失败：${result.msg || known?.msg || JSON.stringify(result)}`, {
        exitCode: EXIT.API_ERROR, code: result.code, raw: result.raw,
        hint: known?.hint || '检查 account.tradePassword（6 位纯数字）；连续错误会锁定交易密码',
      });
    }
    this.tradeUnlocked = true;
    this.persist();
  }

  invalidateToken() {
    this.loggedIn = false;
    this.tradeUnlocked = false;
    this.client.token = '';
    clearSession(this.profile);
  }

  invalidateTradeUnlock() {
    this.tradeUnlocked = false;
    if (this.client.token) this.persist();
  }

  logout() {
    this.invalidateToken();
  }

  getClient() { return this.client; }
  isLoggedIn() { return this.loggedIn; }
  isTradeUnlocked() { return this.tradeUnlocked; }

  /**
   * AOP 式调用：自动完成登录 / 交易解锁 / 过期重试。
   * @param {Function} apiFn - 实际业务调用，参数为 UsmartClient
   * @param {{requireTrade?: boolean, auth?: boolean}} options
   */
  async call(apiFn, options = {}) {
    const { requireTrade = false, auth = true } = options;
    if (!auth) return apiFn(this.client);

    await this.ensureLogin();
    if (requireTrade) await this.ensureTradeUnlocked();

    let result = await apiFn(this.client);

    // 交易解锁过期（409984）—— 订单未提交，重新解锁后安全重试
    if (isTradeLocked(result)) {
      this.invalidateTradeUnlock();
      await this.ensureTradeUnlocked();
      result = await apiFn(this.client);
    }

    // token 过期（300101）
    if (isTokenExpired(result)) {
      this.invalidateToken();
      await this.ensureLogin();
      if (requireTrade) {
        await this.ensureTradeUnlocked();
        // 交易操作：已完成重登，由调用方重发，避免重复下单/撤单
        throw new CliError('session_expired', '交易 session 已过期，已完成重新登录，请重新发起请求', {
          exitCode: EXIT.API_ERROR, code: CODE_TOKEN_INVALID, retryable: true,
          hint: '原样重新执行同一条命令即可',
        });
      }
      result = await apiFn(this.client);
    }
    return result;
  }
}

function isTokenExpired(response) {
  return response != null && String(response.code) === CODE_TOKEN_INVALID;
}

function isTradeLocked(response) {
  return response != null && String(response.code) === CODE_TRADE_LOCKED;
}
