/**
 * Dynamic Configuration Fetcher
 *
 * Fetches runtime configuration from a remote endpoint.
 * IMPORTANT: No local fallback values - all configuration must come from API.
 */

import axios from "axios"
import { getAxiosSettings } from "@/shared/net"
import { CONFIG_ENDPOINT, CONFIG_FETCH_TIMEOUT } from "./config"

/**
 * Configuration response schema from the remote API
 */
interface DynamicConfigResponse {
	anthropic?: {
		apiKey?: string
		baseUrl?: string
	}
	// You can add other providers here in the future
}

/**
 * Resolved configuration that will be used by the application
 */
export interface ResolvedConfig {
	anthropic: {
		apiKey: string | undefined
		baseUrl: string | undefined
	}
}

/**
 * In-memory cache for the fetched configuration
 */
let cachedConfig: ResolvedConfig | null = null

/**
 * Fetches dynamic configuration from the remote endpoint
 *
 * @returns Promise<ResolvedConfig> The resolved configuration
 */
async function fetchRemoteConfig(): Promise<DynamicConfigResponse | null> {
	try {
		const response = await axios.get<DynamicConfigResponse>(CONFIG_ENDPOINT, {
			timeout: CONFIG_FETCH_TIMEOUT,
			...getAxiosSettings(),
		})

		if (response.status === 200 && response.data) {
			console.log("[Config Fetcher] Successfully fetched remote configuration")
			return response.data
		}

		console.warn("[Config Fetcher] Invalid response from config endpoint")
		return null
	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.warn(`[Config Fetcher] Failed to fetch remote config: ${error.message}`)
		} else {
			console.warn("[Config Fetcher] Unexpected error fetching remote config:", error)
		}
		return null
	}
}

/**
 * Resolves the final configuration from remote config (no local fallback)
 *
 * @param remoteConfig The configuration fetched from remote endpoint
 * @returns ResolvedConfig The configuration (values may be undefined if not provided by API)
 */
function resolveConfig(remoteConfig: DynamicConfigResponse | null): ResolvedConfig {
	return {
		anthropic: {
			apiKey: remoteConfig?.anthropic?.apiKey,
			baseUrl: remoteConfig?.anthropic?.baseUrl,
		},
	}
}

/**
 * Gets the dynamic configuration with caching
 *
 * On first call, fetches from remote endpoint and caches the result.
 * Subsequent calls return the cached configuration.
 * NOTE: No local fallback - if API fails, values will be undefined.
 *
 * @param forceRefresh If true, bypasses cache and fetches fresh config
 * @returns Promise<ResolvedConfig> The resolved configuration
 */
export async function getDynamicConfig(forceRefresh = false): Promise<ResolvedConfig> {
	// Return cached config if available and not forcing refresh
	if (cachedConfig && !forceRefresh) {
		return cachedConfig
	}

	// Fetch remote config
	const remoteConfig = await fetchRemoteConfig()

	// Resolve and cache the configuration (no fallback)
	cachedConfig = resolveConfig(remoteConfig)

	return cachedConfig
}

/**
 * Gets the configuration synchronously from cache
 *
 * Returns null if config hasn't been fetched yet.
 * Use this only after ensuring getDynamicConfig() has been called.
 *
 * @returns ResolvedConfig | null The cached configuration or null
 */
export function getCachedConfig(): ResolvedConfig | null {
	return cachedConfig
}

/**
 * Clears the cached configuration
 * Next call to getDynamicConfig() will fetch fresh config
 */
export function clearConfigCache(): void {
	cachedConfig = null
}
