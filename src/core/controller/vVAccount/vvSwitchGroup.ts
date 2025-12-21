// VVCode Customization: 切换分组处理器
// Created: 2025-12-21

import { buildApiHandler } from "@core/api"
import { Empty, String as ProtoString } from "@shared/proto/cline/common"
import { VVAuthService } from "@/services/auth/vv/VVAuthService"
import { Controller } from "../index"

/**
 * 处理切换分组请求
 * @param controller Controller 实例
 * @param request 分组类型（discount、daily、performance）
 */
export async function vvSwitchGroup(controller: Controller, request: ProtoString): Promise<Empty> {
	const groupType = request.value
	if (!groupType) {
		throw new Error("Group type is required")
	}

	await VVAuthService.getInstance().switchGroup(groupType)

	// 重建 API handler 以使用新的 apiKey
	if (controller.task) {
		const apiConfig = controller.stateManager.getApiConfiguration()
		const currentMode = controller.stateManager.getGlobalSettingsKey("mode")
		controller.task.api = buildApiHandler({ ...apiConfig, ulid: controller.task.ulid }, currentMode)
	}

	await controller.postStateToWebview()

	return Empty.create()
}
