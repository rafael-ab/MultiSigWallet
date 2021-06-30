const { assert, upgrades, ethers } = require("hardhat");
const { time } = require("@openzeppelin/test-helpers");

const toWei = (value, type) => web3.utils.toWei(String(value), type);

contract("MultiSigWallet (Proxy)", ([admin]) => {
  let multisig, adminSigner, proxyAdmin;

  before(async () => {
    adminSigner = await ethers.getSigner(admin);

    multisig = await ethers.getContractFactory("MultiSigWallet", adminSigner);

    instance = await upgrades.deployProxy(multisig, [[admin], 1]);

    proxyAdmin = await upgrades.admin.getInstance();
  });

  it("contract should initialize", async () => {
    assert.ok(await instance.isOwner(admin));
    assert.equal(1, await instance.required());
  });

  it("proxy admin should be the admin signer", async () => {
    assert.equal(admin, await proxyAdmin.owner());
  });
});
