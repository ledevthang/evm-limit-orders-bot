"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _viem = require("viem");
const _parseconfig = require("./parse-config");
const _program = require("./program");
async function main() {
    const config = (0, _parseconfig.parseConfig)();
    const transport = (0, _viem.fallback)([
        (0, _viem.http)(config.rpcUrl)
    ]);
    const mainWalletClient = (0, _viem.createWalletClient)({
        transport,
        account: config.mainWallet
    });
    const program = new _program.Program(mainWalletClient, config);
    // await infinitely(() => program.run())
    await program.run();
}
main();
