//HD Wallet for keyless servers (infura)
const HDWalletProvider = require("truffle-hdwallet-provider");
const ganacheRPC = require("ganache-cli");

let provider

function getNmemonic() {
  try{
    return require('fs').readFileSync("./seed", "utf8").trim();
  } catch(err){
    return "";
  }
}

function getProvider(rpcUrl) {
  if (!provider) {
    provider = new HDWalletProvider(getNmemonic(), rpcUrl)
  }
  return provider
}


module.exports = {
  compilers: {
    solc: {
      version: "0.4.25",
      optimizer: {
        enabled: false,
        runs: 200
      }
    }
  },
  networks: {
    ganache: {
      get provider() {
        if (!provider) {
          provider = ganacheRPC.provider({total_accounts: 10, network_id: 35, gasLimit:8000000, gasPrice: 1000000000})
        }
        return provider
      },
      network_id: 35,
      gas: 8000000,
      gasPrice: 1000000000
    },
    local_dev: { 
      host: "localhost",
      network_id: 1337,
      port: 9545,
      gas: 6283185, //geth --dev gas limit is 6283185
      gasPrice: 1000000000
    },
    ropsten: {
      get provider() {
        return getProvider("https://ropsten.infura.io/")
      },
      gas: 4004580,
      network_id: 3
    },
    rinkeby: {
      get provider() {
        return getProvider("https://rinkeby.infura.io/")
      },
      network_id: 4
    },
    mainnet: {
      get provider() {
        return getProvider("https://mainnet.infura.io/")
      },
      gas: 1704580,
      gasPrice: 1000000000,
      network_id: 1
    },
    sokol: {
      get provider() {
        return getProvider("https://sokol.poa.network/")
      },
      gas: 8000000,
      gasPrice: 1000000000,
      network_id: 77
    },
    poa: {
      get provider() {
        return getProvider("https://core.poa.network")
      },
      gas: 1704580,
      gasPrice: 1000000000,
      network_id: 99
    },
    dai: {
      get provider() {
        return getProvider("https://dai.poa.network")
      },
      gas: 1704580,
      gasPrice: 1000000000,
      network_id: 100
    }
  }
};
