import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { InterestMatcher, InterestMatcher__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("InterestMatcher")) as InterestMatcher__factory;
  const contract = (await factory.deploy()) as InterestMatcher;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("InterestMatcher", function () {
  let signers: Signers;
  let contract: InterestMatcher;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2], carol: ethSigners[3] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("InterestMatcher tests require the mock FHEVM environment");
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  async function encryptPreferences(owner: HardhatEthersSigner, interests: number[]) {
    const input = fhevm.createEncryptedInput(contractAddress, owner.address);
    interests.forEach((interest) => input.add32(interest));
    return input.encrypt();
  }

  it("stores encrypted preferences", async function () {
    const encrypted = await encryptPreferences(signers.alice, [1, 2, 3]);

    await expect(
      contract
        .connect(signers.alice)
        .submitPreferences(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof),
    )
      .to.emit(contract, "PreferencesRegistered")
      .withArgs(signers.alice.address, anyValue);

    expect(await contract.hasPreferences(signers.alice.address)).to.eq(true);
  });

  it("returns encrypted match indicator when interests overlap", async function () {
    const alicePrefs = await encryptPreferences(signers.alice, [1, 2, 3]);
    await contract
      .connect(signers.alice)
      .submitPreferences(alicePrefs.handles[0], alicePrefs.handles[1], alicePrefs.handles[2], alicePrefs.inputProof);

    const bobPrefs = await encryptPreferences(signers.bob, [5, 6, 3]);
    await contract
      .connect(signers.bob)
      .submitPreferences(bobPrefs.handles[0], bobPrefs.handles[1], bobPrefs.handles[2], bobPrefs.inputProof);

    await expect(contract.connect(signers.alice).requestMatch(signers.bob.address))
      .to.emit(contract, "MatchComputed")
      .withArgs(signers.alice.address, signers.bob.address);

    const encrypted = await contract.getEncryptedMatch(signers.alice.address, signers.bob.address);
    const decrypted = await fhevm.userDecryptEuint(FhevmType.euint32, encrypted, contractAddress, signers.alice);

    expect(decrypted).to.eq(1);
  });

  it("returns encrypted zero when there is no shared interest", async function () {
    const bobPrefs = await encryptPreferences(signers.bob, [1, 4, 5]);
    await contract
      .connect(signers.bob)
      .submitPreferences(bobPrefs.handles[0], bobPrefs.handles[1], bobPrefs.handles[2], bobPrefs.inputProof);

    const carolPrefs = await encryptPreferences(signers.carol, [2, 3, 6]);
    await contract
      .connect(signers.carol)
      .submitPreferences(carolPrefs.handles[0], carolPrefs.handles[1], carolPrefs.handles[2], carolPrefs.inputProof);

    await expect(contract.connect(signers.bob).requestMatch(signers.carol.address))
      .to.emit(contract, "MatchComputed")
      .withArgs(signers.bob.address, signers.carol.address);

    const encrypted = await contract.getEncryptedMatch(signers.bob.address, signers.carol.address);
    const decrypted = await fhevm.userDecryptEuint(FhevmType.euint32, encrypted, contractAddress, signers.bob);

    expect(decrypted).to.eq(0);
  });

  it("reverts when requesting a match without preferences", async function () {
    await expect(contract.connect(signers.alice).requestMatch(signers.bob.address)).to.be.revertedWith(
      "Submit preferences first",
    );
  });

  it("reverts on self matching", async function () {
    const prefs = await encryptPreferences(signers.alice, [7, 8, 9]);
    await contract
      .connect(signers.alice)
      .submitPreferences(prefs.handles[0], prefs.handles[1], prefs.handles[2], prefs.inputProof);

    await expect(contract.connect(signers.alice).requestMatch(signers.alice.address)).to.be.revertedWith(
      "Self matching not allowed",
    );
  });
});
