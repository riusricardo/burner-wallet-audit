var Web3_1 = require('web3')
var web3_1 = new Web3_1()
web3_1.setProvider(web3.currentProvider)

var ethjsABI = require('ethjs-abi')
var LinksOriginal = artifacts.require("LinksOriginal");

//Hacks for web3@1.0 support in truffle tests.
LinksOriginal.currentProvider.sendAsync = function() {
  return LinksOriginal.currentProvider.send.apply(LinksOriginal.currentProvider, arguments);
};

contract('LinksOriginal', function(accounts) {
  let instance,block,encodedResult
  const value = 0.2*10**18;
  const signer1 = web3_1.eth.accounts.create(web3_1.utils.randomHex(32));
  const signer2 = web3_1.eth.accounts.create(web3_1.utils.randomHex(32));
  const badBoy = web3_1.eth.accounts.create(web3_1.utils.randomHex(32));
  const claimId1 = '0x' + require('crypto').randomBytes(32).toString('hex');
  const claimId2 = '0x' + require('crypto').randomBytes(32).toString('hex');
  const faultyId = '0x' + require('crypto').randomBytes(32).toString('hex');

  before(async () => {
    instance = await LinksOriginal.deployed()
  })

  describe('Create send transaction.', () => {
    let tx,signedMessage,signature
    before(async () => {
        signedMessage = web3_1.eth.accounts.sign(claimId1, signer1.privateKey)
        signature = signedMessage.signature
        tx = await instance.createFund(claimId1,signature,{from: accounts[0], value:value})
        block = await web3_1.eth.getBlockNumber()
    })
    it('should emit Send event', () => {
      assert.equal(tx.logs[0].event, 'Send')
    })
    it('should emit correct sent values', () => {
      assert.equal(tx.logs[0].args.id, claimId1)
      assert.equal(tx.logs[0].args.sender, accounts[0])
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.expires, block + 10)
    })
    it('should create fund with correct parameters',async () => {
      const fund = await instance.funds(claimId1,{from: accounts[0]})
      assert.equal(fund[0], accounts[0]) // msg.sender
      assert.equal(fund[1], signer1.address.toLowerCase()) // signer
      assert.equal(fund[2], value) // value
      assert.equal(fund[3], block + 10) // expires = 14
    })
  })

  describe('Claim fund value.', () => {
    let tx,signedMessage,signature,destination,message,initialBalance,finalBalance
    before(async () => {
        destination = accounts[4]
        message = web3_1.utils.sha3(destination) // keccak256(destination)
        signedMessage = web3_1.eth.accounts.sign(message, signer1.privateKey)
        signature = signedMessage.signature
        initialBalance = await web3_1.eth.getBalance(destination)
        tx = await instance.claimFund(claimId1,signature,destination,{from: accounts[0]})
        block = await web3_1.eth.getBlockNumber()
    })
    it('should emit Claim event', () => {
      assert.equal(tx.logs[0].event, 'Claim')
    })
    it('should emit correct claimed values', () => {
      assert.equal(tx.logs[0].args.id, claimId1)
      assert.equal(tx.logs[0].args.sender, accounts[0])
      assert.equal(tx.logs[0].args.value, value)
      assert.equal(tx.logs[0].args.receiver, destination)
    })
    it('should delete fund',async () => {
      const fund = await instance.funds(claimId1,{from: accounts[0]})
      assert.equal(fund[1], 0) // signer
    })
    it('should increment destination balance by value',async () => {
      finalBalance = await web3_1.eth.getBalance(destination)
      const balance = web3_1.utils.toBN(initialBalance).add(web3_1.utils.toBN(value))
      assert.equal(balance, finalBalance)
    })
  })
/*
  describe('', () => {
    let tx
    before(async () => {
      tx = await instance.({from: deployer})
    })
    it('', () => {
      const event = tx.logs[0]
      assert.equal(event.event, '')
    })
    it('should fail', async () => {
    try {
        await instance.(, {from: badBoy.address})
      } catch (error) {
        assert.equal(error.message, 'VM Exception while processing transaction: revert ,')

      }
    })
  })
  */
})

