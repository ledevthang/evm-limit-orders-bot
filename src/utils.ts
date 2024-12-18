import { isAxiosError } from "axios"
import { retry } from "ts-retry-promise"
import { Logger } from "./logger"

export function sleep(duration: number) {
	return new Promise(res => setTimeout(res, duration))
}

// The maximum is exclusive and the minimum is inclusive
export function random(min: number, max: number) {
	return Math.random() * (max - min) + min
}

export async function infinitely<T>(thunk: () => Promise<T>): Promise<T> {
	return retry(thunk, {
		timeout: "INFINITELY",
		retries: "INFINITELY",
		delay: 3_000,
		retryIf: error => {
			logErr(error)
			return !isInsufficientError(error)
		}
	})
}

export function logErr(error: any) {
	if (isAxiosError(error))
		Logger.error(
			`Http request error: ${JSON.stringify(
				{
					code: error.code,
					message: error.message,
					response: error.response?.data
				},
				null,
				1
			)}`
		)
	else if (error.details) {
		Logger.error(
			`RPC request error: ${JSON.stringify(
				{
					code: error?.code,
					name: error?.name,
					details: error?.details
				},
				null,
				1
			)}`
		)
	} else Logger.error(error)
}

function isInsufficientError(error: any) {
	if (error?.details?.includes("gas required exceeds allowance")) return true

	if (error?.details?.includes("insufficient funds")) return true

	return false
}
