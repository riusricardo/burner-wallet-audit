var RevertContract = artifacts.require("RevertContract");
var LinksOriginal = artifacts.require("LinksOriginal");
var LinksFixes = artifacts.require("LinksFixes");

module.exports = function(deployer) {
  deployer.deploy(RevertContract);
  deployer.deploy(LinksOriginal);
  deployer.deploy(LinksFixes);
};
