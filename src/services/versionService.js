const configLoader = new (require('../configLoader'))();
const https = require('https');

class VersionService {
  constructor() {
    // 从配置中获取版本信息，如果配置中没有则使用默认值
    this.baseConfig = configLoader.getConfigValue('app') || {
      version: 'v1.0.0',
      update_url: 'https://github.com/Mq-b/Lab2QRCode/releases/latest',
      update_log: '默认更新日志'
    };
    this.repo = this.#inferRepoFromUrl(this.baseConfig.update_url);
    this.cacheTtlMs = Number(this.baseConfig.github_release_cache_ttl_ms) || 5 * 60 * 1000;
    this._latestReleaseCache = { fetchedAt: 0, data: null, inflight: null };
  }

  /**
   * 检查版本
   * @param {string} clientVersion 客户端版本号
   * @param {string} osArch 客户端操作系统架构
   * @returns {Object} 版本检查结果
   */
  async checkVersion(clientVersion, osArch) {
    const latestConfig = await this.#getLatestConfig(osArch);
    const isLatest = this.isVersionLatest(clientVersion, latestConfig.version);

    return {
      version: latestConfig.version,
      update_url: latestConfig.update_url,
      update_log: latestConfig.update_log,
      need_update: !isLatest
    };
  }

  async #getLatestConfig(osArch) {
    if (!this.repo) return this.baseConfig;
    const release = await this.#getLatestRelease();
    return this.#configFromRelease(release, osArch);
  }

  async #getLatestRelease() {
    const now = Date.now();
    const cached = this._latestReleaseCache.data;
    if (cached && now - this._latestReleaseCache.fetchedAt < this.cacheTtlMs) return cached;

    if (this._latestReleaseCache.inflight) return this._latestReleaseCache.inflight;

    this._latestReleaseCache.inflight = this.#fetchLatestReleaseFromGitHub()
      .then((release) => {
        this._latestReleaseCache.data = release;
        this._latestReleaseCache.fetchedAt = Date.now();
        return release;
      })
      .catch(() => cached || null)
      .finally(() => {
        this._latestReleaseCache.inflight = null;
      });

    const release = await this._latestReleaseCache.inflight;
    return release || null;
  }

  #fetchLatestReleaseFromGitHub() {
    const url = `https://api.github.com/repos/${this.repo}/releases/latest`;
    return this.#httpsJson(url);
  }

  #configFromRelease(release, osArch) {
    if (!release) return this.baseConfig;

    const version = release?.tag_name || this.baseConfig.version;

    // 优先使用 release body 作为更新日志，为空时使用配置中的更新日志
    const update_log = (typeof release?.body === 'string' && release.body.trim())
      ? release.body
      : this.baseConfig.update_log;

    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const asset = this.#pickAssetForOsArch(assets, osArch);
    const update_url = asset?.browser_download_url || release?.html_url || this.baseConfig.update_url;

    return { version, update_url, update_log };
  }

  #pickAssetForOsArch(assets, osArch) {
    if (!assets.length) return null;
    const needle = String(osArch || '').trim().toLowerCase();
    if (!needle) return assets[0];

    const os = needle.includes('win') ? 'windows' : 'linux';

    const preferExts = os === 'windows'
      ? ['.zip', '.exe', '.msi']
      : ['.appimage', '.deb', '.rpm', '.tar.gz', '.tgz', '.zip'];

    for (const ext of preferExts) {
      const byExt = assets.find((a) => String(a?.name || '').toLowerCase().endsWith(ext));
      if (byExt) return byExt;
    }

    const direct = assets.find((a) => String(a?.name || '').toLowerCase().includes(needle));
    if (direct) return direct;

    const tokens = needle.split(/[^a-z0-9]+/).filter(Boolean);
    if (!tokens.length) return assets[0];

    return (
      assets.find((a) => {
        const name = String(a?.name || '').toLowerCase();
        return tokens.every((t) => name.includes(t));
      }) || assets[0]
    );
  }

  #httpsJson(url) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'lab2qrcode-httpservice',
            'Accept': 'application/vnd.github+json'
          }
        },
        (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error(`GitHub API request failed: ${res.statusCode} ${raw.slice(0, 200)}`));
            }
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(e);
            }
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  }

  #inferRepoFromUrl(updateUrl) {
    const s = String(updateUrl || '').trim();
    const m = s.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/|$)/i);
    if (!m) return null;
    const owner = m[1];
    const repo = m[2].replace(/\.git$/i, '');
    return owner && repo ? `${owner}/${repo}` : null;
  }

  /**
   * 比较版本号
   * @param {string} clientVersion 客户端版本
   * @param {string} latestVersion 最新版本
   * @returns {boolean} 是否为最新版本
   */
  isVersionLatest(clientVersion, latestVersion) {
    // 移除版本号前的 'v' 字符（如果存在）
    const cleanClientVersion = clientVersion.replace(/^v/, '');
    const cleanLatestVersion = latestVersion.replace(/^v/, '');

    // 按点号分割版本号
    const clientParts = cleanClientVersion.split('.').map((p) => Number(p) || 0);
    const latestParts = cleanLatestVersion.split('.').map((p) => Number(p) || 0);
    while (clientParts.length < 3) clientParts.push(0);
    while (latestParts.length < 3) latestParts.push(0);

    // 比较主版本号
    if (latestParts[0] > clientParts[0]) return false;
    if (latestParts[0] < clientParts[0]) return true;

    // 比较次版本号
    if (latestParts[1] > clientParts[1]) return false;
    if (latestParts[1] < clientParts[1]) return true;

    // 比较修订号
    if (latestParts[2] > clientParts[2]) return false;
    if (latestParts[2] < clientParts[2]) return true;

    // 版本相同
    return true;
  }
}

module.exports = VersionService;
