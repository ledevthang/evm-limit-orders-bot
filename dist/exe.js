"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Execute", {
    enumerable: true,
    get: function() {
        return Execute;
    }
});
const _limitordersdk = require("@1inch/limit-order-sdk");
const _AxiosProviderConnector = require("./AxiosProviderConnector");
const _viem = require("viem");
const _chains = require("viem/chains");
const _aggregatorabi = require("./aggregator-abi");
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
class Execute {
    async run() {
        const orderParam = {
            makerAsset: "0x63a72806098bd3d9520cc43356dd78afe5d386d9",
            takerAsset: "0xd586e7f844cea2f87f50152665bcbc2c279d8d70",
            makingAmount: 100000000000000000n,
            takingAmount: 354591303896920600n
        };
        await this.submitOrderTransfer(orderParam);
    }
    async submitOrderTransfer(orderParam) {
        const order = new _limitordersdk.LimitOrder({
            makerAsset: new _limitordersdk.Address(orderParam.makerAsset),
            takerAsset: new _limitordersdk.Address(orderParam.takerAsset),
            makingAmount: orderParam.makingAmount,
            takingAmount: orderParam.takingAmount,
            maker: new _limitordersdk.Address(this.config.mainWallet.address),
            salt: BigInt(Math.floor(Math.random() * 100000000)),
            receiver: new _limitordersdk.Address(this.config.mainWallet.address)
        }, this.makerTraits);
        console.log("order", order);
        const typedData = order.getTypedData(this.config.chain.id);
        typedData.domain.chainId = this.config.chain.id;
        const signature = await this.mainWalletClient.signTypedData({
            domain: typedData.domain,
            types: typedData.types,
            primaryType: typedData.primaryType,
            message: typedData.message,
            account: this.config.mainWallet
        });
        const orderHash = order.getOrderHash(this.config.chain.id);
        await this.api.submitOrder(order, signature);
        // must wait at least 1.05 seconds after submitting the order to query it
        await new Promise((resolve)=>setTimeout(resolve, 2050));
        const orderInfo = await this.api.getOrderByHash(orderHash);
        console.log('orderInfo', orderInfo);
        console.log('makerTraits', orderInfo.data.makerTraits);
    }
    async approveTransfer(orderParam) {
        const approve = await this.mainWalletClient.writeContract({
            address: orderParam.makerAsset,
            abi: _viem.erc20Abi,
            functionName: 'approve',
            args: [
                this.config.oneinchContractAddress,
                orderParam.makingAmount
            ],
            chain: _chains.avalanche,
            account: this.config.mainWallet
        });
        console.log("approve", approve);
        await new Promise((resolve)=>setTimeout(resolve, 2050));
    }
    async cancelOrder(makerTraits, orderHash) {
        try {
            const cancelOrder = await this.mainWalletClient.writeContract({
                address: this.config.oneinchContractAddress,
                abi: _aggregatorabi.aggregatorAbi,
                functionName: 'cancelOrder',
                args: [
                    makerTraits,
                    orderHash
                ],
                chain: _chains.avalanche,
                account: this.config.mainWallet
            });
            console.log("cancel", cancelOrder);
            console.log('Cancel Order Done');
        } catch (err) {
            console.log(err);
        }
    }
    constructor(mainWalletClient, config){
        _define_property(this, "mainWalletClient", void 0);
        _define_property(this, "config", void 0);
        _define_property(this, "makerTraits", void 0);
        _define_property(this, "api", void 0);
        this.mainWalletClient = mainWalletClient;
        this.config = config;
        const expiration = BigInt(Math.floor(Date.now() / 1000)) + this.config.orderExpiration;
        // see MakerTraits.ts
        this.makerTraits = _limitordersdk.MakerTraits.default().withExpiration(expiration).allowPartialFills() // If you wish to allow partial fills
        .allowMultipleFills(); // And assuming multiple fills are also okay
        this.api = new _limitordersdk.Api({
            networkId: config.chain.id,
            authKey: String(config.oneinchApiKey),
            httpConnector: new _AxiosProviderConnector.AxiosProviderConnector()
        });
    }
} /*
async function cancelOrders() {
  try {
    const filePath = path.resolve("./limitOrders.txt");
    const orderByTexts = await readFile(filePath, "utf-8");
    const orderTextByLines = orderByTexts.split("\n");
    console.log(orderTextByLines);

    const validDataOrders = orderTextByLines.filter(item => item.trim() !== '');
    const parsedDataOrders = validDataOrders.map(item => JSON.parse(item));
    const cancelDatas = parsedDataOrders.filter(order => new Date(order.expiration).getTime() >= Date.now())

    let makerTraits: any[] = []
    let orderHash: any[] = []
    for (const order of cancelDatas) {
      makerTraits.push(order.makerTraits);
      orderHash.push(order.orderHash);
    }

    console.log(makerTraits);
    console.log(orderHash);



    const cancelOrders = await mainWalletClient.writeContract({
      address: config.oneinchContractAddress as any,
      abi: aggregatorAbi,
      functionName: 'cancelOrders',
      args: [makerTraits, orderHash],
      chain: avalanche
    });

    await writeFile(filePath, '', 'utf-8');

    console.log("cancels", cancelOrders);
    console.log('Cancel Orders Done');
  } catch (err) {
    console.log(err);
  }
}*/ 
