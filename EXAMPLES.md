# Usage Examples

This document provides practical examples of using the Neo Serializer library in your Solidity contracts.

## Basic Usage

### Serializing and Deserializing Primitives

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/NeoSerializerLib.sol";

contract BasicExample {
    using NeoSerializerLib for uint256;
    using NeoSerializerLib for bool;
    using NeoSerializerLib for bytes;
    
    function serializePrimitives(
        bool flag,
        uint256 number,
        bytes memory data
    ) external pure returns (bytes memory) {
        bytes memory serialized = abi.encodePacked(
            flag.serialize(),
            number.serialize(),
            data.serialize()
        );
        return serialized;
    }
    
    function deserializePrimitives(bytes memory serialized) 
        external 
        pure 
        returns (bool flag, uint256 number, bytes memory data) 
    {
        uint256 offset = 0;
        (flag, offset) = NeoSerializerLib.deserializeBool(serialized, offset);
        (number, offset) = NeoSerializerLib.deserializeUint256(serialized, offset);
        (data, offset) = NeoSerializerLib.deserializeBytes(serialized, offset);
    }
}
```

## On-Chain Storage

See `contracts/examples/StorageExample.sol` for a complete example of storing serialized data on-chain.

```solidity
import "./libraries/NeoSerializerLib.sol";

contract MyStorage {
    mapping(bytes32 => bytes) private storageData;
    
    function store(uint256 value) external {
        bytes32 key = keccak256("my-value");
        storageData[key] = NeoSerializerLib.serialize(value);
    }
    
    function retrieve() external view returns (uint256) {
        bytes32 key = keccak256("my-value");
        (uint256 value, ) = NeoSerializerLib.deserializeUint256(storageData[key], 0);
        return value;
    }
}
```

## Cross-Chain Interoperability

See `contracts/examples/CrossChainExample.sol` for a complete example of cross-chain data exchange with Neo blockchain.

```solidity
import "./libraries/NeoSerializerLib.sol";

contract CrossChainBridge {
    function prepareForNeo(uint256[] memory values) 
        external 
        pure 
        returns (bytes memory) 
    {
        // Serialize in Neo format for cross-chain transfer
        return NeoSerializerLib.serialize(values);
    }
    
    function processFromNeo(bytes memory neoData) 
        external 
        pure 
        returns (uint256[] memory) 
    {
        // Deserialize data received from Neo blockchain
        (bytes[] memory items, ) = NeoSerializerLib.deserializeArray(neoData, 0);
        uint256[] memory values = new uint256[](items.length);
        
        for (uint256 i = 0; i < items.length; i++) {
            (values[i], ) = NeoSerializerLib.deserializeUint256(items[i], 0);
        }
        
        return values;
    }
}
```

## Array Serialization

```solidity
import "./libraries/NeoSerializerLib.sol";

contract ArrayExample {
    function serializeArray(uint256[] memory values) 
        external 
        pure 
        returns (bytes memory) 
    {
        return NeoSerializerLib.serialize(values);
    }
    
    function deserializeArray(bytes memory data) 
        external 
        pure 
        returns (uint256[] memory) 
    {
        (bytes[] memory items, ) = NeoSerializerLib.deserializeArray(data, 0);
        uint256[] memory values = new uint256[](items.length);
        
        for (uint256 i = 0; i < items.length; i++) {
            (values[i], ) = NeoSerializerLib.deserializeUint256(items[i], 0);
        }
        
        return values;
    }
}
```

## Round-Trip Testing

Always test that your serialization/deserialization works correctly:

```solidity
function testRoundTrip(uint256 value) external pure returns (bool) {
    bytes memory serialized = NeoSerializerLib.serialize(value);
    (uint256 deserialized, ) = NeoSerializerLib.deserializeUint256(serialized, 0);
    return value == deserialized;
}
```

## Gas Optimization Tips

1. **Use `using` directives** - They allow cleaner syntax and the compiler can optimize better
2. **Batch operations** - Serialize multiple values together when possible
3. **Cache serialized data** - If you need to serialize the same data multiple times, cache it
4. **Use appropriate types** - Smaller integers serialize to fewer bytes

## Error Handling

The library uses custom errors for better gas efficiency:

```solidity
import "./libraries/NeoSerializerLib.sol";

contract ErrorHandling {
    function safeDeserialize(bytes memory data) 
        external 
        pure 
        returns (uint256 value, bool success) 
    {
        if (data.length < 2) {
            return (0, false);
        }
        
        try NeoSerializerLib.deserializeUint256(data, 0) returns (
            uint256 v,
            uint256
        ) {
            return (v, true);
        } catch {
            return (0, false);
        }
    }
}
```
