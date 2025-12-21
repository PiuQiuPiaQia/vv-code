// VVCode Customization: 分组切换选择器组件
// Created: 2025-12-21

import { String as ProtoString } from "@shared/proto/cline/common"
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react"
import { useCallback, useState } from "react"
import styled from "styled-components"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { VVAccountServiceClient } from "@/services/grpc-client"

// VVCode 创建 Token 页面地址
const VV_CREATE_TOKEN_URL = "https://vvcode.top/console/start"

const GroupContainer = styled.div`
	display: flex;
	align-items: center;
	margin-left: auto;
	position: relative;
`

const GroupButton = styled.button<{ $isOpen?: boolean; $needSetup?: boolean }>`
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 2px 6px;
	border: none;
	background: transparent;
	color: ${({ $needSetup }) => ($needSetup ? "var(--vscode-charts-orange)" : "var(--vscode-descriptionForeground)")};
	font-size: 11px;
	cursor: pointer;
	border-radius: 3px;
	transition: all 0.15s ease;

	&:hover {
		background: var(--vscode-toolbar-hoverBackground);
		color: ${({ $needSetup }) => ($needSetup ? "var(--vscode-charts-orange)" : "var(--vscode-foreground)")};
	}

	${({ $isOpen }) =>
		$isOpen &&
		`
		background: var(--vscode-toolbar-hoverBackground);
		color: var(--vscode-foreground);
	`}
`

const GroupDropdown = styled.div`
	position: absolute;
	bottom: 100%;
	right: 0;
	margin-bottom: 4px;
	background: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-dropdown-border);
	border-radius: 4px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	min-width: 120px;
	z-index: 1000;
	overflow: hidden;
`

const GroupOption = styled.button<{ $isActive?: boolean }>`
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	padding: 6px 10px;
	border: none;
	background: ${({ $isActive }) => ($isActive ? "var(--vscode-list-activeSelectionBackground)" : "transparent")};
	color: ${({ $isActive }) => ($isActive ? "var(--vscode-list-activeSelectionForeground)" : "var(--vscode-dropdown-foreground)")};
	font-size: 12px;
	cursor: pointer;
	text-align: left;

	&:hover {
		background: var(--vscode-list-hoverBackground);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`

const GroupLabel = styled.span`
	flex: 1;
`

const ActiveIndicator = styled.span`
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--vscode-charts-green);
	margin-left: 8px;
`

const SetupLink = styled.a`
	display: flex;
	align-items: center;
	gap: 4px;
	width: 100%;
	padding: 8px 10px;
	border: none;
	background: transparent;
	color: var(--vscode-textLink-foreground);
	font-size: 12px;
	cursor: pointer;
	text-decoration: none;

	&:hover {
		background: var(--vscode-list-hoverBackground);
		text-decoration: underline;
	}
`

interface VVGroupSelectorProps {
	className?: string
}

export function VVGroupSelector({ className }: VVGroupSelectorProps) {
	const { vvGroupConfig } = useExtensionState()
	const [isOpen, setIsOpen] = useState(false)
	const [isSwitching, setIsSwitching] = useState(false)

	const currentGroup = vvGroupConfig?.find((g) => g.isDefault)
	const hasApiKey = vvGroupConfig?.some((g) => g.apiKey) ?? false

	const handleSwitchGroup = useCallback(
		async (groupType: string) => {
			if (isSwitching) return

			setIsSwitching(true)
			setIsOpen(false)

			try {
				await VVAccountServiceClient.vvSwitchGroup(ProtoString.create({ value: groupType }))
			} catch (error) {
				console.error("Failed to switch group:", error)
			} finally {
				setIsSwitching(false)
			}
		},
		[isSwitching],
	)

	// 如果没有分组配置，不显示
	if (!vvGroupConfig || vvGroupConfig.length === 0) {
		return null
	}

	// 没有 apiKey 时，显示引导去创建
	if (!hasApiKey) {
		return (
			<GroupContainer className={className}>
				<Tooltip>
					<TooltipContent>点击创建 API Token</TooltipContent>
					<TooltipTrigger>
						<GroupButton $needSetup as="a" href={VV_CREATE_TOKEN_URL} target="_blank">
							<span>创建 Token</span>
							<ExternalLinkIcon size={10} />
						</GroupButton>
					</TooltipTrigger>
				</Tooltip>
			</GroupContainer>
		)
	}

	return (
		<GroupContainer className={className}>
			<Tooltip>
				<TooltipContent>切换分组</TooltipContent>
				<TooltipTrigger>
					<GroupButton $isOpen={isOpen} disabled={isSwitching} onClick={() => setIsOpen(!isOpen)}>
						<span>{currentGroup?.name || "选择分组"}</span>
						<ChevronDownIcon size={12} />
					</GroupButton>
				</TooltipTrigger>
			</Tooltip>

			{isOpen && (
				<GroupDropdown>
					{vvGroupConfig.map((group) => (
						<GroupOption
							$isActive={group.isDefault}
							disabled={!group.apiKey || isSwitching}
							key={group.type}
							onClick={() => handleSwitchGroup(group.type)}>
							<GroupLabel>{group.name}</GroupLabel>
							{group.isDefault && <ActiveIndicator />}
						</GroupOption>
					))}
				</GroupDropdown>
			)}
		</GroupContainer>
	)
}
