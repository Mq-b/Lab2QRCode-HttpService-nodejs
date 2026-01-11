const VersionService = require('../services/versionService');

class VersionController {
  constructor() {
    this.versionService = new VersionService();
    this.checkVersion = this.checkVersion.bind(this);
  }

  /**
   * 检查版本的控制器方法
   * @param {Object} req Express请求对象
   * @param {Object} res Express响应对象
   */
  async checkVersion(req, res) {
    try {
      const { version, 'os-arch': osArch } = req.body;

      // 验证必需参数
      if (!version || !osArch) {
        return res.status(400).json({
          error: 'Missing required parameters: version and os-arch'
        });
      }

      // 调用服务层处理版本检查
      const result = await this.versionService.checkVersion(version, osArch);

      // 返回结果
      res.status(200).json({
        version: result.version,
        update_url: result.update_url,
        update_log: result.update_log,
        update_need: result.need_update
      });
    } catch (error) {
      console.error('Error in checkVersion controller:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
}

module.exports = VersionController;