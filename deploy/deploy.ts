import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedInterestMatcher = await deploy("InterestMatcher", {
    from: deployer,
    log: true,
  });

  console.log(`InterestMatcher contract: `, deployedInterestMatcher.address);
};
export default func;
func.id = "deploy_interestMatcher"; // id required to prevent reexecution
func.tags = ["InterestMatcher"];
