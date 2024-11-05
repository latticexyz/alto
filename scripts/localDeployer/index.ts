import {
  http,
  createWalletClient,
  createPublicClient,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ENTRY_POINT_SIMULATIONS_CREATECALL,
  ENTRY_POINT_SIMULATIONS_ADDRESS,
  ENTRY_POINT_V06_CREATECALL,
  ENTRY_POINT_V06_ADDRESS,
  ENTRY_POINT_V07_CREATECALL,
  ENTRY_POINT_V07_ADDRESS,
  SIMPLE_ACCOUNT_FACTORY_V06_CREATECALL,
  SIMPLE_ACCOUNT_FACTORY_V06_ADDRESS,
  SIMPLE_ACCOUNT_FACTORY_V07_CREATECALL,
  SIMPLE_ACCOUNT_FACTORY_V07_ADDRESS,
  DETERMINISTIC_DEPLOYER,
} from "./constants";

if (!process.env.RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) {
  throw new Error(
    "RPC_URL and DEPLOYER_PRIVATE_KEY environment variables must be set"
  );
}

const publicClient = createPublicClient({
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex),
  transport: http(process.env.RPC_URL),
});

const isDeployed = async (address: Address): Promise<boolean> => {
  const bytecode = await publicClient.getBytecode({
    address,
  });
  return bytecode !== undefined;
};

const ensureDeployed = async (
  address: Address,
  deploy: () => Promise<Hex>
): Promise<void> => {
  if (!(await isDeployed(address))) {
    const txHash = await deploy();
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (!(await isDeployed(address))) {
      throw new Error(`Failed to deploy ${address}`);
    }
  }
};

const main = async () => {
  // biome-ignore lint/suspicious/noConsoleLog: []
  console.log("========== DEPLOYING V0.7 CORE CONTRACTS ==========");

  const txs: Promise<void>[] = [];

  await ensureDeployed(ENTRY_POINT_V07_ADDRESS, () => {
    console.log("Deploying EntryPoint V0.7");
    return walletClient.sendTransaction({
      chain: null,
      to: DETERMINISTIC_DEPLOYER,
      data: ENTRY_POINT_V07_CREATECALL,
      gas: 15_000_000n,
    });
  });

  await ensureDeployed(SIMPLE_ACCOUNT_FACTORY_V07_ADDRESS, () => {
    console.log("Deploying SimpleAccountFactory v0.7");
    return walletClient.sendTransaction({
      chain: null,
      to: DETERMINISTIC_DEPLOYER,
      data: SIMPLE_ACCOUNT_FACTORY_V07_CREATECALL,
      gas: 15_000_000n,
    });
  });

  await ensureDeployed(ENTRY_POINT_SIMULATIONS_ADDRESS, () => {
    console.log("Deploying EntryPointSimulations");
    return walletClient.sendTransaction({
      chain: null,
      to: DETERMINISTIC_DEPLOYER,
      data: ENTRY_POINT_SIMULATIONS_CREATECALL,
      gas: 15_000_000n,
    });
  });

  // biome-ignore lint/suspicious/noConsoleLog: []
  console.log("========== DEPLOYING V0.6 CORE CONTRACTS ==========");

  await ensureDeployed(ENTRY_POINT_V06_ADDRESS, () => {
    console.log("Deploying EntryPoint v0.6");
    return walletClient.sendTransaction({
      chain: null,
      to: DETERMINISTIC_DEPLOYER,
      data: ENTRY_POINT_V06_CREATECALL,
      gas: 15_000_000n,
    });
  });

  await ensureDeployed(SIMPLE_ACCOUNT_FACTORY_V06_ADDRESS, () => {
    console.log("Deploying SimpleAccountFactory v0.6");
    return walletClient.sendTransaction({
      chain: null,
      to: DETERMINISTIC_DEPLOYER,
      data: SIMPLE_ACCOUNT_FACTORY_V06_CREATECALL,
      gas: 15_000_000n,
    });
  });

  console.log("Done!");
};

main();
