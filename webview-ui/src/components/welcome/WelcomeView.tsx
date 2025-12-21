import { BooleanRequest, EmptyRequest } from "@shared/proto/cline/common"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { ExternalLinkIcon } from "lucide-react"
import { memo, useEffect, useState } from "react"
import ClineLogoWhite from "@/assets/ClineLogoWhite"
import ApiOptions from "@/components/settings/ApiOptions"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useVVAuth } from "@/hooks/useVVAuth"
import { AccountServiceClient, StateServiceClient } from "@/services/grpc-client"
import { validateApiConfiguration } from "@/utils/validate"

// VVCode 创建 Token 页面地址
const VV_CREATE_TOKEN_URL = "https://vvcode.top/console/start"

const WelcomeView = memo(() => {
	const { apiConfiguration, mode, vvGroupConfig } = useExtensionState()
	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [showApiOptions, setShowApiOptions] = useState(false)
	const [isLoading, setIsLoading] = useState(false)

	// VVCode Customization: 添加 VV 认证
	const { isAuthenticated: isVVAuthenticated, isLoggingIn: isVVLoggingIn, login: vvLogin } = useVVAuth()

	// VVCode: 检查是否有 apiKey
	const hasApiKey = vvGroupConfig?.some((g) => g.apiKey) ?? false

	const disableLetsGoButton = apiErrorMessage != null

	const handleLogin = () => {
		setIsLoading(true)
		AccountServiceClient.accountLoginClicked(EmptyRequest.create())
			.catch((err) => console.error("Failed to get login URL:", err))
			.finally(() => {
				setIsLoading(false)
			})
	}

	// VVCode Customization: VV 登录处理
	const handleVVLogin = () => {
		vvLogin()
	}

	const handleSubmit = async () => {
		try {
			await StateServiceClient.setWelcomeViewCompleted(BooleanRequest.create({ value: true }))
		} catch (error) {
			console.error("Failed to update API configuration or complete welcome view:", error)
		}
	}

	useEffect(() => {
		setApiErrorMessage(validateApiConfiguration(mode, apiConfiguration))
	}, [apiConfiguration, mode])

	// VVCode Customization: 如果已登录 VV 且有 apiKey，自动完成欢迎流程
	useEffect(() => {
		if (isVVAuthenticated && hasApiKey) {
			handleSubmit()
		}
	}, [isVVAuthenticated, hasApiKey])

	return (
		<div className="fixed inset-0 p-0 flex flex-col">
			<div className="h-full px-5 overflow-auto flex flex-col gap-2.5">
				<h2 className="text-lg font-semibold">Hi, I'm Cline</h2>
				<div className="flex justify-center my-5">
					<ClineLogoWhite className="size-16" />
				</div>
				<p>
					I can do all kinds of tasks thanks to breakthroughs in{" "}
					<VSCodeLink className="inline" href="https://www.anthropic.com/claude/sonnet">
						Claude 4 Sonnet's
					</VSCodeLink>
					agentic coding capabilities and access to tools that let me create & edit files, explore complex projects, use
					a browser, and execute terminal commands <i>(with your permission, of course)</i>. I can even use MCP to
					create new tools and extend my own capabilities.
				</p>

				<p className="text-(--vscode-descriptionForeground)">
					Sign up for an account to get started for free, or use an API key that provides access to models like Claude
					Sonnet.
				</p>

				{/* VVCode Customization: 已登录但没有 apiKey，显示创建 Token 引导 */}
				{isVVAuthenticated && !hasApiKey && (
					<div className="mt-2 p-3 rounded border border-[var(--vscode-charts-orange)] bg-[var(--vscode-inputValidation-warningBackground)]">
						<p className="text-sm mb-2">您已登录 VVCode，但还没有创建 API Token。请点击下方按钮前往创建：</p>
						<VSCodeButton
							appearance="primary"
							className="w-full"
							onClick={() => window.open(VV_CREATE_TOKEN_URL, "_blank")}>
							<span className="flex items-center gap-1">
								创建 API Token
								<ExternalLinkIcon size={14} />
							</span>
						</VSCodeButton>
					</div>
				)}

				{/* VVCode Customization: VVCode 登录按钮 - 未登录时显示 */}
				{!isVVAuthenticated && (
					<VSCodeButton appearance="primary" className="w-full mt-1" disabled={isVVLoggingIn} onClick={handleVVLogin}>
						{isVVLoggingIn ? "正在跳转浏览器..." : "使用 VVCode 账号登录"}
						{isVVLoggingIn && (
							<span className="ml-1 animate-spin">
								<span className="codicon codicon-refresh"></span>
							</span>
						)}
					</VSCodeButton>
				)}

				<VSCodeButton appearance="secondary" className="w-full mt-1" disabled={isLoading} onClick={handleLogin}>
					Get Started for Free (Cline Official)
					{isLoading && (
						<span className="ml-1 animate-spin">
							<span className="codicon codicon-refresh"></span>
						</span>
					)}
				</VSCodeButton>

				{!showApiOptions && (
					<VSCodeButton
						appearance="secondary"
						className="mt-2.5 w-full"
						onClick={() => setShowApiOptions(!showApiOptions)}>
						Use your own API key
					</VSCodeButton>
				)}

				<div className="mt-4.5">
					{showApiOptions && (
						<div>
							<ApiOptions currentMode={mode} showModelOptions={false} />
							<VSCodeButton className="mt-0.75" disabled={disableLetsGoButton} onClick={handleSubmit}>
								Let's go!
							</VSCodeButton>
						</div>
					)}
				</div>
			</div>
		</div>
	)
})

export default WelcomeView
