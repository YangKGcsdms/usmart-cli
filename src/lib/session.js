import { UsmartClient, isSuccess } from './usmart-client.js';
import { loadSession, saveSession, clearSession } from './session-cache.js';

export const CODE_TOKEN_INVALID = '300101';
export const CODE_TRADE_LOCKED = '409984';

/**
 * uSMART 会话状态管理器（对应 Java UsmartSessionManager + UsmartAspect）。
 * 职责：维护登录/交易解锁状态，按需自动登录/解锁，并像 AOP 一样透明处理过期重试。
 */
export class UsmartSessionManager {
  constructor(config) {
    this.config = config;
    this.client = new UsmartClient(config);
    this.loggedIn = false;
    this.tradeUnlocked = false;

    // 复用磁盘上缓存的 token / 解锁状态（若配置指纹一致）。
    // token 失效时由 call() 的自动重登重试兜底。
    const cached = loadSession(config);
    if (cached && cached.token) {
      this.client.token = cached.token;
      this.loggedIn = true;
      this.tradeUnlocked = !!cached.tradeUnlocked;
    }
  }

  persist() {
    if (this.client.dryRun) return; // dry-run 不落盘任何 token
    saveSession(this.config, {
      token: this.client.token,
      tradeUnlocked: this.tradeUnlocked,
    });
  }

  /**
   * 确保已登录，未登录时自动登录。
   */
  async ensureLogin() {
    if (this.loggedIn) return;
    const result = await this.client.login();
    if (isSuccess(result)) {
      this.loggedIn = true;
      this.tradeUnlocked = false;
      this.persist();
    } else {
      throw new Error(`[uSMART] 登录失败：${result.msg || result.message || JSON.stringify(result)}`);
    }
  }

  /**
   * 确保交易已解锁，未解锁时自动 trade-login。
   */
  async ensureTradeUnlocked() {
    if (this.tradeUnlocked) return;
    await this.ensureLogin();
    const result = await this.client.tradeLogin();
    if (isSuccess(result)) {
      this.tradeUnlocked = true;
      this.persist();
    } else {
      throw new Error(`[uSMART] 交易解锁失败：${result.msg || result.message || JSON.stringify(result)}`);
    }
  }

  /**
   * 标记 token 失效。
   */
  invalidateToken() {
    this.loggedIn = false;
    this.tradeUnlocked = false;
    this.client.token = '';
    clearSession();
  }

  /**
   * 标记交易解锁失效。
   */
  invalidateTradeUnlock() {
    this.tradeUnlocked = false;
    if (this.client.token) this.persist();
  }

  getClient() {
    return this.client;
  }

  isLoggedIn() {
    return this.loggedIn;
  }

  isTradeUnlocked() {
    return this.tradeUnlocked;
  }

  /**
   * AOP 式调用：自动完成登录/交易解锁/过期重试。
   *
   * @param {Function} apiFn - 实际业务调用，参数为 UsmartClient
   * @param {Object} options
   * @param {boolean} [options.requireTrade=false] - 是否需要交易解锁
   */
  async call(apiFn, options = {}) {
    const { requireTrade = false } = options;

    // 1. 确保已登录
    await this.ensureLogin();

    // 2. 交易方法确保已解锁
    if (requireTrade) {
      await this.ensureTradeUnlocked();
    }

    // 3. 执行目标方法
    let result = await apiFn(this.client);

    // 4. 检测交易解锁过期（409984）—— 订单未提交，重新解锁后安全重试
    if (isTradeLocked(result)) {
      this.invalidateTradeUnlock();
      await this.ensureTradeUnlocked();
      result = await apiFn(this.client);
    }

    // 5. 检测 token 过期并分策略处理
    if (isTokenExpired(result)) {
      this.invalidateToken();
      await this.ensureLogin();
      if (requireTrade) {
        await this.ensureTradeUnlocked();
      }

      if (!requireTrade) {
        // 只读操作：幂等，直接重试
        result = await apiFn(this.client);
      } else {
        // 交易操作：已完成重登，由调用方重发，避免重复下单/撤单
        const err = new Error('[uSMART] 交易 session 已过期，已完成重新登录，请重新发起请求');
        err.code = CODE_TOKEN_INVALID;
        err.retryable = true;
        throw err;
      }
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
