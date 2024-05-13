import { test, describe, expect, beforeAll, beforeEach } from "vitest"
import {
    ENTRYPOINT_ADDRESS_V06,
    BundlerClient,
    ENTRYPOINT_ADDRESS_V07
} from "permissionless"
import {
    beforeEachCleanUp,
    getBundlerClient,
    getSmartAccountClient,
    sendBundleNow,
    setBundlingMode
} from "../src/utils"
import { foundry } from "viem/chains"
import {
    createPublicClient,
    createTestClient,
    http,
    parseEther,
    parseGwei
} from "viem"
import { ANVIL_RPC } from "../src/constants"

const anvilClient = createTestClient({
    chain: foundry,
    mode: "anvil",
    transport: http(ANVIL_RPC)
})

const publicClient = createPublicClient({
    transport: http(ANVIL_RPC),
    chain: foundry
})

describe.each([
    { entryPoint: ENTRYPOINT_ADDRESS_V06, version: "v0.6" },
    { entryPoint: ENTRYPOINT_ADDRESS_V07, version: "v0.7" }
])("$version supports eth_sendUserOperation", ({ entryPoint }) => {
    let bundlerClient: BundlerClient<typeof entryPoint>

    beforeAll(async () => {
        bundlerClient = getBundlerClient(entryPoint)
    })

    beforeEach(async () => {
        await beforeEachCleanUp()
    })

    test("Send UserOperation", async () => {
        const smartAccountClient = await getSmartAccountClient({
            entryPoint
        })
        const smartAccount = smartAccountClient.account

        const to = "0x23B608675a2B2fB1890d3ABBd85c5775c51691d5"
        const value = parseEther("0.15")

        const op = await smartAccountClient.prepareUserOperationRequest({
            userOperation: {
                callData: await smartAccount.encodeCallData({
                    to,
                    value,
                    data: "0x"
                })
            }
        })
        op.signature = await smartAccount.signUserOperation(op)

        const hash = await bundlerClient.sendUserOperation({
            userOperation: op
        })

        await new Promise((resolve) => setTimeout(resolve, 1500))

        await bundlerClient.waitForUserOperationReceipt({ hash })

        expect(
            await publicClient.getBalance({ address: to })
        ).toBeGreaterThanOrEqual(value)
    })

    test("Replace mempool transaction", async () => {
        const smartAccountClient = await getSmartAccountClient({
            entryPoint
        })
        const smartAccount = smartAccountClient.account

        await anvilClient.setAutomine(false)
        await anvilClient.mine({ blocks: 1 })

        const to = "0x23B608675a2B2fB1890d3ABBd85c5775c51691d5"
        const value = parseEther("0.15")

        const op = await smartAccountClient.prepareUserOperationRequest({
            userOperation: {
                callData: await smartAccount.encodeCallData({
                    to,
                    value,
                    data: "0x"
                })
            }
        })
        op.signature = await smartAccount.signUserOperation(op)

        const hash = await bundlerClient.sendUserOperation({
            userOperation: op
        })

        await new Promise((resolve) => setTimeout(resolve, 1500))

        // increase next block base fee whilst current tx is in mempool
        await anvilClient.setNextBlockBaseFeePerGas({
            baseFeePerGas: parseGwei("150")
        })
        await anvilClient.mine({ blocks: 1 })
        await new Promise((resolve) => setTimeout(resolve, 2500))

        // check that no tx was mined
        let opReceipt = await bundlerClient.getUserOperationReceipt({
            hash
        })
        expect(opReceipt).toBeNull()

        // new block should trigger alto's mempool to replace the eoa tx with too low gasPrice
        await anvilClient.mine({ blocks: 1 })
        await new Promise((resolve) => setTimeout(resolve, 1500))

        opReceipt = await bundlerClient.getUserOperationReceipt({
            hash
        })

        expect(opReceipt?.success).equal(true)
        expect(
            await publicClient.getBalance({ address: to })
        ).toBeGreaterThanOrEqual(value)
    })

    test("Send multiple UserOperations", async () => {
        const firstClient = await getSmartAccountClient({
            entryPoint
        })
        const secondClient = await getSmartAccountClient({
            entryPoint
        })

        const to = "0x23B608675a2B2fB1890d3ABBd85c5775c51691d5"
        const value = parseEther("0.15")

        // create sender op
        const firstOp = await firstClient.prepareUserOperationRequest({
            userOperation: {
                callData: await firstClient.account.encodeCallData({
                    to,
                    value: value,
                    data: "0x"
                })
            }
        })

        firstOp.signature = await firstClient.account.signUserOperation(firstOp)

        // create relayer op
        const secondOp = await secondClient.prepareUserOperationRequest({
            userOperation: {
                callData: await secondClient.account.encodeCallData({
                    to,
                    value,
                    data: "0x"
                })
            }
        })

        secondOp.signature =
            await secondClient.account.signUserOperation(secondOp)

        await setBundlingMode("manual")

        const firstHash = await bundlerClient.sendUserOperation({
            userOperation: firstOp
        })
        const secondHash = await bundlerClient.sendUserOperation({
            userOperation: secondOp
        })

        expect(
            await bundlerClient.getUserOperationReceipt({
                hash: firstHash
            })
        ).toBeNull()
        expect(
            await bundlerClient.getUserOperationReceipt({
                hash: secondHash
            })
        ).toBeNull()

        await sendBundleNow()

        expect(
            (
                await bundlerClient.waitForUserOperationReceipt({
                    hash: firstHash
                })
            ).success
        ).toEqual(true)
        expect(
            (
                await bundlerClient.waitForUserOperationReceipt({
                    hash: secondHash
                })
            ).success
        ).toEqual(true)

        expect(
            await publicClient.getBalance({ address: to })
        ).toBeGreaterThanOrEqual(value * 2n)
    })
})
