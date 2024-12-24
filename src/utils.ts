import { isAxiosError } from "axios"
import { BaseError } from "viem"
import { Logger } from "./logger"

export function sleep(duration: number) {
	return new Promise(res => setTimeout(res, duration))
}

// The maximum is exclusive and the minimum is inclusive
export function random(min: number, max: number) {
	return Math.random() * (max - min) + min
}

export function logErr(error: any) {
	if (isAxiosError(error))
		Logger.error(
			`Oneinch request error: ${JSON.stringify(
				{
					code: error.code,
					message: error.message
				},
				null,
				1
			)}`
		)
	else if (error instanceof BaseError) {
		Logger.error(
			`RPC request error: ${JSON.stringify(
				{
					name: error.name,
					shortMessage: error?.shortMessage,
					details: error?.details
				},
				null,
				1
			)}`
		)
	} else Logger.error(error)
}

// function isInsufficientError(error: any) {
// 	if (error?.details?.includes("gas required exceeds allowance")) return true

// 	if (error?.details?.includes("insufficient funds")) return true

// 	return false
// }
