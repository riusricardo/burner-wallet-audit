var Web3_1 = require('web3')
var web3_1 = new Web3_1()
web3_1.setProvider(web3.currentProvider)

var Links = artifacts.require("Links");
var RevertContract = artifacts.require("RevertContract");

//Hacks for web3@1.0 support in truffle tests.
Links.currentProvider.sendAsync = function() {
  return Links.currentProvider.send.apply(Links.currentProvider, arguments);
};
RevertContract.currentProvider.sendAsync = function() {
  return RevertContract.currentProvider.send.apply(RevertContract.currentProvider, arguments);
};

contract('Links', function(accounts) {
  let instance,attackSig
  const value = 0.2*10**18;
  const user1 = accounts[0];
  const user2 = accounts[1];
  const badBoy = accounts[4];
  const signer1 = web3_1.eth.accounts.create(web3_1.utils.randomHex(32));
  const claimId1 = web3_1.utils.randomHex(32);
  const claimId2 = web3_1.utils.randomHex(32);
  const faultyId = web3_1.utils.randomHex(32);

  before(async () => {
    instance = await Links.deployed()
  })

  describe('1) Create new fund. signer1 -> user2.', () => {
    let tx,signedMessage,signature
    before(async () => {
        signedMessage = web3_1.eth.accounts.sign(claimId1, signer1.privateKey)
        signature = signedMessage.signature
        tx = await instance.createFund(claimId1,signature,{from: user1, value:value})
        block = await web3_1.eth.getBlockNumber()
    })
    it('should emit Send event', () => {
      assert.equal(tx.logs[0].event, 'Sent')
    })
    it('should create fund with correct parameters',async () => {
      const fund = await instance.funds(claimId1,{from: user1})
      assert.equal(fund[0], user1) // msg.sender
      assert.equal(fund[1], signer1.address) // signer
      assert.equal(fund[2], value) // value
      assert.equal(fund[3], 1) // nonce
      assert.equal(fund[4], false) // claimed/status
    })
  })

  describe('2) Claim fund value as user2.', () => {
    let tx,signedMessage,signature,destination,message,initialBalance
    let initial,final,gasPrice,transaction// used for gas measurement
    before(async () => {
        destination = accounts[9] // User2 destination address
        message = web3_1.utils.soliditySha3(
          {type: 'bytes32', value: claimId1}, // fund id
          {type: 'address', value: destination}, // destination address
          {type: 'uint256', value: 1}, // nonce
          {type: 'address', value: Links.address} // contract address
        )
        signedMessage = web3_1.eth.accounts.sign(message, signer1.privateKey)
        signature = signedMessage.signature
        attackSig = signature; // Used in test case 4)
        initialBalance = await web3_1.eth.getBalance(destination)
        initial = await web3_1.eth.getBalance(user2) // used for gas measurement
        tx = await instance.claimFund(claimId1,signature,message,destination,{from: user2})
        // measure gas metrics
        gasUsed = tx.receipt.gasUsed;
        transaction = await web3_1.eth.getTransaction(tx.receipt.transactionHash);
        gasPrice = transaction.gasPrice;
        final = await web3_1.eth.getBalance(user2)
        console.log("      ",
          "Tx Cost: " + (gasUsed * gasPrice),
          "Consumed: " + (initial-final),
          "Refunded: " + ((gasUsed * gasPrice)-(initial-final))
        )
    })
    it('should emit Claim event', () => {
      assert.equal(tx.logs[0].event, 'Claimed')
    })
    it('should delete fund',async () => {
      const fund = await instance.funds(claimId1,{from: user2})
      assert.equal(fund[0], 0) //sender = address(0)
    })
    it('should increment destination balance by value',async () => {
      const finalBalance = await web3_1.eth.getBalance(destination)
      const balance = web3_1.utils.toBN(initialBalance).add(web3_1.utils.toBN(value))
      assert.equal(balance, finalBalance)
    })
  })

  describe('3) Create new fund. signer1 -> user2.', () => {
    let tx,signedMessage,signature
    before(async () => {
        // Create new fund (claimId2) for another user.
        signedMessage = web3_1.eth.accounts.sign(claimId2, signer1.privateKey)
        signature = signedMessage.signature
        tx = await instance.createFund(claimId2,signature,{from: user1, value:value})
    })
    it('should emit Send event', () => {
      assert.equal(tx.logs[0].event, 'Sent')
    })
    it('should create fund with correct parameters',async () => {
      const fund = await instance.funds(claimId2,{from: user1})
      assert.equal(fund[0], user1) // msg.sender
      assert.equal(fund[1], signer1.address) // signer
      assert.equal(fund[2], value) // value
      assert.equal(fund[3], 2) // nonce
      assert.equal(fund[4], false) // claimed/status
    })
  })

  describe('4) Frontrunning attack from badBoy stealing user2 funds.', () => {
    let tx,destination,destination2,initialBalance,message
    before(async () => {
        destination = accounts[9] // attacker destination address [user2]
        destination2 = accounts[8] // attacker destination address [user2]
        initialBalance = await web3_1.eth.getBalance(destination)
        message = web3_1.utils.soliditySha3(
          {type: 'bytes32', value: claimId2}, // fund id
          {type: 'address', value: destination}, // destination address
          {type: 'uint256', value: 2}, // nonce
          {type: 'address', value: Links.address} // contract address
        )
        signedMessage = web3_1.eth.accounts.sign(message, signer1.privateKey)
        signature = signedMessage.signature
    })
    it('should FAIL to frontrun fund tx with same parameters.', async () => {
      try {
        tx = await instance.claimFund(claimId2,signature,message,destination,{from: user2})
        tx = await instance.claimFund(claimId2,signature,message,destination2,{from: badBoy, gas:6283185})
      } catch (error) {
          assert.equal(error.reason, 'Links::claim, claim is not valid')
      }
    })
    it('should emit Claim event', () => {
      assert.equal(tx.logs[0].event, 'Claimed')
    })
    it('should delete fund',async () => {
      const fund = await instance.funds(claimId1,{from: user2})
      assert.equal(fund[0], 0) //sender = address(0)
    })
    it('should increment destination balance by value',async () => {
      const finalBalance = await web3_1.eth.getBalance(destination)
      const balance = web3_1.utils.toBN(initialBalance).add(web3_1.utils.toBN(value))
      assert.equal(balance, finalBalance)
    })
  })
})

