import { http, createPublicClient, createWalletClient, erc20Abi } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { parseConfig } from "./parse-config"
import { Program } from "./program"

async function main() {
	const config = parseConfig()

	const transport = http(config.rpc_url)

	const rpcClient = createPublicClient({
		transport
	})

	const mainWalletClient = createWalletClient({
		transport,
		account: privateKeyToAccount(config.private_key)
	})
	const inAssetSymbol = await rpcClient.readContract({
		abi: erc20Abi,
		address: config.input_asset,
		functionName: "symbol"
	})

	const outAssetSymbol = await rpcClient.readContract({
		abi: erc20Abi,
		address: config.output_asset,
		functionName: "symbol"
	})

	const program = new Program(
		mainWalletClient,
		rpcClient,
		config,
		inAssetSymbol,
		outAssetSymbol
	)

	program.scheduleClearingOrders()

	await program.run()
}

main()
