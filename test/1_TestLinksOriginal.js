var Web3_1 = require('web3')
var web3_1 = new Web3_1()
web3_1.setProvider(web3.currentProvider)

var LinksOriginal = artifacts.require("LinksOriginal");
var RevertContract = artifacts.require("RevertContract");

//Hacks for web3@1.0 support in truffle tests.
LinksOriginal.currentProvider.sendAsync = function() {
  return LinksOriginal.currentProvider.send.apply(LinksOriginal.currentProvider, arguments);
};
RevertContract.currentProvider.sendAsync = function() {
  return RevertContract.currentProvider.send.apply(RevertContract.currentProvider, arguments);
};

contract('LinksOriginal', function(accounts) {
  let instance,block,attackSig,claimGas
  const value = 0.2*10**18;
  const user1 = accounts[0];
  const user2 = accounts[1];
  const badBoy = accounts[4];
  const signer1 = web3_1.eth.accounts.create(web3_1.utils.randomHex(32));
  const claimId1 = web3_1.utils.randomHex(32);
  const claimId2 = web3_1.utils.randomHex(32);
  const faultyId = web3_1.utils.randomHex(32);

  before(async () => {
    instance = await LinksOriginal.deployed()
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
      assert.equal(tx.logs[0].event, 'Send')
    })
    it('should emit correct sent values', () => {
      assert.equal(tx.logs[0].args.id, claimId1)
      assert.equal(tx.logs[0].args.sender, user1)
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.expires, block + 10)
    })
    it('should create fund with correct parameters',async () => {
      const fund = await instance.funds(claimId1,{from: user1})
      assert.equal(fund[0], user1) // msg.sender
      assert.equal(fund[1], signer1.address.toLowerCase()) // signer
      assert.equal(fund[2], value) // value
      assert.equal(fund[3], block + 10) // expires = 14
    })
  })

  describe('2) Claim fund value as user2.', () => {
    let tx,signedMessage,signature,destination,message,initialBalance,finalBalance,transaction
    before(async () => {
        destination = accounts[9] // User2 destination address
        message = web3_1.utils.sha3(destination) // keccak256(destination)
        signedMessage = web3_1.eth.accounts.sign(message, signer1.privateKey)
        signature = signedMessage.signature
        attackSig = signature; // Used in test case 4)
        initialBalance = await web3_1.eth.getBalance(destination)
        tx = await instance.claimFund(claimId1,signature,destination,{from: user2})
        claimGas = tx.receipt.gasUsed; // used as a general parameter.
    })
    it('should emit Claim event', () => {
      assert.equal(tx.logs[0].event, 'Claim')
    })
    it('should emit correct claimed values', () => {
      assert.equal(tx.logs[0].args.id, claimId1)
      assert.equal(tx.logs[0].args.sender, user1) // fund creator
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.receiver, destination)
    })
    it('should delete fund',async () => {
      const fund = await instance.funds(claimId1,{from: user2})
      assert.equal(fund[0], 0) //sender = address(0)
    })
    it('should increment destination balance by value',async () => {
      finalBalance = await web3_1.eth.getBalance(destination)
      const balance = web3_1.utils.toBN(initialBalance).add(web3_1.utils.toBN(value))
      assert.equal(balance, finalBalance)
    })
  })

  describe('3) Create new fund. signer1 -> user3.', () => {
    let tx,signedMessage,signature
    before(async () => {
        // Create new fund (claimId2) for another user.
        signedMessage = web3_1.eth.accounts.sign(claimId2, signer1.privateKey)
        signature = signedMessage.signature
        tx = await instance.createFund(claimId2,signature,{from: user1, value:value})
        block = await web3_1.eth.getBlockNumber()
    })
    it('should emit Send event', () => {
      assert.equal(tx.logs[0].event, 'Send')
    })
    it('should emit correct sent values', () => {
      assert.equal(tx.logs[0].args.id, claimId2)
      assert.equal(tx.logs[0].args.sender, user1) // fund creator
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.expires, block + 10)
    })
    it('should create fund with correct parameters',async () => {
      const fund = await instance.funds(claimId2,{from: user1})
      assert.equal(fund[0], user1) // msg.sender
      assert.equal(fund[1], signer1.address.toLowerCase()) // signer
      assert.equal(fund[2], value) // value
      assert.equal(fund[3], block + 10) // expires
    })
  })

  describe('4) Replay attack from user2 stealing user3 funds.', () => {
    let tx,destination,initialBalance,finalBalance
    before(async () => {
        destination = accounts[9] // attacker destination address [user2]
        // Use signature from 2)[attackSig] to steal funds from 3)
        initialBalance = await web3_1.eth.getBalance(destination)
        tx = await instance.claimFund(claimId2,attackSig,destination,{from: user2})
        block = await web3_1.eth.getBlockNumber()
    })
    it('should emit Claim event', () => {
      assert.equal(tx.logs[0].event, 'Claim')
    })
    it('should emit correct claimed values', () => {
      assert.equal(tx.logs[0].args.id, claimId2)
      assert.equal(tx.logs[0].args.sender, user1) // fund creator
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.receiver, destination)
    })
    it('should delete fund',async () => {
      const fund = await instance.funds(claimId2,{from: user2})
      assert.equal(fund[0], 0) // sender = address(0)
    })
    it('should SUCCEED and increment ATTACKER [user2] destination balance by value',async () => {
      finalBalance = await web3_1.eth.getBalance(destination)
      const balance = web3_1.utils.toBN(initialBalance).add(web3_1.utils.toBN(value))
      assert.equal(balance, finalBalance)
    })
  })

  describe('5) Create faulty fund. signerN -> user4.', () => {
    let tx
    before(async () => {
        // Create new fund for another user.
        // Incorrect signature size or version creates signer 0x0
        let fakeSig = web3_1.utils.randomHex(66) // sig should be 65 bytes
        tx = await instance.createFund(faultyId,fakeSig,{from: user2, value:value})
        block = await web3_1.eth.getBlockNumber()
    })
    it('should emit Send event', () => {
      assert.equal(tx.logs[0].event, 'Send')
    })
    it('should emit faulty sent values', () => {
      assert.equal(tx.logs[0].args.id, faultyId)
      assert.equal(tx.logs[0].args.sender, user2)
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.expires, block + 10)
    })
    it('should create fund with faulty parameters',async () => {
      const fund = await instance.funds(faultyId,{from: user2})
      assert.equal(fund[0], user2) // msg.sender
      assert.equal(fund[1], 0) // signer = 0x0
      assert.equal(fund[2], value) // value
      assert.equal(fund[3], block + 10) // expires
    })
  })

  describe('6) Incorrect signature attack from badBoy stealing user4 funds.', () => {
    let tx,destination,initialBalance,finalBalance
    before(async () => {
        destination = accounts[8] // attacker destination address [badBoy]
        // Use new random fake signature to steal funds from 5)
        let fakeSig2 = web3_1.utils.randomHex(66) // sig should be 65 bytes
        initialBalance = await web3_1.eth.getBalance(destination)
        tx = await instance.claimFund(faultyId,fakeSig2,destination,{from: badBoy})
        block = await web3_1.eth.getBlockNumber()
    })
    it('should emit Claim event', () => {
      assert.equal(tx.logs[0].event, 'Claim')
    })
    it('should emit correct claimed values', () => {
      assert.equal(tx.logs[0].args.id, faultyId)
      assert.equal(tx.logs[0].args.sender, user2) // fund creator
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.receiver, destination)
    })
    it('should delete fund',async () => {
      const fund = await instance.funds(faultyId,{from: badBoy})
      assert.equal(fund[0], 0) // sender = address(0)
    })
    it('should SUCCEED and increment ATTACKER [badBoy] destination balance by value',async () => {
      finalBalance = await web3_1.eth.getBalance(destination)
      const balance = web3_1.utils.toBN(initialBalance).add(web3_1.utils.toBN(value))
      assert.equal(balance, finalBalance)
    })
  })

  describe('7) Create new fund. signer1 -> user2.', () => {
    let tx,signedMessage,signature
    before(async () => {
        signedMessage = web3_1.eth.accounts.sign(claimId1, signer1.privateKey)
        signature = signedMessage.signature
        tx = await instance.createFund(claimId1,signature,{from: user1, value:value})
        block = await web3_1.eth.getBlockNumber()
    })
    it('should emit Send event', () => {
      assert.equal(tx.logs[0].event, 'Send')
    })
    it('should emit correct sent values', () => {
      assert.equal(tx.logs[0].args.id, claimId1)
      assert.equal(tx.logs[0].args.sender, user1)
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.expires, block + 10)
    })
    it('should create fund with correct parameters',async () => {
      const fund = await instance.funds(claimId1,{from: user1})
      assert.equal(fund[0], user1) // msg.sender
      assert.equal(fund[1], signer1.address.toLowerCase()) // signer
      assert.equal(fund[2], value) // value
      assert.equal(fund[3], block + 10) // expires
    })
  })

  describe('8) Claim fund and call honest contract while it reverts.', () => {
    let tx,signedMessage,signature,destination,message,initialBalance,finalBalance,transaction
    before(async () => {
        destination = RevertContract.address
        message = web3_1.utils.sha3(destination) // keccak256(destination)
        signedMessage = web3_1.eth.accounts.sign(message, signer1.privateKey)
        signature = signedMessage.signature
        initialBalance = await web3_1.eth.getBalance(destination)
        tx = await instance.claimFund(claimId1,signature,destination,{from: user2})
        claimGas = tx.receipt.gasUsed; // used as a general parameter.
    })
    it('should emit Claim event', () => {
      assert.equal(tx.logs[0].event, 'Claim')
    })
    it('should emit correct claimed values', () => {
      assert.equal(tx.logs[0].args.id, claimId1)
      assert.equal(tx.logs[0].args.sender, user1) // fund creator
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.receiver, destination)
    })
    it('should delete fund',async () => {
      const fund = await instance.funds(claimId1,{from: user2})
      assert.equal(fund[0], 0) //sender = address(0)
    })
    it('should NOT increment destination balance if honest contract reverts.',async () => {
      finalBalance = await web3_1.eth.getBalance(destination)
      assert.equal(0, finalBalance)
    })
  })
})

