import { isAxiosError } from "axios"
import { retry } from "ts-retry-promise"

export function sleep(duration: number) {
	return new Promise(res => setTimeout(res, duration))
}

export async function infinitely<T>(thunk: () => Promise<T>): Promise<T> {
	return retry(thunk, {
		timeout: "INFINITELY",
		retries: "INFINITELY",
		delay: 3_000,
		retryIf: error => {
			logErr(error)
			return true
		}
	})
}

export function logErr(error: any) {
	if (isAxiosError(error)) {
		console.error(
			`Http request Error: ${JSON.stringify(
				{
					code: error?.code,
					message: error?.message,
					response: error?.response?.data
				},
				null,
				1
			)}`
		)
	} else if (error?.lastError && isAxiosError(error.lastError)) {
		console.error(
			`Http request Error: ${JSON.stringify(
				{
					code: error.lastError?.code,
					message: error.lastError?.message,
					response: error.lastError?.response?.data
				},
				null,
				1
			)}`
		)
	} else if (error?.details) {
		console.error(
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
	} else {
		console.error(error)
	}
}
