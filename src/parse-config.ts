import fs from "node:fs"
import { isHex } from "viem"
import { avalanche, mainnet } from "viem/chains"
import { z } from "zod"
import { evmAddress, notEmptyStr, positiveNumber } from "./parsers"
import path from "node:path"

export type Config = z.infer<typeof schema>

const schema = z.object({
	chain: z
		.enum(["ether", "avax"])
		.optional()
		.default("ether")
		.transform(chain => (chain === "avax" ? avalanche : mainnet)),
	rpc_url: z.string().url(),
	private_key: notEmptyStr().refine(isHex, "expected a hex string"),
	one_inch_api_key: notEmptyStr(),
	input_asset: evmAddress(),
	output_asset: evmAddress(),
	order_count: z.number().int().min(0),
	order_expiration: positiveNumber(),
	min_quantity: positiveNumber(),
	max_auantity: positiveNumber(),
	order_step: positiveNumber(),
	cyle_delay: positiveNumber(),
	cancel_delay: positiveNumber()
})

export function parseConfig() {
	const configFilePath = path
		.resolve(__dirname, "config.json")
		.replace("/dist", "")

	const config = schema.parse(
		JSON.parse(fs.readFileSync(configFilePath, "utf-8"))
	)

	return config
}
