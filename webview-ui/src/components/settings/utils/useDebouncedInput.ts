import { useEffect, useRef, useState } from "react"
import { useDebounceEffect } from "@/utils/useDebounceEffect"

/**
 * A custom hook that provides debounced input handling to prevent jumpy text inputs
 * when saving changes directly to backend on every keystroke.
 *
 * @param initialValue - The initial value for the input
 * @param onChange - Callback function to save the value (e.g., to backend)
 * @param debounceMs - Debounce delay in milliseconds (default: 500ms)
 * @returns A tuple of [currentValue, setValue] similar to useState
 */
export function useDebouncedInput<T>(
	initialValue: T,
	onChange: (value: T) => void,
	debounceMs: number = 100,
): [T, (value: T) => void] {
	// Local state to prevent jumpy input
	const [localValue, setLocalValue] = useState(initialValue)
	// Track the last known external value to detect external changes
	const lastExternalValueRef = useRef(initialValue)
	// Track if user has made changes
	const userChangedRef = useRef(false)

	// Sync with external value changes (e.g., when switching groups)
	useEffect(() => {
		if (initialValue !== lastExternalValueRef.current) {
			lastExternalValueRef.current = initialValue
			setLocalValue(initialValue)
			userChangedRef.current = false
		}
	}, [initialValue])

	// Wrapper to mark user edits
	const handleSetValue = (value: T) => {
		userChangedRef.current = true
		setLocalValue(value)
	}

	// Debounced backend save - only saves if user made changes
	useDebounceEffect(
		() => {
			// Only save if user changed the value AND it's different from external value
			if (userChangedRef.current && localValue !== lastExternalValueRef.current) {
				onChange(localValue)
			}
		},
		debounceMs,
		[localValue],
	)

	return [localValue, handleSetValue]
}
