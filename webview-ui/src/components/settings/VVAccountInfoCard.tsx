// VVCode Customization: VVCode 账户信息卡片
// Created: 2025-12-20

import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { memo } from "react"
import { useVVAuth } from "@/hooks/useVVAuth"

const VVAccountInfoCard = memo(() => {
	const { user, isAuthenticated, ready, logout } = useVVAuth()

	if (!ready) {
		return (
			<div className="flex items-center gap-2 p-4 border border-input-border rounded bg-input-background">
				<span className="codicon codicon-loading codicon-modifier-spin"></span>
				<span>加载中...</span>
			</div>
		)
	}

	if (!isAuthenticated || !user) {
		return null
	}

	return (
		<div className="flex flex-col gap-3 p-4 border border-input-border rounded bg-input-background">
			<div className="flex items-start justify-between">
				<div className="flex flex-col gap-2">
					<div className="font-semibold text-base">
						你好，「{user.username || "用户"}」，我是 VVCode，你的 AI 编程助手，随时为你效劳 ✨
					</div>
				</div>
			</div>

			{/* 配额信息 */}
			{(user.quota !== undefined || user.usedQuota !== undefined) && (
				<div className="flex flex-col gap-1.5 pt-2 border-t border-input-border">
					<div className="text-sm font-medium">配额使用情况</div>
					<div className="flex items-center gap-2">
						<div className="flex-1 h-2 bg-(--vscode-editor-background) rounded-full overflow-hidden">
							<div
								className="h-full bg-(--vscode-button-background) transition-all duration-300"
								style={{
									width: `${Math.min(((user.usedQuota || 0) / (user.quota || 1)) * 100, 100)}%`,
								}}
							/>
						</div>
						<span className="text-xs text-(--vscode-descriptionForeground) whitespace-nowrap">
							{user.usedQuota || 0} / {user.quota || 0}
						</span>
					</div>
				</div>
			)}

			{/* 登出按钮 */}
			<VSCodeButton appearance="secondary" className="w-full" onClick={logout}>
				<span className="codicon codicon-sign-out mr-1.5"></span>
				退出登录
			</VSCodeButton>
		</div>
	)
})

export default VVAccountInfoCard
