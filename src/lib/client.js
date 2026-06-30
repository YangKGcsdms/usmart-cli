import { readConfig } from './config.js';

export async function createClient(profile = 'default') {
  const config = readConfig(profile);
  if (!config) {
    throw new Error(`未找到配置，请先运行：usmart config init`);
  }

  return {
    baseURL: config.base_url,
    token: config.token,
    async request(method, path, { params = {}, data = null } = {}) {
      const url = new URL(path, this.baseURL);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });

      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const res = await fetch(url.toString(), {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const err = new Error(json.message || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = json;
        throw err;
      }
      return json;
    },
    get(path, params) {
      return this.request('GET', path, { params });
    },
    post(path, data) {
      return this.request('POST', path, { data });
    },
  };
}
