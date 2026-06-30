import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'usmart-cli');
const DEFAULT_CONFIG_FILE = path.join(CONFIG_DIR, 'usmart.json');

export function getDefaultConfigPath() {
  return DEFAULT_CONFIG_FILE;
}

/**
 * 读取 uSMART 配置文件。
 * @param {string} [configPath] - 配置文件路径，缺省使用 ~/.config/usmart-cli/usmart.json
 */
export function readUsmartConfig(configPath = DEFAULT_CONFIG_FILE) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `未找到 uSMART 配置文件：${configPath}\n` +
      `请先运行：usmart usmart config-init\n` +
      `或复制 usmart.config.example.json 到 ${DEFAULT_CONFIG_FILE} 并填入真实值。`
    );
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);
  validateConfig(parsed);
  return parsed;
}

export function writeUsmartConfig(config, configPath = DEFAULT_CONFIG_FILE) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function validateConfig(config) {
  if (!config.account || !config.env) {
    throw new Error('配置文件必须包含 account 和 env 两个字段');
  }
  const requiredAccountFields = [
    'lang', 'channel', 'areaCode', 'phoneNumber',
    'loginPassword', 'tradePassword', 'publicKey', 'privateKey',
  ];
  for (const field of requiredAccountFields) {
    if (!config.account[field]) {
      throw new Error(`account.${field} 不能为空`);
    }
  }
  const requiredEnvFields = ['tradeHost', 'quoteHost'];
  for (const field of requiredEnvFields) {
    if (!config.env[field]) {
      throw new Error(`env.${field} 不能为空`);
    }
  }
}
