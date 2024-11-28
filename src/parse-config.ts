import { isAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { avalanche, mainnet } from "viem/chains"
import { z } from "zod"

export type Config = ReturnType<typeof parseConfig>

export function parseConfig() {
	const schema = z.object({
		PRIVATE_KEY_WALLET: z.string().min(1),
		API_1INCH_KEY: z.string().min(1),
		RPC_URL: z.string().url(),
		CHAIN: z.enum(["avax", "ethereum"]),
		ORDER_EXPIRATION: z.string().transform(BigInt).pipe(z.bigint().positive()),
		NUMBER_LIMIT_ORDERS: z
			.string()
			.transform(Number)
			.pipe(z.number().int().positive().min(1)),
		ORDER_STEP: z.string().transform(Number).pipe(z.number().positive().min(1)),
		MAKER_ASSET: z.string().refine(isAddress, "invalid token addresss"),
		TAKER_ASSET: z.string().refine(isAddress, "invalid token addresss"),
		INTERVAL: z.string().transform(Number).pipe(z.number().positive()),
		MAKING_AMOUNT: z.string().transform(Number).pipe(z.number().positive())
	})

	const {
		API_1INCH_KEY,
		PRIVATE_KEY_WALLET,
		RPC_URL,
		CHAIN,
		ORDER_EXPIRATION,
		MAKER_ASSET,
		NUMBER_LIMIT_ORDERS,
		ORDER_STEP,
		TAKER_ASSET,
		INTERVAL,
		MAKING_AMOUNT
	} = schema.parse(process.env)

	return {
		mainWallet: privateKeyToAccount(`0x${PRIVATE_KEY_WALLET}`),
		rpcUrl: RPC_URL,
		chain: CHAIN === "avax" ? avalanche : mainnet,
		oneinchApiKey: API_1INCH_KEY,
		orderExpiration: ORDER_EXPIRATION,
		markerAsset: MAKER_ASSET,
		numberLimitOrders: NUMBER_LIMIT_ORDERS,
		orderStep: ORDER_STEP,
		takerAsset: TAKER_ASSET,
		interval: INTERVAL,
		makingAmount: MAKING_AMOUNT
	}
}
