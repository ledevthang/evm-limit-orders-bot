// add "type": "module" to your package.json to run this with node or name the file with extension .mjs to prevent writing existing .js files
import { LimitOrder, MakerTraits, Address, getLimitOrderContract, LimitOrderApiItem } from "@1inch/limit-order-sdk";
import { Wallet, JsonRpcProvider, Contract } from 'ethers';
import { Api, getLimitOrderV4Domain } from "@1inch/limit-order-sdk";
// import { AxiosProviderConnector } from "@1inch/limit-order-sdk/axios";

import { AxiosProviderConnector } from "./AxiosProviderConnector";

import dotenv from 'dotenv';
import { aggregatorAbi } from "./aggregatorAbi";
dotenv.config();

// ERC20 Token standard ABI for the approve function
const erc20AbiFragment = [
  "function approve(address spender, uint256 amount) external returns (bool)"
];

// it is a well-known test private key, do not use it in production
const chainId = 43114; // Chain ID for AVAX
const headers = { headers: { Authorization: `Bearer ${process.env.API_1INCH_KEY}`, accept: "application/json, text/plain, */*" } };
const maker = new Wallet(process.env.PRIVATE_KEY as string);
const expiresIn = 600n // 5m
const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn

const makerAsset = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"; // WAVAX
const takerAsset = "0xd586e7f844cea2f87f50152665bcbc2c279d8d70";  // DAI
const makingAmount = 100000000000000000n;
const takingAmount = 354591303896920600n;

//Orders must call the approve function prior to being submitted
// Initialize ethers provider
const provider = new JsonRpcProvider(`https://avax-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`);
const makerWallet = maker.connect(provider);

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
  .withNonce(1n)
  .allowPartialFills() // If you wish to allow partial fills
  .allowMultipleFills(); // And assuming multiple fills are also okay

// console.log(typedData);

(async () => {
  const order = new LimitOrder({
    makerAsset: new Address(makerAsset),
    takerAsset: new Address(takerAsset),
    makingAmount: makingAmount,
    takingAmount: takingAmount,
    maker: new Address(maker.address),
    salt: BigInt(Math.floor(Math.random() * 100000000)),
    receiver: new Address(maker.address),
  }, makerTraits);

  const typedData = order.getTypedData(domain)
  const converted = { ...typedData.domain, chainId: chainId } // convert chainId to string, because ethers wants a bignumberish value
  const signature = await maker.signTypedData(
    converted,
    { Order: typedData.types.Order },
    typedData.message
  )

  // approve aggregator contract that can transfer makingAmount
  // await approve();

  // get order by hash
  const orderHash = order.getOrderHash(chainId)
  console.log(orderHash);

  // submit order 
  // const orderInfo = await submitOrder(api, order, signature, orderHash);

  // orderHash
  // 0xb57f56caa0ce88ea96e300375a7935cb3e0965a6bd28d29cd97f51e445fd3152
  //0xaf32dcd170b80cfcadfb96e44ed36f57b75b008e963c84950d955d11c77e4f95
  //0x017ec99296a350ed00ad6c66d48f8e95c10c360658f63e68b939fde8ff8bf627
  //0x294973fc68025f4ad9d181d7a0f150629e95a05684cfa7839cd38940eae78549

  // makerTraits
  //0x40000000000000000000000000000000000067443e4a00000000000000000000
  //0x40000000000000000000000000000000000067443f3500000000000000000000
  //0x4000000000000000000000000000000000006744412200000000000000000000
  //0x4000000000000000000000000000000000006744414000000000000000000000

  // // Cancel limit order
  // await cancelOrder(orderInfo.data.makerTraits, orderHash);
  // const cancel = await cancelOrder('0x4000000000000000000000000000000001006744448d00000000000000000000', '0xd845e58f765976f5d9401dd70fe5b70a97b4adc0c745adae961a7e98061222a4');

  // Cancel limit orders
  // const makerTraits: any = ['0x4000000000000000000000000000000000006744412200000000000000000000', '0x4000000000000000000000000000000000006744414000000000000000000000'];
  // const orderHashes: any = ['0x017ec99296a350ed00ad6c66d48f8e95c10c360658f63e68b939fde8ff8bf627', '0x294973fc68025f4ad9d181d7a0f150629e95a05684cfa7839cd38940eae78549'];
  // await cancelOrders(makerTraits, orderHashes);


})();

async function approve() {
  // console.log('Approving makerAsset spend...', domain.verifyingContract, makerAsset);
  try {
    const makerAssetContract = new Contract(makerAsset, erc20AbiFragment, makerWallet);
    const approveTx = await makerAssetContract.approve(domain.verifyingContract, makingAmount);
    await approveTx.wait(); // Wait for the transaction to be mined
    console.log('Approval successful');
  } catch (error) {
    console.error('Error in approving makerAsset spend:', error);
    return { success: false, reason: "Failed to approve makerAsset spend." };
  }
}

async function submitOrder(api: Api, order: LimitOrder, signature: string, orderHash: string): Promise<LimitOrderApiItem> {
  try {
    // @1inch/limit-order-sdk/dist/api/api.js, must edit the `submitOrder` method to return the promise
    await api.submitOrder(order, signature);
  } catch (e) {
    console.log(e);
  }

  // must wait at least 1.05 seconds after submitting the order to query it
  await new Promise(resolve => setTimeout(resolve, 2050));

  const orderInfo = await api.getOrderByHash(orderHash);
  console.log('orderInfo', orderInfo);
  console.log('makerTraits', orderInfo.data.makerTraits);

  return orderInfo;
}

async function cancelOrder(makerTraits: string, orderHash: string) {
  try {
    // const contractAddress = getLimitOrderContract(chainId);
    const aggregatorContract = new Contract(domain.verifyingContract, aggregatorAbi, makerWallet);
    // console.log("aggregatorContract", aggregatorContract);

    const cancelOrder = await aggregatorContract.cancelOrder(makerTraits, orderHash);
    const cancel = await cancelOrder.wait(); // Wait for the transaction to be mined
    console.log("cancel", cancel);
    console.log('Cancel Order Done');
  } catch (err) {
    console.log(err);
  }
}

async function cancelOrders(makerTraits: string[], orderHash: string[]) {
  try {
    // const contractAddress = getLimitOrderContract(chainId);
    const aggregatorContract = new Contract(domain.verifyingContract, aggregatorAbi, makerWallet);

    const cancelOrders = await aggregatorContract.cancelOrders(makerTraits, orderHash);
    const cancels = await cancelOrders.wait(); // Wait for the transaction to be mined
    console.log("cancels", cancels);
    console.log('Cancel Orders Done');
  } catch (err) {
    console.log(err);
  }
}

