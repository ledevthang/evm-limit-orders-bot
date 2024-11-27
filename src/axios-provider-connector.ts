import type { Headers, HttpProviderConnector } from "@1inch/limit-order-sdk"
import axios from "axios"
import { DateTime } from "luxon"
import { retry } from "ts-retry-promise"
import type { Address } from "viem"
import { sleep } from "./utils.js"

export class OneInchClient implements HttpProviderConnector {
	constructor(private oneInchApi: string) {}

	private lastimeCalling = DateTime.now()
	private restTimeInMiliSeconds = 3000

	async get<T>(url: string, headers: Headers) {
		console.log("get url: ", url)
		console.log("get headers: ", headers)

		return this.handleLimitRequest(async () => {
			const response = await axios.get<T>(url, {
				headers
			})
			return response.data
		})
	}

	async post<T>(url: string, data: unknown, headers: Headers) {
		console.log("post url: ", url)
		console.log("post headers: ", headers)
		return this.handleLimitRequest(async () => {
			const response = await axios.post<T>(url, data, {
				headers
			})
			return response.data
		})
	}

	async spotPrice<T extends Address>(chainId: number, address: T[]) {
		return this.handleLimitRequest(async () => {
			const response = await axios.get<Record<T, string>>(
				`https://api.1inch.dev/price/v1.1/${chainId}/${address}?currency=USD`,
				{
					headers: {
						Authorization: `Bearer ${this.oneInchApi}`,
						accept: "application/json"
					}
				}
			)
			return response.data
		})
	}

	private async handleLimitRequest<T>(thunk: () => Promise<T>): Promise<T> {
		while (
			DateTime.now().toSeconds() - this.lastimeCalling.toSeconds() >
			this.restTimeInMiliSeconds
		)
			await sleep(1000)

		this.lastimeCalling = DateTime.now()

		const result = await retry(thunk, {
			retries: 6,
			delay: 1500,
			timeout: "INFINITELY"
		})

		await sleep(this.restTimeInMiliSeconds)

		return result
	}
}
