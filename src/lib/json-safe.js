/**
 * int64 安全的 JSON 解析。
 *
 * uSMART 部分接口（如 stock-record）把 id / entrustId / userId 以 JSON number 返回，
 * 数值超过 2^53 时 JSON.parse 会静默丢精度（实测 2087690029453040600 → 2087690029453040600 的尾数被抹）。
 * 拿错 entrustId 去撤单是灾难性的，所以解析前把 16 位以上的整数字面量转成字符串。
 */
const BIG_INT_RE = /([:\[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g;

export function parseJsonSafe(text) {
  if (typeof text !== 'string') return text;
  const guarded = text.replace(BIG_INT_RE, (_, prefix, digits) => `${prefix}"${digits}"`);
  return JSON.parse(guarded);
}
