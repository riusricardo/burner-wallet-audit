var ethjsABI = require('ethjs-abi')
var LinksOriginal = artifacts.require("LinksOriginal");

contract('LinksOriginal', function(accounts) {
  let instance,encodedResult
  const deployer = accounts[0]
  const user1 = accounts[1]
  const user2 = accounts[2]
  const badBoy = accounts[5]

  before(async () => {
    instance = await LinksOriginal.deployed()

    for (let i = 0; i < LinksOriginal.contract.abi.length; i++) {
      if (LinksOriginal.contract.abi[i].name === "") {
        encodedResult = ethjsABI.encodeMethod(LinksOriginal.contract.abi[i], [, , ]);
        break;
      }
    }
  })

  describe('', () => {
    it('', async () => {
      try {
          await instance.(, , {from: owner})
      } catch (error) {
        assert.equal(error, 'undefined')
      }
    })
  })

  describe('', () => {
    let tx
    before(async () => {
      tx = await instance.({from: user1})
    })
    it('', () => {
      const event = tx.logs[0]
      assert.equal(event.event, '')
    })
    it('should fail', async () => {
    try {
        await instance.(, {from: badBoy})
      } catch (error) {
        assert.equal(error.message, 'VM Exception while processing transaction: revert ,')

      }
    })
  })
})

