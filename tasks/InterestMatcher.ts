import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

const CONTRACT_NAME = "InterestMatcher";

task("task:address", "Prints the InterestMatcher address").setAction(async (_taskArguments: TaskArguments, hre) => {
  const { deployments } = hre;

  const deployment = await deployments.get(CONTRACT_NAME);
  console.log(`${CONTRACT_NAME} address is ${deployment.address}`);
});

task("task:list-players", "Lists all registered player addresses")
  .addOptionalParam("address", "Optionally provide a deployed InterestMatcher address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments } = hre;

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get(CONTRACT_NAME);

    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);
    const players = await contract.getRegisteredPlayers();

    if (players.length === 0) {
      console.log("No registered players yet");
      return;
    }

    console.log("Registered players:");
    players.forEach((player: string, index: number) => {
      console.log(`${index + 1}. ${player}`);
    });
  });

task("task:submit-preferences", "Submit encrypted interests for the caller")
  .addParam("values", "Comma separated interest identifiers, e.g. 1,4,7")
  .addOptionalParam("address", "Optionally provide a deployed InterestMatcher address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    const rawValues = (taskArguments.values as string).split(",").map((value) => parseInt(value.trim(), 10));
    if (rawValues.length !== 3 || rawValues.some((value) => !Number.isInteger(value))) {
      throw new Error("Provide exactly three integer interests using --values e.g. 1,4,7");
    }

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get(CONTRACT_NAME);

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const buffer = fhevm.createEncryptedInput(deployment.address, signer.address);
    rawValues.forEach((value) => buffer.add32(value));
    const encrypted = await buffer.encrypt();

    const tx = await contract
      .connect(signer)
      .submitPreferences(encrypted.handles[0], encrypted.handles[1], encrypted.handles[2], encrypted.inputProof);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:request-match", "Request an encrypted match indicator versus a candidate")
  .addParam("candidate", "Candidate address to compare against")
  .addOptionalParam("address", "Optionally provide a deployed InterestMatcher address")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get(CONTRACT_NAME);

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const encryptedResult = await contract.connect(signer).requestMatch(taskArguments.candidate as string);

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedResult,
      deployment.address,
      signer,
    );

    console.log(`Encrypted indicator: ${encryptedResult}`);
    console.log(`Match detected (1=yes,0=no): ${decrypted}`);
  });
