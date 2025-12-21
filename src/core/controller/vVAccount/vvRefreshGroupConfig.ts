// VVCode Customization: 刷新分组配置处理器
// Created: 2025-12-21

import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { VVAuthService } from "@/services/auth/vv/VVAuthService"
import { Controller } from "../index"

/**
 * 处理刷新分组配置请求
 * @param controller Controller 实例
 */
export async function vvRefreshGroupConfig(controller: Controller, _request: EmptyRequest): Promise<Empty> {
	await VVAuthService.getInstance().refreshGroupConfig()
	await controller.postStateToWebview()

	return Empty.create()
}
