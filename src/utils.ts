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
			console.error(
				`OneInch Error: ${JSON.stringify(
					{
						code: error?.lastError?.code,
						message: error?.lastError?.message,
						response: error?.lastError?.response?.data
					},
					null,
					1
				)}`
			)

			return true
		}
	})
}
