// VVCode Customization: 修改导航栏，添加 VV 设置入口，保留原有 settings 入口
// Original: Navbar.tsx
// Modified: 2025-12-20

import { HistoryIcon, PlusIcon, SettingsIcon, SlidersHorizontal } from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TaskServiceClient } from "@/services/grpc-client"
import { useExtensionState } from "../../context/ExtensionStateContext"

// Custom MCP Server Icon component using VSCode codicon
const McpServerIcon = ({ className, size }: { className?: string; size?: number }) => (
	<span
		className={`codicon codicon-server flex items-center ${className || ""}`}
		style={{ fontSize: size ? `${size}px` : "12.5px", marginBottom: "1px" }}
	/>
)

export const Navbar = () => {
	const { navigateToHistory, navigateToVVSettings, navigateToSettings, navigateToMcp, navigateToChat } = useExtensionState()

	const SETTINGS_TABS = useMemo(
		() => [
			{
				id: "chat",
				name: "Chat",
				tooltip: "New Task",
				icon: PlusIcon,
				navigate: () => {
					// Close the current task, then navigate to the chat view
					TaskServiceClient.clearTask({})
						.catch((error) => {
							console.error("Failed to clear task:", error)
						})
						.finally(() => navigateToChat())
				},
			},
			{
				id: "mcp",
				name: "MCP",
				tooltip: "MCP Servers",
				icon: McpServerIcon,
				navigate: navigateToMcp,
			},
			{
				id: "history",
				name: "History",
				tooltip: "History",
				icon: HistoryIcon,
				navigate: navigateToHistory,
			},
			// VVCode Customization: VV 设置入口
			{
				id: "vv-settings",
				name: "VV Settings",
				tooltip: "VV 设置",
				icon: SettingsIcon,
				navigate: navigateToVVSettings,
			},
			// Cline 原有设置入口
			{
				id: "settings",
				name: "Settings",
				tooltip: "Cline Settings",
				icon: SlidersHorizontal,
				navigate: navigateToSettings,
			},
		],
		[navigateToChat, navigateToHistory, navigateToMcp, navigateToVVSettings, navigateToSettings],
	)

	return (
		<nav
			className="flex-none inline-flex justify-end bg-transparent gap-2 mb-1 z-10 border-none items-center mr-4!"
			id="cline-navbar-container">
			{SETTINGS_TABS.map((tab) => (
				<Tooltip key={`navbar-tooltip-${tab.id}`}>
					<TooltipContent side="bottom">{tab.tooltip}</TooltipContent>
					<TooltipTrigger asChild>
						<Button
							aria-label={tab.tooltip}
							className="p-0 h-7"
							data-testid={`tab-${tab.id}`}
							key={`navbar-button-${tab.id}`}
							onClick={() => tab.navigate()}
							size="icon"
							variant="icon">
							<tab.icon className="stroke-1 [svg]:size-4" size={18} />
						</Button>
					</TooltipTrigger>
				</Tooltip>
			))}
		</nav>
	)
}
