var RevertContract = artifacts.require("RevertContract");
var Links = artifacts.require("Links");
var LinksFrontrunning = artifacts.require("LinksFrontrunning");

module.exports = function(deployer) {
  deployer.deploy(RevertContract);
  deployer.deploy(Links);
  deployer.deploy(LinksFrontrunning);
};
