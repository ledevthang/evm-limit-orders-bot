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
			`Staring evm limit order bot with pairs ${this.config.input_asset} and ${this.config.output_asset}`
		)
		Logger.info(`Wallet ${this.walletAddress()}...`)
		Logger.info(`1Inch contract ${ONEINCH_CONTRACT}`)
		Logger.newLine()

		const inAssetSymbol = await this.rpcClient.readContract({
			abi: erc20Abi,
			address: this.config.input_asset,
			functionName: "symbol"
		})

		const outAssetSymbol = await this.rpcClient.readContract({
			abi: erc20Abi,
			address: this.config.output_asset,
			functionName: "symbol"
		})

		const makingAmount = new Decimal(
			random(this.config.min_quantity, this.config.max_auantity)
		)

		const makingAmountInWei = parseWei(makingAmount)

		await this.approveTransfer(makingAmountInWei)

		for (;;) {
			try {
				for (let i = 1; i <= this.config.order_count; i++) {
					const takingAmount = await this.calculatePrice().then(div =>
						div.mul(makingAmount)
					)

					const takingAmountInWei = parseWei(
						takingAmount.plus(percent(takingAmount, this.config.order_step * i))
					)

					const hash = await this.createOrder({
						makerAsset: this.config.input_asset,
						takerAsset: this.config.output_asset,
						makingAmount: makingAmountInWei,
						takingAmount: takingAmountInWei
					})

					const uiInAmount = new Decimal(
						formatEther(makingAmountInWei)
					).toFixed()

					const uiOutAmount = new Decimal(
						formatEther(takingAmountInWei)
					).toFixed()

					Logger.info(
						`made a order ${uiInAmount} ${inAssetSymbol} for ${uiOutAmount} ${outAssetSymbol} with hash: ${hash}`
					)
				}
			} catch (error) {
				logErr(error)
			} finally {
				Logger.info("Sleeping... before new cycle")
				Logger.newLine()

				await sleep(this.config.cyle_delay * 1000)
			}
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
			address: ONEINCH_CONTRACT,
			abi: aggregatorAbi,
			functionName: "cancelOrders",
			args: [markerTraits, orderHashes],
			chain: this.config.chain,
			account: this.wallet.account!
		})

		this.currentOrders = []

		Logger.info("clear all orders")
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
			args: [this.walletAddress(), ONEINCH_CONTRACT]
		})

		if (allowance >= makingAmount) return

		await this.wallet.writeContract({
			address: this.config.input_asset,
			abi: erc20Abi,
			functionName: "approve",
			args: [ONEINCH_CONTRACT, makingAmount],
			chain: this.config.chain,
			account: this.wallet.account!
		})
	}

	private async calculatePrice() {
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

function percent(val: Decimal, percentage: number) {
	return val.div(100).mul(percentage)
}

function parseWei(val: Decimal) {
	return parseEther(val.toFixed())
}
