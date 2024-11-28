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
const _viem = require("viem");
const _aggregatorabi = require("./aggregator-abi");
const _axiosproviderconnector = require("./axios-provider-connector");
const _utils = require("./utils");
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
const ONEINCH_CONTRACT = "0x111111125421cA6dc452d289314280a0f8842A65";
class Program {
    async run() {
        const makingAmount = this.config.makingAmount;
        const makingAmountInWei = (0, _viem.parseEther)(makingAmount.toString());
        await this.approveTransfer(makingAmountInWei);
        for(;;){
            const takingAmount = await this.calculatePrice().then((div)=>div * makingAmount);
            for(let i = 1; i < this.config.numberLimitOrders; i++){
                const takingAmountInWei = (0, _viem.parseEther)((takingAmount + percent(takingAmount, this.config.orderStep * i)).toString());
                await this.createOrder({
                    makerAsset: this.config.markerAsset,
                    takerAsset: this.config.takerAsset,
                    makingAmount: makingAmountInWei,
                    takingAmount: takingAmountInWei
                });
                console.log("made a order ", Number((0, _viem.formatEther)(makingAmountInWei)), ` ${this.config.markerAsset} for `, Number((0, _viem.formatEther)(takingAmountInWei)), ` ${this.config.takerAsset}`);
            }
            await (0, _utils.sleep)(this.config.interval);
            await this.clearOrders();
        }
    }
    async clearOrders() {
        const availableOrders = this.currentOrders.filter((order)=>order.expiration.toSeconds() > _luxon.DateTime.now().toSeconds());
        if (availableOrders.length < 1) {
            return;
        }
        const markerTraits = [];
        const orderHashes = [];
        for (const order of availableOrders){
            markerTraits.push(order.makerTraits);
            orderHashes.push(order.orderHash);
        }
        await this.wallet.writeContract({
            address: ONEINCH_CONTRACT,
            abi: _aggregatorabi.aggregatorAbi,
            functionName: "cancelOrders",
            args: [
                markerTraits,
                orderHashes
            ],
            chain: this.config.chain,
            account: this.wallet.account
        });
        this.currentOrders = [];
    }
    async createOrder(params) {
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
        const orderHash = order.getOrderHash(this.config.chain.id);
        await this.sdk.submitOrder(order, signature);
        const orderInfo = await this.sdk.getOrderByHash(orderHash);
        const orderExpiration = _luxon.DateTime.fromISO(orderInfo.createDateTime).plus({
            seconds: Number(this.config.orderExpiration)
        });
        this.currentOrders.push({
            orderHash: orderInfo.orderHash,
            makerTraits: BigInt(orderInfo.data.makerTraits),
            expiration: orderExpiration
        });
    }
    walletAddress() {
        return this.wallet.account?.address;
    }
    async approveTransfer(makingAmount) {
        const allowance = await this.rpcClient.readContract({
            address: this.config.markerAsset,
            abi: _viem.erc20Abi,
            functionName: "allowance",
            args: [
                this.walletAddress(),
                ONEINCH_CONTRACT
            ]
        });
        if (allowance >= makingAmount) return;
        await this.wallet.writeContract({
            address: this.config.markerAsset,
            abi: _viem.erc20Abi,
            functionName: "approve",
            args: [
                ONEINCH_CONTRACT,
                makingAmount
            ],
            chain: this.config.chain,
            account: this.wallet.account
        });
    }
    async calculatePrice() {
        const price = await this.oneinch.spotPrice(this.config.chain.id, [
            this.config.markerAsset,
            this.config.takerAsset
        ]);
        const div = Number(price[this.config.takerAsset]) / Number(price[this.config.markerAsset]);
        return div;
    }
    constructor(wallet, rpcClient, config){
        _define_property(this, "wallet", void 0);
        _define_property(this, "rpcClient", void 0);
        _define_property(this, "config", void 0);
        _define_property(this, "makerTraits", void 0);
        _define_property(this, "sdk", void 0);
        _define_property(this, "oneinch", void 0);
        _define_property(this, "currentOrders", void 0);
        this.wallet = wallet;
        this.rpcClient = rpcClient;
        this.config = config;
        this.currentOrders = [];
        this.makerTraits = _limitordersdk.MakerTraits.default().withExpiration(BigInt(Math.floor(_luxon.DateTime.now().toSeconds())) + this.config.orderExpiration).allowPartialFills() // If you wish to allow partial fills
        .allowMultipleFills() // And assuming multiple fills are also okay
        ;
        this.oneinch = new _axiosproviderconnector.OneInchClient(config.oneinchApiKey);
        this.sdk = new _limitordersdk.Api({
            networkId: config.chain.id,
            authKey: config.oneinchApiKey,
            httpConnector: this.oneinch
        });
    }
}
function percent(val, percentage) {
    return val / 100 * percentage;
}
