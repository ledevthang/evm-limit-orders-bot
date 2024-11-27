// add "type": "module" to your package.json to run this with node or name the file with extension .mjs to prevent writing existing .js files
import { LimitOrder, MakerTraits, Address } from "@1inch/limit-order-sdk";
import { Api, getLimitOrderV4Domain } from "@1inch/limit-order-sdk";
// import { AxiosProviderConnector } from "@1inch/limit-order-sdk/axios";

import { AxiosProviderConnector } from "./AxiosProviderConnector";
import fs, { readFile, writeFile } from "node:fs/promises"
import path from "node:path";
import dotenv from 'dotenv';
import { aggregatorAbi } from "./aggregatorAbi";
import { createWalletClient, erc20Abi, fallback, http } from "viem";
import { avalanche } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
dotenv.config();

const chainId = 43114; // Chain ID for AVAX
// const expiresIn = 86400n
const expiresIn = 600n
// const expiresIn = 60n
const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn

const orderParam = {
  makerAsset: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // WAVAX
  takerAsset: "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", // DAI
  makingAmount: 100000000000000000n,
  takingAmount: 354591303896920600n
}

const api_url = "https://avax-mainnet.g.alchemy.com/v2/cw-iL0LU4fvVloJM_i-Mak37uN--ZL7g";
const transport = fallback([http(api_url)])

const mainAccount = privateKeyToAccount(`0x${process.env.PRIVATE_KEY_WALLET}`)

const mainWalletClient = createWalletClient({
  transport,
  account: mainAccount
})

// Approve the makerAsset contract to spend on behalf of the maker
const domain: any = getLimitOrderV4Domain(chainId);

const api = new Api({
  networkId: chainId,
  authKey: String(process.env.API_1INCH_KEY), // get it at https://portal.1inch.dev/
  httpConnector: new AxiosProviderConnector()
});

// see MakerTraits.ts
const makerTraits = MakerTraits.default()
  .withExpiration(expiration)
  .allowPartialFills() // If you wish to allow partial fills
  .allowMultipleFills(); // And assuming multiple fills are also okay


(async () => {
  // approve 
  // await approveTransfer();

  // submit order
  await submitOrderTransfer();

  // Cancel limit order
  // await cancelOrder('0x4000000000000000000000000000000000006747e9e700000000000000000000', '0xafd12f42a7de48e44c82ec9bcdaec8b67fccc990b9fcc249772a1d73347853f8');

  // Cancel limit orders
  // await cancelOrders();

})();


async function approveTransfer() {
  const approve = await mainWalletClient.writeContract({
    address: orderParam.makerAsset as any,
    abi: erc20Abi,
    functionName: 'approve',
    args: [domain.verifyingContract, orderParam.makingAmount],
    chain: avalanche
  });

  console.log("approve", approve);
}

async function submitOrderTransfer() {
  const order = new LimitOrder({
    makerAsset: new Address(orderParam.makerAsset),
    takerAsset: new Address(orderParam.takerAsset),
    makingAmount: orderParam.makingAmount,
    takingAmount: orderParam.takingAmount,
    maker: new Address(mainAccount.address),
    salt: BigInt(Math.floor(Math.random() * 100000000)),
    receiver: new Address(mainAccount.address),
  }, makerTraits);

  const typedData = order.getTypedData(domain)
  typedData.domain.chainId = chainId

  const signature = await mainWalletClient.signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
    account: mainAccount
  })
  const orderHash = order.getOrderHash(chainId)

  try {
    // @1inch/limit-order-sdk/dist/api/api.js, must edit the `submitOrder` method to return the promise
    await api.submitOrder(order, signature);
  } catch (e) {
    console.log(e);
  }

  // must wait at least 1.05 seconds after submitting the order to query it
  await new Promise(resolve => setTimeout(resolve, 2050));

  const orderInfo = await api.getOrderByHash(orderHash);
  console.log("expireTime", orderInfo.createDateTime);
  const createdInSeconds = BigInt(Math.floor(new Date(orderInfo.createDateTime).getTime() / 1000));
  const expirationInSeconds = createdInSeconds + expiresIn;
  const expirationDateMiniSeconds = new Date(Number(expirationInSeconds) * 1000);

  await fs.appendFile("limitOrders.txt", `\n${JSON.stringify({
    orderHash: orderInfo.orderHash,
    makerTraits: orderInfo.data.makerTraits,
    expiration: expirationDateMiniSeconds
  })}`);

  console.log('orderInfo', orderInfo);
  console.log('makerTraits', orderInfo.data.makerTraits);
}

async function cancelOrder(makerTraits: string, orderHash: string) {
  try {
    const cancelOrder = await mainWalletClient.writeContract({
      address: domain.verifyingContract,
      abi: aggregatorAbi,
      functionName: 'cancelOrder',
      args: [makerTraits, orderHash],
      chain: avalanche
    });

    const filePath = path.resolve("./limitOrders.txt");
    const orderByTexts = await readFile(filePath, "utf-8");
    const orderTextByLines = orderByTexts.split("\n");
    console.log(orderTextByLines);

    const validDataOrders = orderTextByLines.filter(item => item.trim() !== '');
    const parsedDataOrders = validDataOrders.map(item => JSON.parse(item));
    const writeDataOrders = parsedDataOrders.filter(order => new Date(order.expiration).getTime() >= Date.now() || order.orderHash !== orderHash);
    console.log("writeDataOrders", writeDataOrders);

    await writeFile(filePath, '', 'utf-8');
    for (const order of writeDataOrders) {
      await fs.appendFile("limitOrders.txt", `\n${JSON.stringify(order)}`);
    }

    // console.log("cancel", cancelOrder);
    console.log('Cancel Order Done');
  } catch (err) {
    console.log(err);
  }
}

async function cancelOrders() {
  try {
    const filePath = path.resolve("./limitOrders.txt");
    const orderByTexts = await readFile(filePath, "utf-8");
    const orderTextByLines = orderByTexts.split("\n");
    console.log(orderTextByLines);

    const validDataOrders = orderTextByLines.filter(item => item.trim() !== '');
    const parsedDataOrders = validDataOrders.map(item => JSON.parse(item));
    const cancelDatas = parsedDataOrders.filter(order => new Date(order.expiration).getTime() >= Date.now())

    let makerTraits: string[] = []
    let orderHash: string[] = []
    for (const order of cancelDatas) {
      makerTraits.push(order.makerTraits);
      orderHash.push(order.orderHash);
    }

    console.log(makerTraits);
    console.log(orderHash);



    const cancelOrders = await mainWalletClient.writeContract({
      address: domain.verifyingContract,
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
}

