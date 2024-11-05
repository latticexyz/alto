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
  name: string,
  address: Address,
  deploy: () => Promise<Hex>
): Promise<void> => {
  console.log(`Checking if ${name} is deployed...`);
  if (await isDeployed(address)) {
    console.log(`${name} is already deployed`);
    return;
  }

  console.log(`Deploying ${name}...`);
  const txHash = await deploy();
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (await isDeployed(address)) {
    console.log(`Successfully deployed ${name}`);
  } else {
    throw new Error(`Failed to deploy ${name}`);
  }
};

const main = async () => {
  // biome-ignore lint/suspicious/noConsoleLog: []
  console.log("========== DEPLOYING V0.7 CORE CONTRACTS ==========");

  const txs: Promise<void>[] = [];

  await ensureDeployed("EntryPoint V0.7", ENTRY_POINT_V07_ADDRESS, () => {
    return walletClient.sendTransaction({
      chain: null,
      to: DETERMINISTIC_DEPLOYER,
      data: ENTRY_POINT_V07_CREATECALL,
      gas: 15_000_000n,
    });
  });

  await ensureDeployed(
    "SimpleAccountFactory V0.7",
    SIMPLE_ACCOUNT_FACTORY_V07_ADDRESS,
    () => {
      return walletClient.sendTransaction({
        chain: null,
        to: DETERMINISTIC_DEPLOYER,
        data: SIMPLE_ACCOUNT_FACTORY_V07_CREATECALL,
        gas: 15_000_000n,
      });
    }
  );

  await ensureDeployed(
    "EntryPointSimulations",
    ENTRY_POINT_SIMULATIONS_ADDRESS,
    () => {
      return walletClient.sendTransaction({
        chain: null,
        to: DETERMINISTIC_DEPLOYER,
        data: ENTRY_POINT_SIMULATIONS_CREATECALL,
        gas: 15_000_000n,
      });
    }
  );

  await ensureDeployed("EntryPoint V0.6", ENTRY_POINT_V06_ADDRESS, () => {
    return walletClient.sendTransaction({
      chain: null,
      to: DETERMINISTIC_DEPLOYER,
      data: ENTRY_POINT_V06_CREATECALL,
      gas: 15_000_000n,
    });
  });

  await ensureDeployed(
    "SimpleAccountFactory V0.6",
    SIMPLE_ACCOUNT_FACTORY_V06_ADDRESS,
    () => {
      return walletClient.sendTransaction({
        chain: null,
        to: DETERMINISTIC_DEPLOYER,
        data: SIMPLE_ACCOUNT_FACTORY_V06_CREATECALL,
        gas: 15_000_000n,
      });
    }
  );

  console.log("Done!");
};

main();
