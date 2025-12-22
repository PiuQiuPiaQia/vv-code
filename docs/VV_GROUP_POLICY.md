# VVCode 分组策略实现文档

## 功能概述

分组策略允许用户在不同的 API 配置之间切换，每个分组包含独立的 API Key、模型和 Base URL。

---

## 核心流程

```
用户登录成功
    ↓
GET /api/user/group-tokens（获取分组配置）
    ↓
存储到 GlobalState("vvGroupConfig")
    ↓
自动应用默认分组（isDefault=true）
    ↓
设置 apiKey、modelId、baseUrl
    ↓
用户可通过 VVGroupSelector 切换分组
    ↓
重建 API handler 以使用新配置
```

### 切换分组

```
用户点击 VVGroupSelector 选择分组
    ↓
调用 vvSwitchGroup RPC
    ↓
VVAuthService.switchGroup()
    ↓
更新 vvGroupConfig 的 isDefault 标记
    ↓
applyGroupConfig() 设置 apiKey、modelId、baseUrl
    ↓
重建 controller.task.api（buildApiHandler）
    ↓
postStateToWebview() 更新 UI
```

### 刷新分组配置

```
后台初始化完成
    ↓
打开 vscode://PiuQiuPiaQia.vvcode/init-complete
    ↓
SharedUriHandler 接收请求
    ↓
Controller.handleVVInitComplete()
    ↓
VVAuthService.refreshGroupConfig()
    ↓
更新 webview 状态
```

---

## API 协议

### 获取分组配置

**GET /api/user/group-tokens**

Headers:
- `Authorization: Bearer {access_token}`
- `New-Api-User: {user_id}`

响应：
```json
{
  "data": [
    {
      "type": "discount",
      "name": "经济模式",
      "api_key": "sk-xxx",
      "api_base_url": "https://vvcode.top",
      "default_model_id": "claude-3-5-sonnet-20241022",
      "is_default": true
    },
    {
      "type": "performance",
      "name": "性能模式",
      "api_key": "sk-yyy",
      "api_base_url": "https://vvcode.top",
      "default_model_id": "claude-sonnet-4-20250514",
      "is_default": false
    }
  ]
}
```

---

## 数据结构

```typescript
interface VVGroupItem {
  type: string           // 分组类型标识
  name: string           // 分组显示名称
  apiKey: string         // API Key
  apiBaseUrl: string     // API Base URL
  defaultModelId: string // 默认模型 ID
  isDefault: boolean     // 是否为当前选中
}

type VVGroupConfig = VVGroupItem[]
```

---

## 存储策略

| 数据 | 存储位置 | 说明 |
|------|----------|------|
| vvGroupConfig | GlobalState | 分组配置列表 |
| apiKey | Secrets | 当前分组的 API Key |
| anthropicBaseUrl | GlobalState | 当前分组的 Base URL |
| planModeApiModelId | GlobalState | Plan 模式模型 |
| actModeApiModelId | GlobalState | Act 模式模型 |

---

## 文件结构

```
src/services/auth/vv/
├── VVAuthService.ts              # 分组管理核心（switchGroup, applyGroupConfig, refreshGroupConfig）
└── providers/VVAuthProvider.ts   # API 调用（getGroupTokens）

src/core/controller/vVAccount/
├── vvSwitchGroup.ts              # 切换分组 RPC handler（含 API handler 重建）
└── vvRefreshGroupConfig.ts       # 刷新配置 RPC handler

src/services/uri/
└── SharedUriHandler.ts           # URI handler（/init-complete）

webview-ui/src/components/chat/
└── VVGroupSelector.tsx           # 分组选择器 UI

webview-ui/src/components/settings/
├── VVSettingsView.tsx            # VV 设置页面
└── VVAccountInfoCard.tsx         # 账户信息卡片

proto/cline/
└── vv_account.proto              # gRPC 服务定义
```

---

## 开发环境

开发模式下 (`IS_DEV=true`)，`applyGroupConfig` 强制使用 `DEV_BASE_URL` 覆盖分组的 `apiBaseUrl`：

```typescript
const baseUrl = isDev ? devBaseUrl : group.apiBaseUrl
```

环境变量配置（.vscode/launch.json）：
```json
"env": {
  "IS_DEV": "true",
  "DEV_BASE_URL": "http://127.0.0.1:3000"
}
```

---

## 隐藏功能

连点5下用户名可打开 Cline 原生设置页面（用于调试）。

实现位置：`webview-ui/src/components/settings/VVSettingsView.tsx`

---

**最后更新**: 2025-12-22
