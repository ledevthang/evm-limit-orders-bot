import { http, createPublicClient, createWalletClient } from "viem"
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

	const program = new Program(mainWalletClient, rpcClient, config)

	program.scheduleClearingOrders()

	await program.run()
}

main()
