import * as oninchsdk from "@1inch/limit-order-sdk"
import Decimal from "decimal.js"
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
import { Logger } from "./logger"
import type { Config } from "./parse-config"
import { logErr, random, sleep } from "./utils"

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

const ONEINCH_AGGREGATOR_CONTRACT = "0x111111125421cA6dc452d289314280a0f8842A65"

export class Program {
	private makerTraits: oninchsdk.MakerTraits
	private sdk: oninchsdk.Api
	private oneinch: OneInchClient
	private currentOrders: Order[] = []
	private current_order_index = 1

	constructor(
		private wallet: WalletClient,
		private rpcClient: PublicClient,
		private config: Config,
		private inAssetSymbol: string,
		private outAssetSymbol: string
	) {
		this.makerTraits = oninchsdk.MakerTraits.default()
			.withExpiration(
				BigInt(Math.floor(DateTime.now().toSeconds())) +
					BigInt(this.config.order_expiration)
			)
			.allowPartialFills() // If you wish to allow partial fills
			.allowMultipleFills() // And assuming multiple fills are also okay

		this.oneinch = new OneInchClient(config.one_inch_api_key)

		this.sdk = new oninchsdk.Api({
			networkId: config.chain.id,
			authKey: config.one_inch_api_key,
			httpConnector: this.oneinch
		})
	}

	public async run() {
		Logger.info(
			`Staring evm limit order bot with pairs ${this.inAssetSymbol} and ${this.outAssetSymbol}`
		)
		Logger.info(`Wallet ${this.walletAddress()}...`)
		Logger.info(`1Inch aggregator contract ${ONEINCH_AGGREGATOR_CONTRACT}`)
		Logger.newLine()

		for (;;) {
			try {
				await this.unsafeRun()
			} catch (error) {
				logErr(error)
				Logger.info("Retrying...")

				await sleep(3000)
			}
		}
	}

	private async unsafeRun() {
		const makingAmount = new Decimal(
			random(this.config.min_quantity, this.config.max_auantity)
		)

		const makingAmountInWei = parseWei(makingAmount)

		await this.approveTransfer(makingAmountInWei)

		for (;;) {
			for (
				;
				this.current_order_index <= this.config.order_count;
				this.current_order_index++
			) {
				const takingAmount = await this.calculatePriceInDivOut().then(div =>
					div.mul(makingAmount)
				)

				const takingAmountInWei = parseWei(
					takingAmount.plus(
						decimalPercent(
							takingAmount,
							this.config.order_step * this.current_order_index
						)
					)
				)

				const hash = await this.createOrder({
					makerAsset: this.config.input_asset,
					takerAsset: this.config.output_asset,
					makingAmount: makingAmountInWei,
					takingAmount: takingAmountInWei
				})

				Logger.info(
					`Made a order ${formatEther(makingAmountInWei)} ${this.inAssetSymbol} for ${formatEther(takingAmountInWei)} ${this.outAssetSymbol} with hash: ${hash}`
				)
				await sleep(this.config.delay_per_order * 1000)
			}

			Logger.info("Sleeping before new cycle...")
			Logger.newLine()

			this.current_order_index = 1
			await sleep(this.config.cycle_delay * 1000)
		}
	}

	public scheduleClearingOrders() {
		setInterval(async () => {
			try {
				await this.clearOrders()
			} catch (error) {
				logErr(error)
			}
		}, this.config.cancel_delay * 1000)
	}

	private async clearOrders() {
		const availableOrders = this.currentOrders.filter(
			order => order.expiration.toSeconds() > DateTime.now().toSeconds()
		)

		if (availableOrders.length < 1) {
			return
		}

		const markerTraits: bigint[] = []
		const orderHashes: EvmAddress[] = []

		for (const order of availableOrders) {
			markerTraits.push(order.makerTraits)
			orderHashes.push(order.orderHash)
		}

		await this.wallet.writeContract({
			address: ONEINCH_AGGREGATOR_CONTRACT,
			abi: aggregatorAbi,
			functionName: "cancelOrders",
			args: [markerTraits, orderHashes],
			chain: this.config.chain,
			account: this.wallet.account!
		})

		this.currentOrders = []

		Logger.info("Cleared all orders")
		Logger.newLine()
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
			seconds: Number(this.config.order_expiration)
		})

		this.currentOrders.push({
			orderHash: orderInfo.orderHash as EvmAddress,
			makerTraits: BigInt(orderInfo.data.makerTraits),
			expiration: orderExpiration
		})

		return orderHash
	}

	private walletAddress() {
		return this.wallet.account?.address!
	}

	private async approveTransfer(makingAmount: bigint) {
		const allowance = await this.rpcClient.readContract({
			address: this.config.input_asset,
			abi: erc20Abi,
			functionName: "allowance",
			args: [this.walletAddress(), ONEINCH_AGGREGATOR_CONTRACT]
		})

		if (allowance >= makingAmount) return

		await this.wallet.writeContract({
			address: this.config.input_asset,
			abi: erc20Abi,
			functionName: "approve",
			args: [ONEINCH_AGGREGATOR_CONTRACT, makingAmount],
			chain: this.config.chain,
			account: this.wallet.account!
		})
	}

	private async calculatePriceInDivOut() {
		const price = await this.oneinch.spotPrice(this.config.chain.id, [
			this.config.input_asset,
			this.config.output_asset
		])

		const div = new Decimal(price[this.config.input_asset]).div(
			new Decimal(price[this.config.output_asset])
		)

		return div
	}
}

function decimalPercent(val: Decimal, percentage: number) {
	return val.div(100).mul(percentage)
}

function parseWei(val: Decimal) {
	return parseEther(val.toFixed())
}
