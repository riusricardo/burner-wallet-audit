pragma solidity ^0.4.24;

contract LinksFixes {

    struct Fund {
        address sender;
        address signer;
        uint256 value;
        uint64 expires;
        uint256 nonce;
        bool claimed;
    }
    uint256 public  contractNonce = 1;
    mapping (bytes32 => Fund) public funds;

    event Send(
        bytes32 id,
        address indexed sender,
        uint256 value,
        uint64 expires,
        uint256 nonce,
        bool indexed sent
    );
    event Claim(
        bytes32 id,
        address indexed sender, 
        uint256 value, 
        address indexed receiver, 
        uint256 nonce, 
        bool indexed claimed
    );

    /// @dev Create fund.
    /// @param _id Fund lookup key value.
    /// @param _sig Claimant signature.
    function createFund(
        bytes32 _id, 
        bytes _sig
    )   
        public 
        payable 
        returns (bool)
    {
        require(msg.value > 0,"Links::some value needs to be allocated");
        require(_sig.length == 65,"Links::invalid signature lenght");
        //make sure there is not already a fund here
        require(!fundExists(_id),"Links::send id already exists");
        //create hardcoded expires time for now
        uint64 expires = uint64(block.number+10);//expires in 100 blocks
        address signer = recoverSigner(_id,_sig);
        //recoverSigner returns: address(0) if invalid signature or incorrect version.
        require(signer != address(0),"Links::invalid signer");
        uint256 nonce = contractNonce;
        contractNonce = safeAdd(contractNonce,uint256(1));
        //create fund
        funds[_id] = Fund({
            sender: msg.sender,
            signer: signer,
            value: msg.value,
            expires: expires,
            nonce: nonce,
            claimed: false
        });
        //send out events for frontend parsing
        emit Send(_id,msg.sender,msg.value,expires,nonce,true);
        return true;
    }

    /// @dev Claim fund value.
    /// @param _id Claim lookup key value.
    /// @param _sig Claimant signature.
    /// @param _destination Destination address.
    function claimFund(
        bytes32 _id, 
        bytes _sig, 
        address _destination
    ) 
        public 
        returns (bool)
    {
        //makes sure sig is correct, there is fund here and it has not expired
        require(isClaimValid(_id,_sig,_destination),"Links::claim is not valid");
        return executeClaim(_id,_destination);
    }
  
    /// @dev Off chain relayer can validate the claim before submitting.
    /// @param _id Claim lookup key value.
    /// @param _sig Claimant signature.
    /// @param _destination Destination address.
    function isClaimValid(
        bytes32 _id, 
        bytes _sig, 
        address _destination
    ) 
        public 
        view 
        returns (bool)
    {
        // address(0) destination is valid
        if(fundExists(_id) && _sig.length == 65){
            uint256 nonce = funds[_id].nonce;
            // keccak256(_id,_destination,nonce,address(this)) is a unique key
            // remains unique if the id gets reused after fund deletion
            bytes32 claimHash = keccak256(abi.encodePacked(_id,_destination,nonce,address(this)));
            address signer = recoverSigner(claimHash,_sig);
            if(signer != address(0)){
                return(
                    funds[_id].signer == signer && 
                    funds[_id].claimed == false &&
                    funds[_id].nonce < contractNonce &&
                    funds[_id].expires >= uint64(block.number)
                );
            }else{
                return false;
            }
        }else{
            return false;
        }
    }

    /// @dev Validate fund status. 
    /// @param _id Lookup key value.
    function fundExists(
        bytes32 _id
    ) 
        public 
        view 
        returns (bool)
    {
        address sender = funds[_id].sender;
        address signer = funds[_id].signer;
        uint256 amount = funds[_id].value;
        uint256 nonce = funds[_id].nonce;
        uint64 expiration = funds[_id].expires;
        /* solium-disable-next-line security/no-inline-assembly */
        assembly {
          // Cannot assume empty initial values without initializating them. 
          sender := and(sender, 0xffffffff)
          signer := and(signer, 0xffffffff)
          amount := and(amount, 0xffffffff)
          nonce := and(nonce, 0xffffffff)
          expiration := and(expiration, 0xffffffff)
        }
        return (
          sender != address(0) && 
          signer != address(0) && 
          amount != uint256(0) && 
          nonce != uint256(0) &&
          expiration != uint64(0)
        );
    }

    /// @dev Claim fund value.
    /// @param _id Claim lookup key value.
    /// @param _destination Destination address.
    function executeClaim(
        bytes32 _id,
        address _destination
    ) 
        internal 
        returns (bool)
    {
        require(fundExists(_id),"Links::fund id does not exists");
        bool status = false;
        bool claimed = funds[_id].claimed;
        uint256 value = funds[_id].value;
        uint256 nonce = funds[_id].nonce;
        if((claimed == false) && (nonce < contractNonce)){
            // set id control flag to prevent reentrancy
            // temporary fund invalidation
            funds[_id].claimed = true;
            // send funds to the destination (receiver)
            /* solium-disable-next-line security/no-send */
            status = _destination.send(value);
            // update fund with correct status
            funds[_id].claimed = status;
        } 
        if(status == true || claimed == true){
            // DESTROY object so it can't be claimed again
            delete funds[_id];
        }
        // send out events for frontend parsing
        emit Claim(_id,msg.sender,value,_destination,nonce,status);
        return status;
    }

    /// @dev Recover signer from bytes32 data.
    /// @param _hash bytes32 data.
    /// @param _signature message signature (65 bytes).
    function recoverSigner(
        bytes32 _hash, 
        bytes _signature
    ) 
        internal 
        pure 
        returns (address)
    {
        bytes32 r;
        bytes32 s;
        uint8 v;
        // Check the signature length
        if (_signature.length != 65) {
            return address(0);
        }
        // Divide the signature in r, s and v variables
        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        /* solium-disable-next-line security/no-inline-assembly */
        assembly {
          r := mload(add(_signature, 32))
          s := mload(add(_signature, 64))
          v := byte(0, mload(add(_signature, 96)))
        }
        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }
        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
            return address(0);
        } else {
            return ecrecover(
              /* solium-disable-next-line */
                keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash))
                , v, r, s);
        }
    }

    /// @dev Adds two numbers, throws on overflow.
    function safeAdd(
        uint256 _a, 
        uint256 _b
    ) 
        internal 
        pure 
        returns (uint256 c) 
    {
        c = _a + _b;
        assert(c >= _a);
        return c;
    }
}