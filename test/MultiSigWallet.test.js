const MultiSigWallet = artifacts.require("MultiSigWallet");
const { assert, web3 } = require("hardhat");
const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

// Account Address
const PLAYER1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat Account 0
const PLAYER1_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PLAYER2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Hardhat Account 1
const PLAYER2_PK =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const PLAYER3 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Hardhat Account 2
const PLAYER3_PK =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

// Helpers
const toWei = (value, type) => web3.utils.toWei(String(value), type);
const fromWei = (value, type) =>
  Number(web3.utils.fromWei(String(value), type));
const toBN = (value) => web3.utils.toBN(String(value));
const toDecimals = (value, decimals) =>
  (Number(value) / 10 ** decimals).toFixed(decimals);

contract("MultiSigWallet", ([owner1, owner2, owner3, owner4, funder]) => {
  let multisig;

  before(async () => {
    multisig = await MultiSigWallet.new();
    multisig.initialize([owner1, owner2], 2);

    await multisig.deposit({ from: funder, value: toWei(5000) });
  });

  it("should add a new owner via multisig", async () => {
    console.log(
      "    ------------------------------------------------------------------"
    );

    const data = web3.eth.abi.encodeFunctionCall(
      {
        name: "addOwner",
        type: "function",
        inputs: [
          {
            type: "address",
            name: "owner",
          },
        ],
      },
      [owner3]
    );

    const tx1 = await multisig.submitTransaction(multisig.address, 0, data, {
      from: owner1,
    });

    await expectEvent(tx1, "Submission", {
      transactionId: "0",
    });

    const tx2 = await multisig.confirmTransaction(0, { from: owner1 });

    await expectEvent(tx2, "Confirmation", {
      sender: owner1,
      transactionId: "0",
    });

    await expectRevert(
      multisig.executeTransaction(0, { from: owner1 }),
      "MultiSigWallet: TX_NOT_CONFIRMED"
    );

    const tx3 = await multisig.confirmTransaction(0, { from: owner2 });

    await expectEvent(tx3, "Confirmation", {
      sender: owner2,
      transactionId: "0",
    });

    await expectRevert(
      multisig.executeTransaction(0, { from: owner4 }),
      "MultiSigWallet: OWNER_NOT_EXISTS"
    );

    const tx4 = await multisig.executeTransaction(0, { from: owner1 });

    await expectEvent(tx4, "Execution", {
      transactionId: "0",
    });

    assert.ok(await multisig.isOwner(owner3));

    console.log(
      "\tGas Used :>> ",
      tx1.receipt.gasUsed +
        tx2.receipt.gasUsed +
        tx3.receipt.gasUsed +
        tx4.receipt.gasUsed
    );
  });

  it("should send some ether via multisig", async () => {
    console.log(
      "    ------------------------------------------------------------------"
    );

    const balanceBefore = await web3.eth.getBalance(owner3);

    console.log(
      "\tOwner3 Ether Balance \t\t(Before) :>> ",
      toDecimals(balanceBefore, 18)
    );

    const data = "0x";

    const amount = toWei(1000);

    const tx1 = await multisig.submitTransaction(owner3, amount, data);

    await expectEvent(tx1, "Submission", {
      transactionId: "1",
    });

    const tx2 = await multisig.confirmTransaction(1, { from: owner1 });

    await expectEvent(tx2, "Confirmation", {
      sender: owner1,
      transactionId: "1",
    });

    await expectRevert(
      multisig.executeTransaction(1, { from: owner1 }),
      "MultiSigWallet: TX_NOT_CONFIRMED"
    );

    const tx3 = await multisig.confirmTransaction(1, { from: owner2 });

    await expectEvent(tx3, "Confirmation", {
      sender: owner2,
      transactionId: "1",
    });

    await expectRevert(
      multisig.executeTransaction(1, { from: owner4 }),
      "MultiSigWallet: OWNER_NOT_EXISTS"
    );

    const tx4 = await multisig.executeTransaction(1, { from: owner1 });

    await expectEvent(tx4, "Execution", {
      transactionId: "1",
    });

    const balanceAfter = await web3.eth.getBalance(owner3);

    assert.equal(amount, balanceAfter - balanceBefore);

    console.log(
      "\tOwner3 Ether Balance \t\t(After) :>> ",
      toDecimals(balanceAfter, 18)
    );

    console.log(
      "\tGas Used :>> ",
      tx1.receipt.gasUsed +
        tx2.receipt.gasUsed +
        tx3.receipt.gasUsed +
        tx4.receipt.gasUsed
    );
  });

  it("should change requirement via multisig", async () => {
    console.log(
      "    ------------------------------------------------------------------"
    );

    const required = 3;

    const data = web3.eth.abi.encodeFunctionCall(
      {
        name: "changeRequirement",
        type: "function",
        inputs: [
          {
            type: "uint256",
            name: "_required",
          },
        ],
      },
      [required]
    );

    const tx1 = await multisig.submitTransaction(multisig.address, 0, data, {
      from: owner1,
    });

    await expectEvent(tx1, "Submission", {
      transactionId: "2",
    });

    const tx2 = await multisig.confirmTransaction(2, { from: owner1 });

    await expectEvent(tx2, "Confirmation", {
      sender: owner1,
      transactionId: "2",
    });

    await expectRevert(
      multisig.executeTransaction(2, { from: owner1 }),
      "MultiSigWallet: TX_NOT_CONFIRMED"
    );

    const tx3 = await multisig.confirmTransaction(2, { from: owner3 });

    await expectEvent(tx3, "Confirmation", {
      sender: owner3,
      transactionId: "2",
    });

    await expectRevert(
      multisig.executeTransaction(2, { from: owner4 }),
      "MultiSigWallet: OWNER_NOT_EXISTS"
    );

    const tx4 = await multisig.executeTransaction(2, { from: owner1 });

    await expectEvent(tx4, "Execution", {
      transactionId: "2",
    });

    assert.equal(required, await multisig.required());

    console.log(
      "\tGas Used :>> ",
      tx1.receipt.gasUsed +
        tx2.receipt.gasUsed +
        tx3.receipt.gasUsed +
        tx4.receipt.gasUsed
    );
  });

  it("should remove an owner via multisig", async () => {
    console.log(
      "    ------------------------------------------------------------------"
    );

    const required = 3;

    const data = web3.eth.abi.encodeFunctionCall(
      {
        name: "removeOwner",
        type: "function",
        inputs: [
          {
            type: "address",
            name: "owner",
          },
        ],
      },
      [owner1]
    );

    const tx1 = await multisig.submitTransaction(multisig.address, 0, data, {
      from: owner1,
    });

    await expectEvent(tx1, "Submission", {
      transactionId: "3",
    });

    const tx2 = await multisig.confirmTransaction(3, { from: owner1 });

    await expectEvent(tx2, "Confirmation", {
      sender: owner1,
      transactionId: "3",
    });

    await expectRevert(
      multisig.executeTransaction(3, { from: owner1 }),
      "MultiSigWallet: TX_NOT_CONFIRMED"
    );

    const tx3 = await multisig.confirmTransaction(3, { from: owner3 });

    await expectEvent(tx3, "Confirmation", {
      sender: owner3,
      transactionId: "3",
    });

    const tx4 = await multisig.confirmTransaction(3, { from: owner2 });

    await expectEvent(tx4, "Confirmation", {
      sender: owner2,
      transactionId: "3",
    });

    await expectRevert(
      multisig.executeTransaction(3, { from: owner4 }),
      "MultiSigWallet: OWNER_NOT_EXISTS"
    );

    const tx5 = await multisig.executeTransaction(3, { from: owner1 });

    await expectEvent(tx5, "Execution", {
      transactionId: "3",
    });

    assert.ok(!(await multisig.isOwner(owner1)));

    const owners = await multisig.getOwners();
    assert.equal(2, owners.length);

    console.log(
      "\tGas Used :>> ",
      tx1.receipt.gasUsed +
        tx2.receipt.gasUsed +
        tx3.receipt.gasUsed +
        tx4.receipt.gasUsed +
        tx5.receipt.gasUsed
    );
  });
});
