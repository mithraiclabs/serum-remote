import * as fs from "fs";
import * as os from "os";
import { web3 } from "@project-serum/anchor";
import { DexInstructions, Market, OpenOrders } from "@project-serum/serum";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const loadPayer = (keypairPath: string): web3.Keypair => {
  if (keypairPath) {
    return web3.Keypair.fromSecretKey(
      Buffer.from(
        JSON.parse(
          fs.readFileSync(keypairPath, {
            encoding: "utf-8",
          })
        )
      )
    );
  } else if (process.env.SECRET_KEY) {
    return web3.Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.SECRET_KEY))
    );
  } else {
    throw new Error(
      "You must specify option --keypair or SECRET_KEY env variable"
    );
  }
};

const connection = new web3.Connection("https://api.devnet.solana.com");

const serumMarketKey = new web3.PublicKey(
  "9qa76HXPrkGDAV9P4kxbq7BTj3cFpTLHaZr8u4Py1fCR"
);

const DEX_ID = new web3.PublicKey(
  "DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY"
);

const keypairPath = `${os.homedir()}/.config/solana/devnet/id.json`;

(async () => {
  const payer = loadPayer(keypairPath);
  const serumMarket = await Market.load(connection, serumMarketKey, {}, DEX_ID);

  const [bids, asks] = await Promise.all([
    serumMarket.loadBids(connection),
    serumMarket.loadAsks(connection),
  ]);

  const lowestAsk = asks.getL2(5);
  const highestBid = bids.getL2(5);

  console.log("*** lowestAsk", lowestAsk, highestBid);

  // const ata = await Token.getAssociatedTokenAddress(
  //   ASSOCIATED_TOKEN_PROGRAM_ID,
  //   TOKEN_PROGRAM_ID,
  //   serumMarket.baseMintAddress,
  //   payer.publicKey,
  //   false
  // );

  // console.log("*** ata", ata.toString());

  // const openOrdersAccounts = await serumMarket.findOpenOrdersAccountsForOwner(
  //   connection,
  //   payer.publicKey
  // );

  // const instructions: web3.TransactionInstruction[] = [];
  // const signers: web3.Signer[] = [];

  // let openOrdersKey = openOrdersAccounts[0]?.publicKey;
  // if (!openOrdersKey) {
  //   const openOrdersKeypair = new web3.Keypair();
  //   const ix = await OpenOrders.makeCreateAccountTransaction(
  //     connection,
  //     serumMarket.address,
  //     payer.publicKey,
  //     openOrdersKeypair.publicKey,
  //     DEX_ID
  //   );
  //   instructions.push(ix);

  //   // const initOO = await DexInstructions.initOpenOrders({
  //   //   market: serumMarket.asksAddress,
  //   //   openOrders: openOrdersKeypair.publicKey,
  //   //   owner: payer.publicKey,
  //   //   programId: DEX_ID,
  //   //   marketAuthority: undefined,
  //   // });
  //   // instructions.push(initOO);

  //   openOrdersKey = openOrdersKeypair.publicKey;
  //   signers.push(openOrdersKeypair);
  // }

  // console.log("*** openOrdersAccounts", openOrdersKey);

  // const ix = await serumMarket.makeNewOrderV3Instruction({
  //   // @ts-ignore
  //   owner: payer,
  //   payer: ata,
  //   side: "sell",
  //   price: 38000,
  //   size: 10,
  //   orderType: "limit",
  //   openOrdersAddressKey: openOrdersKey,
  // });

  // instructions.push(ix);

  // const tx = new web3.Transaction();
  // instructions.forEach((ix) => tx.add(ix));
  // tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  // tx.feePayer = payer.publicKey;
  // const txId = await connection.sendTransaction(tx, [payer, ...signers], {
  //   skipPreflight: true,
  // });
  // console.log("** txId", txId);
})();
