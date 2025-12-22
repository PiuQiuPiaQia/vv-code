/**
 * Configuration endpoints and settings
 */

const isDev = process.env.IS_DEV === "true"

/**
 * API base URL
 * 开发环境从 DEV_BASE_URL 环境变量获取，生产环境使用线上地址
 */
export const API_BASE_URL = isDev ? process.env.DEV_BASE_URL || "http://127.0.0.1:3000" : "https://vvcode.top"

/**
 * Configuration API endpoint
 */
export const CONFIG_ENDPOINT = `${API_BASE_URL}/api`

/**
 * Configuration fetch timeout (in milliseconds)
 */
export const CONFIG_FETCH_TIMEOUT = 5000
