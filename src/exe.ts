import { LimitOrder, MakerTraits, Address } from "@1inch/limit-order-sdk";
import { Api } from "@1inch/limit-order-sdk";
import { AxiosProviderConnector } from "./AxiosProviderConnector";
import { Config } from "./parse-config"
import { WalletClient, erc20Abi } from "viem";
import { avalanche } from "viem/chains";
import { aggregatorAbi } from "./aggregator-abi";

export class Execute {
  private makerTraits: MakerTraits
  private api: Api

  constructor(
    private mainWalletClient: WalletClient,
    private config: Config) {

    const expiration = BigInt(Math.floor(Date.now() / 1000)) + this.config.orderExpiration

    // see MakerTraits.ts
    this.makerTraits = MakerTraits.default()
      .withExpiration(expiration)
      .allowPartialFills() // If you wish to allow partial fills
      .allowMultipleFills(); // And assuming multiple fills are also okay

    this.api = new Api({
      networkId: config.chain.id,
      authKey: String(config.oneinchApiKey), // get it at https://portal.1inch.dev/
      httpConnector: new AxiosProviderConnector()
    });
  }

  async run() {
    const orderParam = {
      makerAsset: "0x63a72806098bd3d9520cc43356dd78afe5d386d9", // WAVAX
      takerAsset: "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", // DAI
      makingAmount: 100000000000000000n,
      takingAmount: 354591303896920600n
    }

    await this.submitOrderTransfer(orderParam);
  }

  private async submitOrderTransfer(orderParam: any) {
    const order = new LimitOrder({
      makerAsset: new Address(orderParam.makerAsset),
      takerAsset: new Address(orderParam.takerAsset),
      makingAmount: orderParam.makingAmount,
      takingAmount: orderParam.takingAmount,
      maker: new Address(this.config.mainWallet.address),
      salt: BigInt(Math.floor(Math.random() * 100000000)),
      receiver: new Address(this.config.mainWallet.address),
    }, this.makerTraits);

    console.log("order", order);

    const typedData = order.getTypedData(this.config.chain.id)

    typedData.domain.chainId = this.config.chain.id

    const signature = await this.mainWalletClient.signTypedData({
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
      account: this.config.mainWallet
    })
    const orderHash = order.getOrderHash(this.config.chain.id)

    await this.api.submitOrder(order, signature);

    // must wait at least 1.05 seconds after submitting the order to query it
    await new Promise(resolve => setTimeout(resolve, 2050));

    const orderInfo = await this.api.getOrderByHash(orderHash);

    console.log('orderInfo', orderInfo);
    console.log('makerTraits', orderInfo.data.makerTraits);
  }


  async approveTransfer(orderParam: any) {
    const approve = await this.mainWalletClient.writeContract({
      address: orderParam.makerAsset as any,
      abi: erc20Abi,
      functionName: 'approve',
      args: [this.config.oneinchContractAddress as any, orderParam.makingAmount],
      chain: avalanche,
      account: this.config.mainWallet
    });

    console.log("approve", approve);
    await new Promise(resolve => setTimeout(resolve, 2050));
  }



  async cancelOrder(makerTraits: any, orderHash: any) {
    try {
      const cancelOrder = await this.mainWalletClient.writeContract({
        address: this.config.oneinchContractAddress as any,
        abi: aggregatorAbi,
        functionName: 'cancelOrder',
        args: [makerTraits, orderHash],
        chain: avalanche,
        account: this.config.mainWallet
      });

      console.log("cancel", cancelOrder);
      console.log('Cancel Order Done');
    } catch (err) {
      console.log(err);
    }
  }
}



/*
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

