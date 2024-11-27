"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Program", {
    enumerable: true,
    get: function() {
        return Program;
    }
});
const _limitordersdk = /*#__PURE__*/ _interop_require_wildcard(require("@1inch/limit-order-sdk"));
const _luxon = require("luxon");
const _aggregatorabi = require("./aggregator-abi");
const _axiosproviderconnector = require("./axios-provider-connector");
const _utils = require("./utils");
const _axios = require("@1inch/limit-order-sdk/axios");
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
class Program {
    async run() {
        await this.createOrder({
            makerAsset: "0x63a72806098bd3d9520cc43356dd78afe5d386d9",
            takerAsset: "0xd586e7f844cea2f87f50152665bcbc2c279d8d70",
            makingAmount: 100000000000000000n,
            takingAmount: 354591303896920600n
        });
        console.log("create ok");
        await (0, _utils.sleep)(3000);
    // console.log("currentOrders: ", this.currentOrders)
    // await this.clearOrders()
    // console.log("done")
    }
    async createOrder(params) {
        try {
            const order = new _limitordersdk.LimitOrder({
                makerAsset: new _limitordersdk.Address(params.makerAsset),
                takerAsset: new _limitordersdk.Address(params.takerAsset),
                makingAmount: params.makingAmount,
                takingAmount: params.takingAmount,
                maker: new _limitordersdk.Address(this.walletAddress()),
                receiver: new _limitordersdk.Address(this.walletAddress()),
                salt: BigInt(Math.floor(Math.random() * 100000000))
            }, this.makerTraits);
            const typedData = order.getTypedData(this.config.chain.id);
            typedData.domain.chainId = this.config.chain.id;
            const signature = await this.wallet.signTypedData({
                domain: typedData.domain,
                types: typedData.types,
                primaryType: typedData.primaryType,
                message: typedData.message,
                account: this.wallet.account
            });
            console.log("order: ", order);
            const orderHash = order.getOrderHash(this.config.chain.id);
            console.log("orderHash: ", orderHash);
            await this.sdk.submitOrder(order, signature);
            console.log("submitOrder: ");
            await (0, _utils.sleep)(5000);
            const orderInfo = await this.sdk.getOrderByHash(orderHash);
            console.log("orderInfo: ", orderInfo);
            await (0, _utils.sleep)(2000);
            const orderExpiration = _luxon.DateTime.fromISO(orderInfo.createDateTime).plus({
                seconds: Number(this.config.orderExpiration)
            });
            this.currentOrders.push({
                orderHash: orderInfo.orderHash,
                makerTraits: BigInt(orderInfo.data.makerTraits),
                expiration: orderExpiration
            });
        } catch (error) {
            console.error("error");
        }
    }
    walletAddress() {
        return this.wallet.account?.address;
    }
    async cancelOrder(markerTraits, orderHash) {
        return this.wallet.writeContract({
            address: "0x111111125421cA6dc452d289314280a0f8842A65",
            abi: _aggregatorabi.aggregatorAbi,
            functionName: "cancelOrder",
            args: [
                markerTraits,
                orderHash
            ],
            chain: this.config.chain,
            account: this.wallet.account
        });
    }
    async clearOrders() {
        if (this.currentOrders.length < 1) {
            return;
        }
        const markerTraits = [];
        const orderHashes = [];
        for (const order of this.currentOrders){
            markerTraits.push(order.makerTraits);
            orderHashes.push(order.orderHash);
        }
        const hash = await this.wallet.writeContract({
            address: "0x111111125421cA6dc452d289314280a0f8842A65",
            abi: _aggregatorabi.aggregatorAbi,
            functionName: "cancelOrders",
            args: [
                markerTraits,
                orderHashes
            ],
            chain: this.config.chain,
            account: this.wallet.account
        });
        console.log("hash: ", hash);
        this.currentOrders = [];
    }
    constructor(wallet, config){
        _define_property(this, "wallet", void 0);
        _define_property(this, "config", void 0);
        _define_property(this, "makerTraits", void 0);
        _define_property(this, "sdk", void 0);
        _define_property(this, "oneinch", void 0);
        _define_property(this, "currentOrders", void 0);
        this.wallet = wallet;
        this.config = config;
        this.currentOrders = [];
        this.makerTraits = _limitordersdk.MakerTraits.default().withExpiration(600n).allowPartialFills() // If you wish to allow partial fills
        .allowMultipleFills() // And assuming multiple fills are also okay
        ;
        this.oneinch = new _axiosproviderconnector.OneInchClient(config.oneinchApiKey);
        this.sdk = new _limitordersdk.Api({
            networkId: config.chain.id,
            authKey: config.oneinchApiKey,
            httpConnector: new _axios.AxiosProviderConnector()
        });
    }
}
