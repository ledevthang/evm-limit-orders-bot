import * as oninchsdk from "@1inch/limit-order-sdk"
import { DateTime } from "luxon"
import type { Address as EvmAddress, WalletClient } from "viem"
import { aggregatorAbi } from "./aggregator-abi"
import { OneInchClient } from "./axios-provider-connector"
import type { Config } from "./parse-config"
import { sleep } from "./utils"
import { AxiosProviderConnector } from "@1inch/limit-order-sdk/axios"

type OrderParams = {
	makerAsset: EvmAddress // in token
	takerAsset: EvmAddress // out token
	makingAmount: bigint
	takingAmount: bigint
}

type Order = {
	orderHash: EvmAddress
	makerTraits: bigint
	expiration: DateTime
}

export class Program {
	private makerTraits: oninchsdk.MakerTraits
	private sdk: oninchsdk.Api
	private oneinch: OneInchClient
	private currentOrders: Order[] = []

	constructor(
		private wallet: WalletClient,
		private config: Config
	) {
		const expiration = BigInt(Math.floor(Date.now() / 1000)) + this.config.orderExpiration

		this.makerTraits = oninchsdk.MakerTraits.default()
			.withExpiration(expiration)
			.allowPartialFills() // If you wish to allow partial fills
			.allowMultipleFills() // And assuming multiple fills are also okay

		this.oneinch = new OneInchClient(config.oneinchApiKey)

		this.sdk = new oninchsdk.Api({
			networkId: config.chain.id,
			authKey: config.oneinchApiKey,
			httpConnector: new AxiosProviderConnector()
		})
	}

	async run() {
		await this.createOrder({
			makerAsset: "0x63a72806098bd3d9520cc43356dd78afe5d386d9", // WAVAX
			takerAsset: "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", // DAI
			makingAmount: 100000000000000000n,
			takingAmount: 354591303896920600n
		})
		console.log("create ok")

		await sleep(3000)

		// console.log("currentOrders: ", this.currentOrders)

		// await this.clearOrders()

		// console.log("done")
	}

	private async createOrder(params: OrderParams) {
		try {
			const order = new oninchsdk.LimitOrder(
				{
					makerAsset: new oninchsdk.Address(params.makerAsset),
					takerAsset: new oninchsdk.Address(params.takerAsset),
					makingAmount: params.makingAmount,
					takingAmount: params.takingAmount,
					maker: new oninchsdk.Address(this.walletAddress()),
					receiver: new oninchsdk.Address(this.walletAddress()),
					salt: BigInt(Math.floor(Math.random() * 100_000_000))
				},
				this.makerTraits
			)

			console.log("order", order);

			const typedData = order.getTypedData(this.config.chain.id)
			typedData.domain.chainId = this.config.chain.id

			const signature = await this.wallet.signTypedData({
				domain: typedData.domain,
				types: typedData.types,
				primaryType: typedData.primaryType,
				message: typedData.message,
				account: this.wallet.account!
			})

			const orderHash = order.getOrderHash(this.config.chain.id)

			await this.sdk.submitOrder(order, signature)

			await sleep(2050)

			const orderInfo = await this.sdk.getOrderByHash(orderHash)

			console.log("orderInfo: ", orderInfo)

			const orderExpiration = DateTime.fromISO(orderInfo.createDateTime).plus({
				seconds: Number(this.config.orderExpiration)
			})

			this.currentOrders.push({
				orderHash: orderInfo.orderHash as EvmAddress,
				makerTraits: BigInt(orderInfo.data.makerTraits),
				expiration: orderExpiration
			})
		} catch (_error) {
			console.error("error")
		}
	}

	private walletAddress() {
		return this.wallet.account?.address!
	}

	private async cancelOrder(markerTraits: bigint, orderHash: EvmAddress) {
		return this.wallet.writeContract({
			address: "0x111111125421cA6dc452d289314280a0f8842A65",
			abi: aggregatorAbi,
			functionName: "cancelOrder",
			args: [markerTraits, orderHash],
			chain: this.config.chain,
			account: this.wallet.account!
		})
	}

	private async clearOrders() {
		if (this.currentOrders.length < 1) {
			return
		}

		const markerTraits: bigint[] = []
		const orderHashes: EvmAddress[] = []

		for (const order of this.currentOrders) {
			markerTraits.push(order.makerTraits)
			orderHashes.push(order.orderHash)
		}

		const hash = await this.wallet.writeContract({
			address: "0x111111125421cA6dc452d289314280a0f8842A65",
			abi: aggregatorAbi,
			functionName: "cancelOrders",
			args: [markerTraits, orderHashes],
			chain: this.config.chain,
			account: this.wallet.account!
		})

		console.log("hash: ", hash)

		this.currentOrders = []
	}
}
