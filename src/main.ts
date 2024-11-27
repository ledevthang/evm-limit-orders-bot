import { http, createWalletClient, fallback } from "viem"
import { parseConfig } from "./parse-config"
import { Program } from "./program"
import { Execute } from "./exe"

async function main() {
	const config = parseConfig()

	const transport = fallback([http(config.rpcUrl)])

	const mainWalletClient = createWalletClient({
		transport,
		account: config.mainWallet
	})

	const program = new Program(mainWalletClient, config)

	// await infinitely(() => program.run())

	await program.run()

	// const execute = new Execute(mainWalletClient, config)

	// await execute.run()

}

main()
