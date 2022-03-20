import * as anchor from "@project-serum/anchor";
import { Program, web3 } from "@project-serum/anchor";
import { OpenOrders } from "@project-serum/serum";
import { assert } from "chai";
import { parseTranactionError } from "../packages/serum-remote/src";
import { initBoundedStrategyIx } from "../packages/serum-remote/src/instructions/initBoundedStrategy";
import { deriveAllBoundedStrategyKeys } from "../packages/serum-remote/src/pdas";
import { SerumRemote } from "../target/types/serum_remote";
import { createAssociatedTokenInstruction } from "./utils";

const usdcMint = new web3.PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
const solUsdcSerumMarketKey = new web3.PublicKey(
  "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT"
);
const DEX_ID = new web3.PublicKey(
  "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
);

let openOrdersAccount: web3.PublicKey;

/**
 * SerumMarket is in the current state Bids and Asks
 * [ [ 92.687, 300, <BN: 16a0f>, <BN: bb8> ] ] [ [ 92.75, 191.5, <BN: 16a4e>, <BN: 77b> ] ]
 */

describe("InitBoundedStrategy", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());
  const program = anchor.workspace.SerumRemote as Program<SerumRemote>;

  let boundPrice = new anchor.BN(957);
  let reclaimDate = new anchor.BN(new Date().getTime() / 1_000 + 3600);
  let reclaimAddress;
  let orderSide = 1;
  let bound = 1;

  before(async () => {
    const { instruction, associatedAddress } =
      await createAssociatedTokenInstruction(program.provider, usdcMint);
    reclaimAddress = associatedAddress;
    const transaction = new web3.Transaction().add(instruction);
    await program.provider.send(transaction);
  });
  beforeEach(async () => {
    boundPrice = new anchor.BN(957);
    reclaimDate = new anchor.BN(new Date().getTime() / 1_000 + 3600);
    orderSide = 1;
    bound = 1;
    const openOrdersKey = new web3.Keypair();
    const ix = await OpenOrders.makeCreateAccountTransaction(
      program.provider.connection,
      // This argument is pointless
      web3.SystemProgram.programId,
      // This argument is the payer for the rent
      program.provider.wallet.publicKey,
      openOrdersKey.publicKey,
      DEX_ID
    );
    openOrdersAccount = openOrdersKey.publicKey;
    const transaction = new web3.Transaction().add(ix);
    await program.provider.send(transaction, [openOrdersKey]);
  });

  // Test the BoundedStrategy account is created with the right info
  it("Should store all the information for a BoundedStretegy", async () => {
    const ix = await initBoundedStrategyIx(
      program,
      DEX_ID,
      solUsdcSerumMarketKey,
      usdcMint,
      openOrdersAccount,
      {
        boundPrice,
        reclaimDate,
        reclaimAddress,
        orderSide,
        bound,
      }
    );
    const transaction = new web3.Transaction().add(ix);
    try {
      await program.provider.send(transaction);
    } catch (error) {
      const parsedError = parseTranactionError(error);
      console.log("error: ", parsedError.msg);
      assert.ok(false);
    }

    const {
      boundedStrategy: boundedStrategyKey,
      authority,
      orderPayer,
    } = await deriveAllBoundedStrategyKeys(
      program,
      solUsdcSerumMarketKey,
      usdcMint,
      {
        boundPrice,
        reclaimDate,
        reclaimAddress,
        orderSide,
        bound,
      }
    );

    assert.ok(true);

    const boundedStrategy = await program.account.boundedStrategy.fetch(
      boundedStrategyKey
    );

    // Test that the information was stored on the BoundedStrategy account

    assert.equal(
      boundedStrategy.seurmMarket.toString(),
      solUsdcSerumMarketKey.toString()
    );
    assert.equal(boundedStrategy.authority.toString(), authority.toString());
    assert.equal(boundedStrategy.orderPayer.toString(), orderPayer.toString());
    assert.equal(
      boundedStrategy.boundedPrice.toString(),
      boundPrice.toString()
    );
    assert.equal(
      boundedStrategy.reclaimDate.toString(),
      reclaimDate.toString()
    );
    assert.equal(
      boundedStrategy.reclaimAddress.toString(),
      reclaimAddress.toString()
    );
    assert.equal(boundedStrategy.orderSide, orderSide);
    assert.equal(boundedStrategy.bound, bound);
    // Check the OpenOrders address
    assert.equal(
      boundedStrategy.openOrders.toString(),
      openOrdersAccount.toString()
    );

    const openOrders = await OpenOrders.load(
      program.provider.connection,
      openOrdersAccount,
      DEX_ID
    );
    assert.ok(openOrders);
  });

  // TODO: Test reclaim date is in the future
  describe("reclaimDate is in the past", () => {
    beforeEach(() => {
      reclaimDate = new anchor.BN(new Date().getTime() / 1_000 - 3600);
    });
    it("should error", async () => {
      const ix = await initBoundedStrategyIx(
        program,
        DEX_ID,
        solUsdcSerumMarketKey,
        usdcMint,
        openOrdersAccount,
        {
          boundPrice,
          reclaimDate,
          reclaimAddress,
          orderSide,
          bound,
        }
      );
      const transaction = new web3.Transaction().add(ix);
      try {
        await program.provider.send(transaction);
        assert.ok(false);
      } catch (error) {
        const parsedError = parseTranactionError(error);
        assert.equal(parsedError.msg, "Reclaim date must be in the future");
        assert.ok(true);
      }
    });
  });

  describe("bound price is 0", () => {
    beforeEach(() => {
      boundPrice = new anchor.BN(0);
    });
    it("should error", async () => {
      const ix = await initBoundedStrategyIx(
        program,
        DEX_ID,
        solUsdcSerumMarketKey,
        usdcMint,
        openOrdersAccount,
        {
          boundPrice,
          reclaimDate,
          reclaimAddress,
          orderSide,
          bound,
        }
      );
      const transaction = new web3.Transaction().add(ix);
      try {
        await program.provider.send(transaction);
        assert.ok(false);
      } catch (error) {
        const parsedError = parseTranactionError(error);
        assert.equal(parsedError.msg, "Bound price must be greater than 0");
        assert.ok(true);
      }
    });
  });
});
