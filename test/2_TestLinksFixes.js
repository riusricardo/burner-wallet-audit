var Web3_1 = require('web3')
var web3_1 = new Web3_1()
web3_1.setProvider(web3.currentProvider)

var LinksFixes = artifacts.require("LinksFixes");

//Hacks for web3@1.0 support in truffle tests.
LinksFixes.currentProvider.sendAsync = function() {
  return LinksFixes.currentProvider.send.apply(LinksFixes.currentProvider, arguments);
};

contract('LinksFixes', function(accounts) {
  let instance,block,attackSig,claimGas
  const value = 0.2*10**18;
  const user1 = accounts[0];
  const user2 = accounts[1];
  const user3 = accounts[2];
  const badBoy = accounts[4];
  const signer1 = web3_1.eth.accounts.create(web3_1.utils.randomHex(32));
  const claimId1 = web3_1.utils.randomHex(32);
  const claimId2 = web3_1.utils.randomHex(32);
  const faultyId = web3_1.utils.randomHex(32);

  before(async () => {
    instance = await LinksFixes.deployed()
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
        message = web3_1.utils.soliditySha3(
          {type: 'uint256', value: claimId1},
          {type: 'address', value: destination},
          {type: 'uint256', value: 1},
          {type: 'address', value: LinksFixes.address}
        )
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
      assert.equal(tx.logs[0].args.sender, user2)
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
})

