# Burner Wallet Smart Contract Audit

Remove destination from signed hash. Testing against frontrunning.
## Tests

#### Requirements
* [NodeJS/LTS](https://nodejs.org/en/download/package-manager/)
* [Truffle Framework](https://truffleframework.com/truffle)

```sh
$ npm install
$ ganache-cli --networkId=1337 --port=9545 --blockTime=5 
$ truffle test --network local_dev
```