# VVCode Changelog

## [1.0.6] - 2025-12-22

### Changed
- 更新系统提示词配置
- 优化各模型变体的agent角色定义
- 更新README文档
- 更新语言配置

## [1.0.2] - 2024-12-22

### Fixed
- 重新登录时重置 API 配置，确保使用最新服务器配置
- 设置 anthropicBaseUrl 默认值为 vvcode.top，解决 baseUrl 未生效问题

## [1.0.1] - 2024-12-21

### Fixed
- 将 vvcode.top API 请求改为 HTTPS

### Changed
- 更新 biome 配置和修复生产环境构建

## [1.0.0] - 2024-12-20

### Added
- VVCode 账户认证系统（OAuth2 + PKCE）
- 分组切换功能，支持多个 API 配置组
- 自动配置 API Key 和 Base URL
- 欢迎页面和设置页面集成

### Changed
- 基于 Cline 3.45.0 进行二次开发
- 品牌标识更换为 VVCode
- 默认 API 地址指向 vvcode.top

---

基于 [Cline](https://github.com/cline/cline) 开发
