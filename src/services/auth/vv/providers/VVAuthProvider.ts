// VVCode Customization: VVCode 认证提供商
// Created: 2025-12-20

import { fetch } from "@/shared/net"
import type { VVGroupConfig, VVUserConfig, VVUserInfo } from "@/shared/storage/state-keys"

/**
 * VVCode 认证提供商
 * 负责与 vvcode.top API 通信，处理 OAuth2 + PKCE 认证流程
 */
export class VVAuthProvider {
	// API 基础 URL（可配置）
	private apiBaseUrl: string

	constructor(apiBaseUrl: string = "https://vvcode.top/api") {
		this.apiBaseUrl = apiBaseUrl
	}

	/**
	 * 使用授权码交换访问令牌
	 * @param code 授权码
	 * @param codeVerifier PKCE code_verifier
	 * @param state CSRF 防护 state
	 * @returns 认证信息
	 */
	async exchangeCodeForToken(code: string, codeVerifier: string, state: string): Promise<VVAuthInfo> {
		// 使用 form-urlencoded 格式（OAuth2 标准格式）
		const formData = new URLSearchParams()
		formData.append("code", code)
		formData.append("code_verifier", codeVerifier)
		formData.append("state", state)

		try {
			const response = await fetch(`${this.apiBaseUrl}/oauth/vscode/token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: formData.toString(),
			})

			if (!response.ok) {
				const errorText = await response.text()
				console.error("[VVAuth] Token exchange error response:", errorText)

				let errorData: any = {}
				try {
					errorData = JSON.parse(errorText)
				} catch {
					errorData = { error: errorText }
				}

				// 针对不同的 HTTP 状态码提供更友好的错误消息
				if (response.status === 429) {
					throw new Error(
						"Too Many Requests - " +
							"You may have refreshed the page or clicked the login button multiple times. " +
							"Please wait 30 seconds and try again.",
					)
				} else if (response.status === 400) {
					throw new Error(
						errorData.error_description ||
							errorData.error ||
							errorData.message ||
							"Invalid authorization code - it may have expired or been used already. Please try logging in again.",
					)
				} else if (response.status === 401) {
					throw new Error(errorData.error || "Authentication failed - please try logging in again")
				}

				throw new Error(
					`Token exchange failed: ${errorData.error_description || errorData.error || errorData.message || response.statusText}`,
				)
			}

			const data = await response.json()

			return {
				accessToken: data.access_token,
				userId: data.user_id,
				username: data.username,
				displayName: data.display_name,
				role: data.role,
				expiresIn: data.expires_in,
			}
		} catch (error) {
			// 如果错误已经是我们抛出的友好错误，直接抛出
			if (error instanceof Error) {
				throw error
			}
			// 网络错误或其他未预期的错误
			throw new Error(`Network error during token exchange: ${String(error)}`)
		}
	}

	/**
	 * 获取用户详细信息
	 * @param accessToken 访问令牌
	 * @param userId 用户 ID（需要在请求头中传递）
	 * @returns 用户信息
	 */
	async getUserInfo(accessToken: string, userId: number): Promise<VVUserInfo> {
		const response = await fetch(`${this.apiBaseUrl}/user/self`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"New-Api-User": userId.toString(),
			},
		})

		if (!response.ok) {
			throw new Error(`Failed to get user info: ${response.statusText}`)
		}

		const result = await response.json()
		const user = result.data

		return {
			uid: user.id.toString(),
			username: user.username,
			email: user.email,
			avatarUrl: user.avatar_url,
			createdAt: user.created_time,
			quota: user.quota,
			usedQuota: user.used_quota,
			vipLevel: user.role, // 使用 role 作为 VIP 等级
		}
	}

	/**
	 * 刷新访问令牌（如果后端支持）
	 * @param refreshToken 刷新令牌
	 * @returns 新的认证信息
	 */
	async refreshAccessToken(refreshToken: string): Promise<VVAuthInfo> {
		const response = await fetch(`${this.apiBaseUrl}/oauth/vscode/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				refresh_token: refreshToken,
			}),
		})

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}))
			throw new Error(`Token refresh failed: ${errorData.error || response.statusText}`)
		}

		const data = await response.json()
		return {
			accessToken: data.access_token,
			userId: data.user_id,
			username: data.username,
			expiresIn: data.expires_in,
		}
	}

	/**
	 * 获取用户配置
	 * @param accessToken 访问令牌
	 * @param userId 用户 ID
	 * @returns 用户配置
	 */
	async getUserConfig(accessToken: string, userId: number): Promise<VVUserConfig> {
		const response = await fetch(`${this.apiBaseUrl}/user/config`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"New-Api-User": userId.toString(),
			},
		})

		if (!response.ok) {
			// 配置接口可能不存在，返回空配置
			return {}
		}

		const data = await response.json()

		// 将对象格式的 settings 转换为数组格式
		const settingsArray = data.settings
			? Object.entries(data.settings).map(([key, value]) => ({
					key,
					value: String(value),
				}))
			: []

		return {
			settings: settingsArray,
			features: data.features || [],
			apiBaseUrl: data.api_base_url,
		}
	}

	/**
	 * 登出（撤销令牌）
	 * @param accessToken 访问令牌
	 */
	async logout(accessToken: string): Promise<void> {
		try {
			await fetch(`${this.apiBaseUrl}/oauth/vscode/logout`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			})
		} catch (error) {
			// 登出失败不阻塞流程
			console.error("Logout API call failed:", error)
		}
	}

	/**
	 * 获取分组 Token 配置
	 * @param accessToken 访问令牌
	 * @param userId 用户 ID
	 * @returns 分组配置列表
	 */
	async getGroupTokens(accessToken: string, userId: number): Promise<VVGroupConfig> {
		const response = await fetch(`${this.apiBaseUrl}/oauth/vscode/group_tokens`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"New-Api-User": userId.toString(),
			},
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Failed to get group tokens: ${errorText}`)
		}

		const result = await response.json()

		console.log("getGroupTokens", result)
		if (!result.success) {
			throw new Error(result.message || "Failed to get group tokens")
		}

		return result.data as VVGroupConfig
	}

	/**
	 * 初始化分组 Token（如果分组没有 apiKey 则调用此接口）
	 * @param accessToken 访问令牌
	 * @param userId 用户 ID
	 * @returns 初始化后的分组配置列表
	 */
	async initGroupTokens(accessToken: string, userId: number): Promise<VVGroupConfig> {
		const response = await fetch(`${this.apiBaseUrl}/oauth/vscode/init_group_tokens`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"New-Api-User": userId.toString(),
				"Content-Type": "application/json",
			},
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Failed to init group tokens: ${errorText}`)
		}

		const result = await response.json()
		if (!result.success) {
			throw new Error(result.message || "Failed to init group tokens")
		}

		return result.data as VVGroupConfig
	}
}

/**
 * VVCode 认证信息
 */
export interface VVAuthInfo {
	accessToken: string
	userId: number
	username: string
	displayName?: string
	role?: number
	expiresIn?: number
}
