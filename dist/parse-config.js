"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "parseConfig", {
    enumerable: true,
    get: function() {
        return parseConfig;
    }
});
const _viem = require("viem");
const _accounts = require("viem/accounts");
const _chains = require("viem/chains");
const _zod = require("zod");
function parseConfig() {
    const schema = _zod.z.object({
        PRIVATE_KEY_WALLET: _zod.z.string().min(1),
        API_1INCH_KEY: _zod.z.string().min(1),
        RPC_URL: _zod.z.string().url(),
        CHAIN: _zod.z.enum([
            "avax",
            "ethereum"
        ]),
        ORDER_EXPIRATION: _zod.z.string().transform(BigInt).pipe(_zod.z.bigint().positive()),
        NUMBER_LIMIT_ORDERS: _zod.z.string().transform(Number).pipe(_zod.z.number().int().positive().min(1)),
        ORDER_STEP: _zod.z.string().transform(Number).pipe(_zod.z.number().positive().min(1)),
        MAKER_ASSET: _zod.z.string().refine(_viem.isAddress, "invalid token addresss"),
        TAKER_ASSET: _zod.z.string().refine(_viem.isAddress, "invalid token addresss"),
        INTERVAL: _zod.z.string().transform(Number).pipe(_zod.z.number().positive()),
        MAKING_AMOUNT: _zod.z.string().transform(Number).pipe(_zod.z.number().positive())
    });
    const { API_1INCH_KEY, PRIVATE_KEY_WALLET, RPC_URL, CHAIN, ORDER_EXPIRATION, MAKER_ASSET, NUMBER_LIMIT_ORDERS, ORDER_STEP, TAKER_ASSET, INTERVAL, MAKING_AMOUNT } = schema.parse(process.env);
    return {
        mainWallet: (0, _accounts.privateKeyToAccount)(`0x${PRIVATE_KEY_WALLET}`),
        rpcUrl: RPC_URL,
        chain: CHAIN === "avax" ? _chains.avalanche : _chains.mainnet,
        oneinchApiKey: API_1INCH_KEY,
        orderExpiration: ORDER_EXPIRATION,
        markerAsset: MAKER_ASSET,
        numberLimitOrders: NUMBER_LIMIT_ORDERS,
        orderStep: ORDER_STEP,
        takerAsset: TAKER_ASSET,
        interval: INTERVAL,
        makingAmount: MAKING_AMOUNT
    };
}
