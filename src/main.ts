import { http, createPublicClient, createWalletClient, fallback } from "viem"
import { parseConfig } from "./parse-config"
import { Program } from "./program"

async function main() {
	const config = parseConfig()

	const transport = fallback([http(config.rpcUrl)])

	const rpcClient = createPublicClient({
		transport
	})

	const mainWalletClient = createWalletClient({
		transport,
		account: config.mainWallet
	})

	const program = new Program(mainWalletClient, rpcClient, config)

	process.on("SIGINT", async () => {
		await program.clearOrders()
		process.exit(1)
	})

	await program.run()
}

main()
