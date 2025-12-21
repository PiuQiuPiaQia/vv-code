// VVCode Customization: VVCode 认证服务
// Created: 2025-12-20

import type { Controller } from "@/core/controller"
import type { StreamingResponseHandler } from "@/core/controller/grpc-handler"
import type { VVGroupConfig, VVGroupItem, VVUserConfig, VVUserInfo } from "@/shared/storage/state-keys"
import { generateCodeChallenge, generateCodeVerifier, generateState } from "@/shared/vv-crypto"
import { openExternal } from "@/utils/env"
import { type VVAuthInfo, VVAuthProvider } from "./providers/VVAuthProvider"

/**
 * VVCode 认证服务
 * 使用 VSCode URI Handler + PKCE 实现安全的 OAuth2 认证流程
 */
export class VVAuthService {
	private static instance: VVAuthService | null = null
	private _controller: Controller | null = null
	private _provider: VVAuthProvider
	private _authenticated: boolean = false
	private _activeAuthStatusUpdateSubscriptions = new Set<{
		controller: Controller
		responseStream: StreamingResponseHandler<VVAuthState>
	}>()

	// 防止重复请求的标记
	private _processingAuthCallback: boolean = false
	private _lastProcessedCode: string | null = null

	// 认证配置
	private readonly PUBLISHER = "PiuQiuPiaQia" // package.json 中的 publisher
	private readonly EXTENSION_ID = "vvcode" // package.json 中的 name

	// API 地址配置（支持开发环境）
	private readonly API_BASE_URL: string
	private readonly AUTH_PAGE_URL: string

	private constructor() {
		// 检测开发环境（通过 IS_DEV 环境变量）
		const isDevelopment = process.env.IS_DEV === "true" || process.env.VV_API_BASE_URL !== undefined
		const devBaseUrl = process.env.DEV_BASE_URL || "http://127.0.0.1:3000"

		// 支持通过环境变量自定义 API 地址
		if (process.env.VV_API_BASE_URL) {
			this.API_BASE_URL = process.env.VV_API_BASE_URL
			this.AUTH_PAGE_URL = `${process.env.VV_API_BASE_URL.replace("/api", "")}/oauth/vscode/login`
		} else if (isDevelopment) {
			// 开发环境默认使用本地地址
			this.API_BASE_URL = `${devBaseUrl}/api`
			this.AUTH_PAGE_URL = `${devBaseUrl}/oauth/vscode/login`
		} else {
			// 生产环境
			this.API_BASE_URL = "https://vvcode.top/api"
			this.AUTH_PAGE_URL = "https://vvcode.top/oauth/vscode/login"
		}

		this._provider = new VVAuthProvider(this.API_BASE_URL)
	}

	private requireController(): Controller {
		if (!this._controller) {
			throw new Error("Controller has not been initialized")
		}
		return this._controller
	}

	/**
	 * 初始化单例
	 */
	public static initialize(controller: Controller): VVAuthService {
		if (!VVAuthService.instance) {
			VVAuthService.instance = new VVAuthService()
		}
		VVAuthService.instance._controller = controller

		// 如果用户已登录，主动获取分组配置
		VVAuthService.instance.initGroupConfigIfAuthenticated()

		return VVAuthService.instance
	}

	/**
	 * 获取单例实例
	 */
	public static getInstance(): VVAuthService {
		if (!VVAuthService.instance || !VVAuthService.instance._controller) {
			throw new Error("VVAuthService not initialized. Call VVAuthService.initialize(controller) first.")
		}
		return VVAuthService.instance
	}

	/**
	 * 获取当前认证状态
	 */
	public getInfo(): VVAuthState {
		const controller = this.requireController()
		const user = controller.stateManager.getGlobalStateKey("vvUserInfo")

		return {
			user: user || undefined,
		}
	}

	/**
	 * 是否已认证
	 */
	public get isAuthenticated(): boolean {
		const controller = this.requireController()
		const accessToken = controller.stateManager.getSecretKey("vv:accessToken")
		return !!accessToken
	}

	/**
	 * 初始化时检查登录状态并获取分组配置
	 */
	private async initGroupConfigIfAuthenticated(): Promise<void> {
		if (!this.isAuthenticated) {
			return
		}

		try {
			await this.refreshGroupConfig()
			console.log("[VVAuth] Group config initialized on startup")
		} catch (error) {
			console.warn("[VVAuth] Failed to init group config on startup:", error)
		}
	}

	/**
	 * 创建登录请求（打开浏览器）
	 */
	public async createAuthRequest(): Promise<string> {
		const controller = this.requireController()

		// 1. 生成 PKCE 参数
		const state = generateState()
		const codeVerifier = generateCodeVerifier()
		const codeChallenge = generateCodeChallenge(codeVerifier)

		// 2. 保存到 GlobalState（临时使用，因为 Secrets 可能在扩展重载时丢失）
		controller.stateManager.setGlobalState("vv:authState", state)
		controller.stateManager.setGlobalState("vv:codeVerifier", codeVerifier)

		// 3. 强制立即持久化到磁盘
		await controller.stateManager.flushPendingState()

		// 4. 验证保存成功
		const savedState = controller.stateManager.getGlobalStateKey("vv:authState")
		const savedVerifier = controller.stateManager.getGlobalStateKey("vv:codeVerifier")

		if (!savedState || !savedVerifier) {
			throw new Error("Failed to save authentication state. Please try again.")
		}

		// 5. 构建回调 URI
		const callbackUri = `vscode://${this.PUBLISHER}.${this.EXTENSION_ID}/vv-callback`

		// 6. 构建授权 URL
		const authUrl = new URL(this.AUTH_PAGE_URL)
		authUrl.searchParams.set("state", state)
		authUrl.searchParams.set("code_challenge", codeChallenge)
		authUrl.searchParams.set("redirect_uri", callbackUri)

		// 7. 打开浏览器
		await openExternal(authUrl.toString())

		return authUrl.toString()
	}

	/**
	 * 处理认证回调
	 * @param code 授权码
	 * @param state CSRF 防护 state
	 */
	public async handleAuthCallback(code: string, state: string): Promise<void> {
		const controller = this.requireController()

		// 防止重复处理同一个授权码
		if (this._processingAuthCallback) {
			return
		}

		if (this._lastProcessedCode === code) {
			return
		}

		this._processingAuthCallback = true

		try {
			// 1. 验证 state（优先从 StateManager 读取，fallback 到直接读取 context）
			let storedState = controller.stateManager.getGlobalStateKey("vv:authState")

			// 如果 StateManager 缓存中没有，尝试直接从 context 读取
			if (!storedState) {
				storedState = controller.context.globalState.get<string>("vv:authState")
			}

			if (!storedState) {
				throw new Error(
					"Authentication state not found. This may happen if the extension was reloaded. Please try logging in again.",
				)
			}

			if (state !== storedState) {
				throw new Error("Invalid state parameter - possible CSRF attack")
			}

			// 2. 获取 code_verifier
			let codeVerifier = controller.stateManager.getGlobalStateKey("vv:codeVerifier")
			if (!codeVerifier) {
				codeVerifier = controller.context.globalState.get<string>("vv:codeVerifier")
			}
			if (!codeVerifier) {
				throw new Error("Code verifier not found. Please try logging in again.")
			}

			// 3. 使用 code 交换 access_token
			const authInfo: VVAuthInfo = await this._provider.exchangeCodeForToken(code, codeVerifier, state)

			// 4. 存储 access_token 和 user_id
			controller.stateManager.setSecret("vv:accessToken", authInfo.accessToken)
			controller.stateManager.setSecret("vv:userId", authInfo.userId.toString())

			// 5. 获取用户详细信息
			const userInfo = await this._provider.getUserInfo(authInfo.accessToken, authInfo.userId)
			controller.stateManager.setGlobalState("vvUserInfo", userInfo)

			// 6. 获取用户配置（可选）
			try {
				const userConfig = await this._provider.getUserConfig(authInfo.accessToken, authInfo.userId)
				controller.stateManager.setGlobalState("vvUserConfig", userConfig)
			} catch (error) {
				console.warn("[VVAuth] Failed to fetch user config:", error)
			}

			// 7. 获取分组配置并自动应用默认分组
			try {
				const groupConfig = await this._provider.getGroupTokens(authInfo.accessToken, authInfo.userId)
				controller.stateManager.setGlobalState("vvGroupConfig", groupConfig)

				// 自动应用默认分组的 API Key
				const defaultGroup = groupConfig.find((g) => g.isDefault)
				if (defaultGroup && defaultGroup.apiKey) {
					await this.applyGroupConfig(defaultGroup)
				}
			} catch (error) {
				console.warn("[VVAuth] Failed to fetch group config:", error)
			}

			// 8. 立即持久化用户数据
			await controller.stateManager.flushPendingState()

			// 9. 清理临时存储
			controller.stateManager.setGlobalState("vv:authState", undefined)
			controller.stateManager.setGlobalState("vv:codeVerifier", undefined)
			await controller.stateManager.flushPendingState()

			// 10. 记录已处理的授权码
			this._lastProcessedCode = code

			// 11. 更新认证状态并广播
			this._authenticated = true
			this.sendAuthStatusUpdate()
		} catch (error) {
			// 清理临时存储
			controller.stateManager.setGlobalState("vv:authState", undefined)
			controller.stateManager.setGlobalState("vv:codeVerifier", undefined)
			await controller.stateManager.flushPendingState()

			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.includes("Too Many Requests") || errorMessage.includes("429")) {
				throw new Error("Authentication rate limit exceeded. Please wait a moment and try logging in again.")
			}

			throw new Error(`Authentication failed: ${errorMessage}`)
		} finally {
			this._processingAuthCallback = false
		}
	}

	/**
	 * 登出
	 */
	public async handleDeauth(): Promise<void> {
		const controller = this.requireController()

		// 1. 获取当前 token
		const accessToken = controller.stateManager.getSecretKey("vv:accessToken")

		// 2. 调用登出 API（撤销令牌）
		if (accessToken) {
			try {
				await this._provider.logout(accessToken)
			} catch (error) {
				console.warn("Logout API call failed:", error)
			}
		}

		// 3. 清除所有本地存储
		controller.stateManager.setSecret("vv:accessToken", undefined)
		controller.stateManager.setSecret("vv:refreshToken", undefined)
		controller.stateManager.setGlobalState("vvUserInfo", undefined)
		controller.stateManager.setGlobalState("vvUserConfig", undefined)

		// 4. 清理临时存储（globalState 中的临时认证数据）
		controller.stateManager.setGlobalState("vv:authState", undefined)
		controller.stateManager.setGlobalState("vv:codeVerifier", undefined)

		// 5. 立即持久化所有清理操作
		await controller.stateManager.flushPendingState()

		// 6. 更新认证状态
		this._authenticated = false

		// 7. 广播状态更新
		this.sendAuthStatusUpdate()
	}

	/**
	 * 订阅认证状态更新
	 */
	public subscribeToAuthStatusUpdate(
		controller: Controller,
		_request: any,
		responseStream: StreamingResponseHandler<VVAuthState>,
	): () => void {
		const subscription = { controller, responseStream }
		this._activeAuthStatusUpdateSubscriptions.add(subscription)

		// 立即发送当前状态
		responseStream(this.getInfo(), false).catch((error) => {
			console.error("Failed to send initial auth status:", error)
		})

		// 返回取消订阅函数
		return () => {
			this._activeAuthStatusUpdateSubscriptions.delete(subscription)
		}
	}

	/**
	 * 广播认证状态更新
	 */
	private sendAuthStatusUpdate(): void {
		const authState = this.getInfo()

		for (const subscription of this._activeAuthStatusUpdateSubscriptions) {
			try {
				subscription.responseStream(authState, false).catch((error) => {
					console.error("Failed to send auth status update:", error)
					this._activeAuthStatusUpdateSubscriptions.delete(subscription)
				})
			} catch (error) {
				console.error("Failed to send auth status update:", error)
				this._activeAuthStatusUpdateSubscriptions.delete(subscription)
			}
		}
	}

	/**
	 * 获取访问令牌
	 */
	public getAccessToken(): string | undefined {
		const controller = this.requireController()
		return controller.stateManager.getSecretKey("vv:accessToken")
	}

	/**
	 * 获取用户信息
	 */
	public getUserInfo(): VVUserInfo | undefined {
		const controller = this.requireController()
		return controller.stateManager.getGlobalStateKey("vvUserInfo")
	}

	/**
	 * 获取用户配置
	 */
	public getUserConfig(): VVUserConfig | undefined {
		const controller = this.requireController()
		return controller.stateManager.getGlobalStateKey("vvUserConfig")
	}

	/**
	 * 获取分组配置
	 */
	public getGroupConfig(): VVGroupConfig | undefined {
		const controller = this.requireController()
		return controller.stateManager.getGlobalStateKey("vvGroupConfig")
	}

	/**
	 * 切换分组
	 * @param groupType 分组类型（discount、daily、performance）
	 */
	public async switchGroup(groupType: string): Promise<void> {
		const controller = this.requireController()
		const groupConfig = controller.stateManager.getGlobalStateKey("vvGroupConfig")

		if (!groupConfig) {
			throw new Error("Group config not found. Please login first.")
		}

		const targetGroup = groupConfig.find((g) => g.type === groupType)
		if (!targetGroup) {
			throw new Error(`Group "${groupType}" not found`)
		}

		if (!targetGroup.apiKey) {
			throw new Error(`Group "${groupType}" has no API key configured. Please configure it first.`)
		}

		// 更新 isDefault 标记
		const updatedConfig = groupConfig.map((g) => ({
			...g,
			isDefault: g.type === groupType,
		}))
		controller.stateManager.setGlobalState("vvGroupConfig", updatedConfig)

		// 应用分组配置
		await this.applyGroupConfig(targetGroup)

		// 持久化并广播状态更新
		await controller.stateManager.flushPendingState()
		this.sendAuthStatusUpdate()
	}

	/**
	 * 应用分组配置到 API 设置
	 * @param group 分组配置
	 */
	private async applyGroupConfig(group: VVGroupItem): Promise<void> {
		const controller = this.requireController()
		const isDev = process.env.IS_DEV === "true"
		const devBaseUrl = process.env.DEV_BASE_URL || "http://127.0.0.1:3000"

		// 设置 Anthropic API Key
		controller.stateManager.setSecret("apiKey", group.apiKey)

		// 设置默认模型（Plan 和 Act 模式都使用相同的模型）
		controller.stateManager.setGlobalState("planModeApiModelId", group.defaultModelId)
		controller.stateManager.setGlobalState("actModeApiModelId", group.defaultModelId)

		// 设置 baseUrl（开发环境强制使用本地地址）
		const baseUrl = isDev ? devBaseUrl : group.apiBaseUrl
		if (baseUrl) {
			controller.stateManager.setGlobalState("anthropicBaseUrl", baseUrl)
		}

		// 立即刷新状态确保生效
		await controller.stateManager.flushPendingState()
	}

	/**
	 * 刷新分组配置
	 */
	public async refreshGroupConfig(): Promise<VVGroupConfig | undefined> {
		const controller = this.requireController()
		const accessToken = controller.stateManager.getSecretKey("vv:accessToken")
		const userId = controller.stateManager.getSecretKey("vv:userId")

		if (!accessToken || !userId) {
			return undefined
		}

		try {
			const groupConfig = await this._provider.getGroupTokens(accessToken, parseInt(userId, 10))
			controller.stateManager.setGlobalState("vvGroupConfig", groupConfig)
			await controller.stateManager.flushPendingState()
			return groupConfig
		} catch (error) {
			console.error("[VVAuth] Failed to refresh group config:", error)
			return undefined
		}
	}
}

/**
 * VVCode 认证状态
 */
export interface VVAuthState {
	user?: VVUserInfo
}
