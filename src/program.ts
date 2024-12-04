import * as oninchsdk from "@1inch/limit-order-sdk"
import { DateTime } from "luxon"
import {
	type Address as EvmAddress,
	type PublicClient,
	type WalletClient,
	erc20Abi,
	formatEther,
	parseEther
} from "viem"
import { aggregatorAbi } from "./aggregator-abi"
import { OneInchClient } from "./axios-provider-connector"
import type { Config } from "./parse-config"
import { logErr, sleep } from "./utils"

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

const ONEINCH_CONTRACT = "0x111111125421cA6dc452d289314280a0f8842A65"

export class Program {
	private makerTraits: oninchsdk.MakerTraits
	private sdk: oninchsdk.Api
	private oneinch: OneInchClient
	private currentOrders: Order[] = []

	constructor(
		private wallet: WalletClient,
		private rpcClient: PublicClient,
		private config: Config
	) {
		this.makerTraits = oninchsdk.MakerTraits.default()
			.withExpiration(
				BigInt(Math.floor(DateTime.now().toSeconds())) +
					this.config.orderExpiration
			)
			.allowPartialFills() // If you wish to allow partial fills
			.allowMultipleFills() // And assuming multiple fills are also okay

		this.oneinch = new OneInchClient(config.oneinchApiKey)

		this.sdk = new oninchsdk.Api({
			networkId: config.chain.id,
			authKey: config.oneinchApiKey,
			httpConnector: this.oneinch
		})
	}

	async run() {
		const makingAmount = this.config.makingAmount
		const makingAmountInWei = parseEther(makingAmount.toString())
		await this.approveTransfer(makingAmountInWei)

		for (;;) {
			try {
				const takingAmount = await this.calculatePrice().then(
					div => div * makingAmount
				)

				for (let i = 1; i <= this.config.numberLimitOrders; i++) {
					const takingAmountInWei = parseEther(
						(
							takingAmount + percent(takingAmount, this.config.orderStep * i)
						).toString()
					)

					await this.createOrder({
						makerAsset: this.config.markerAsset,
						takerAsset: this.config.takerAsset,
						makingAmount: makingAmountInWei,
						takingAmount: takingAmountInWei
					})

					console.log(
						"made a order ",
						Number(formatEther(makingAmountInWei)),
						` ${this.config.markerAsset} for `,
						Number(formatEther(takingAmountInWei)),
						` ${this.config.takerAsset}`
					)
				}

				await this.clearOrders()
			} catch (error) {
				logErr(error)
			}

			await sleep(this.config.interval * 1000)
		}
	}

	public async clearOrders() {
		const availableOrders = this.currentOrders.filter(
			order => order.expiration.toSeconds() > DateTime.now().toSeconds()
		)

		if (availableOrders.length < 1) {
			console.log("clear all orders")
			return
		}

		const markerTraits: bigint[] = []
		const orderHashes: EvmAddress[] = []

		for (const order of availableOrders) {
			markerTraits.push(order.makerTraits)
			orderHashes.push(order.orderHash)
		}

		await this.wallet.writeContract({
			address: ONEINCH_CONTRACT,
			abi: aggregatorAbi,
			functionName: "cancelOrders",
			args: [markerTraits, orderHashes],
			chain: this.config.chain,
			account: this.wallet.account!
		})

		this.currentOrders = []

		console.log("clear all orders")
	}

	private async createOrder(params: OrderParams) {
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

		const orderInfo = await this.sdk.getOrderByHash(orderHash)

		const orderExpiration = DateTime.fromISO(orderInfo.createDateTime).plus({
			seconds: Number(this.config.orderExpiration)
		})

		this.currentOrders.push({
			orderHash: orderInfo.orderHash as EvmAddress,
			makerTraits: BigInt(orderInfo.data.makerTraits),
			expiration: orderExpiration
		})
	}

	private walletAddress() {
		return this.wallet.account?.address!
	}

	private async approveTransfer(makingAmount: bigint) {
		const allowance = await this.rpcClient.readContract({
			address: this.config.markerAsset,
			abi: erc20Abi,
			functionName: "allowance",
			args: [this.walletAddress(), ONEINCH_CONTRACT]
		})

		if (allowance >= makingAmount) return

		await this.wallet.writeContract({
			address: this.config.markerAsset,
			abi: erc20Abi,
			functionName: "approve",
			args: [ONEINCH_CONTRACT, makingAmount],
			chain: this.config.chain,
			account: this.wallet.account!
		})
	}

	private async calculatePrice() {
		const price = await this.oneinch.spotPrice(this.config.chain.id, [
			this.config.markerAsset,
			this.config.takerAsset
		])

		const div =
			Number(price[this.config.takerAsset]) /
			Number(price[this.config.markerAsset])

		return div
	}
}

function percent(val: number, percentage: number) {
	return (val / 100) * percentage
}
