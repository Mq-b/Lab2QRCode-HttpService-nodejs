const configLoader = new (require('../configLoader'))();

class VersionService {
  constructor() {
    // 从配置中获取版本信息，如果配置中没有则使用默认值
    // TODO: 此处后续改为智能从github仓库的Release中拉取最新版本信息
    this.config = configLoader.getConfigValue('app') || {
      version: 'v1.0.0',
      update_url: 'https://github.com/Mq-b/Lab2QRCode/releases/latest',
      update_log: '默认更新日志'
    };
  }

  /**
   * 检查版本
   * @param {string} clientVersion 客户端版本号
   * @param {string} osArch 客户端操作系统架构
   * @returns {Object} 版本检查结果
   */
  checkVersion(clientVersion, osArch) {
    // 这里可以添加更复杂的版本比较逻辑
    const isLatest = this.isVersionLatest(clientVersion, this.config.version);
    
    return {
      version: this.config.version,
      update_url: this.config.update_url,
      update_log: this.config.update_log,
      need_update: !isLatest
    };
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
    const clientParts = cleanClientVersion.split('.').map(Number);
    const latestParts = cleanLatestVersion.split('.').map(Number);
    
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