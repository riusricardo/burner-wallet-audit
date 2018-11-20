# Burner Wallet Smart Contract Audit

The audited code is located in the github.com/riusricardo/burner-wallet-audit/blob/master/contracts/LinksOriginal.sol file, which is a copy of the original code found at github.com/austintgriffith/burner-wallet/blob/master/contracts/Links/Links.sol. 
Commit: f8fd5473974c30fd20f1a0b646d19f80e6f47271.

Here is the assessment and observations on possible improvements, in order of importance.

## Critical Severity
* *Replay attack* - This bug is present on every send transaction. Funds with the same signer will be able to access other funds even if the original desired destination address is different.

* *Invalid signature attack* - recoverSigner function returns address 0x0 if the signature's lenght is different from 65 or it contains an incorrect signature version.

## High Severity
* *Insecure call to external contracts* - Sending value to a destination address without limiting gas, creates the possibility to call another contract address and manipulate the execution flow.

* *Gas Limit DoS on the Network via Block Stuffing* - The use of a time / blocks restriction limits the chances to claim a fund. The expiration of the funds can lock the value if a successful transaction can not enter the main network before the time / blocks limit.
This attack can be done on purpose to lock the fund by filling almost all the gas of the blocks and not letting any claim transaction to go on.

## Medium Severity

* *Off chain doble signing* - Burner wallets are used to create off-chain transactions. If a signer creates many signatures for different users without creating a new fund, only the first user to claim will be able to get the correct balance.

### Notes & Additional Information

LinksFixes.sol file contains tested fixes for:
* Replay attack
* Invalid signature attack
* Insecure call to external contracts
* Gas Limit DoS on the Network via Block Stuffing


## Tests

#### Requirements
* [NodeJS/LTS](https://nodejs.org/en/download/package-manager/)
* [Truffle Framework](https://truffleframework.com/truffle)

```sh
$ npm install
$ truffle test --network ganache
```