import type { Headers, HttpProviderConnector } from "@1inch/limit-order-sdk"
import axios from "axios"
import { DateTime } from "luxon"
import type { Address } from "viem"
import { sleep } from "./utils.js"

export class OneInchClient implements HttpProviderConnector {
	constructor(private oneInchApi: string) {}

	private lastFetch = 0
	private restTimeInMiliSeconds = 1500

	async get<T>(url: string, headers: Headers) {
		await this.waitForReady()

		const response = await axios.get<T>(url, {
			headers
		})
		return response.data
	}

	async post<T>(url: string, data: unknown, headers: Headers) {
		await this.waitForReady()

		const response = await axios.post<T>(url, data, {
			headers
		})
		return response.data
	}

	async spotPrice<T extends Address>(chainId: number, address: T[]) {
		await this.waitForReady()

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
	}

	private async waitForReady() {
		for (;;) {
			const now = DateTime.now().toMillis()

			if (now - this.lastFetch > this.restTimeInMiliSeconds) {
				this.lastFetch = DateTime.now().toMillis()

				return
			}

			await sleep(1000)
		}
	}
}
