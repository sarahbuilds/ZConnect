import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { InterestMatcher } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("InterestMatcherSepolia", function () {
  let signers: Signers;
  let contract: InterestMatcher;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("InterestMatcher");
      contractAddress = deployment.address;
      contract = (await ethers.getContractAt("InterestMatcher", deployment.address)) as InterestMatcher;
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0], bob: ethSigners[1] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("confirms encrypted match on Sepolia deployment", async function () {
    steps = 9;

    this.timeout(4 * 40000);

    progress("Encrypting Alice interests");
    const aliceInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(1)
      .add32(4)
      .add32(7)
      .encrypt();

    progress("Submitting Alice preferences");
    let tx = await contract
      .connect(signers.alice)
      .submitPreferences(aliceInput.handles[0], aliceInput.handles[1], aliceInput.handles[2], aliceInput.inputProof);
    await tx.wait();

    progress("Encrypting Bob interests");
    const bobInput = await fhevm
      .createEncryptedInput(contractAddress, signers.bob.address)
      .add32(2)
      .add32(7)
      .add32(9)
      .encrypt();

    progress("Submitting Bob preferences");
    tx = await contract
      .connect(signers.bob)
      .submitPreferences(bobInput.handles[0], bobInput.handles[1], bobInput.handles[2], bobInput.inputProof);
    await tx.wait();

    progress("Requesting match");
    const encryptedMatch = await contract.connect(signers.alice).requestMatch(signers.bob.address);

    progress("Decrypting match result");
    const clearMatch = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedMatch, contractAddress, signers.alice);

    expect(clearMatch).to.eq(1);
  });
});
