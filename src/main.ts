import { http, createPublicClient, createWalletClient, fallback } from "viem"
import { parseConfig } from "./parse-config"
import { Program } from "./program"
import { logErr } from "./utils"

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
		try {
			await program.clearOrders()
		} catch (error) {
			logErr(error)
		} finally {
			process.exit(1)
		}
	})

	await program.run()
}

main()
