import { privateKeyToAccount } from "viem/accounts"
import { avalanche, mainnet } from "viem/chains"
import { z } from "zod"

export type Config = ReturnType<typeof parseConfig>

export function parseConfig() {
	const schema = z.object({
		PRIVATE_KEY_WALLET: z.string().min(1),
		API_1INCH_KEY: z.string().min(1),
		ADDRESS_1INCH_CONTRACT: z.string().trim(),
		RPC_URL: z.string().url(),
		CHAIN: z.enum(["avax", "ethereum"]),
		ORDER_EXPIRATION: z.string().transform(BigInt).pipe(z.bigint().positive()),
		NUMBER_LIMIT_ORDERS: z
			.string()
			.transform(Number)
			.pipe(z.number().int().positive().min(1)),
		ORDER_STEP: z.string().transform(Number).pipe(z.number().positive().min(1))
	})

	const {
		API_1INCH_KEY,
		ADDRESS_1INCH_CONTRACT,
		PRIVATE_KEY_WALLET,
		RPC_URL,
		CHAIN,
		ORDER_EXPIRATION
	} = schema.parse(process.env)

	return {
		mainWallet: privateKeyToAccount(`0x${PRIVATE_KEY_WALLET}`),
		rpcUrl: RPC_URL,
		chain: CHAIN === "avax" ? avalanche : mainnet,
		oneinchApiKey: API_1INCH_KEY,
		oneinchContractAddress: ADDRESS_1INCH_CONTRACT,
		orderExpiration: ORDER_EXPIRATION
	}
}
