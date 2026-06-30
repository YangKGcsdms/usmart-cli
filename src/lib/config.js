import os from 'os';
import path from 'path';
import fs from 'fs';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'usmart-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigPath(profile = 'default') {
  return CONFIG_FILE;
}

export function readConfig(profile = 'default') {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const all = JSON.parse(raw);
  return all[profile] || null;
}

export function writeConfig(profile, data) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  let all = {};
  if (fs.existsSync(CONFIG_FILE)) {
    all = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  }
  all[profile] = data;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(all, null, 2));
}
