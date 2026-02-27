# Using NeoSerializerLib in Your Contract

This guide shows you how to add and use `NeoSerializerLib` in your existing Solidity contracts.

## Installation

### Option 1: Install as npm package (when published)

```bash
npm install @axlabs/neo-serializer
```

### Option 2: Copy library files directly

Copy these files to your project:
- `contracts/libraries/NeoSerializerLib.sol`
- `contracts/libraries/VarInt.sol`
- `contracts/libraries/NeoTypes.sol`

Make sure to preserve the directory structure (`contracts/libraries/`).

## Basic Usage

### 1. Import the Library

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "path/to/libraries/NeoSerializerLib.sol";

contract MyContract {
    // Your contract code
}
```

### 2. Using Library Functions

You can use the library in two ways:

#### Method A: Direct function calls

```solidity
contract MyContract {
    function serializeData(uint256 value) public pure returns (bytes memory) {
        return NeoSerializerLib.serialize(value);
    }
    
    function serializeString(string memory text) public pure returns (bytes memory) {
        return NeoSerializerLib.serialize(text);
    }
}
```

#### Method B: Using `using` directive (for cleaner syntax)

```solidity
contract MyContract {
    using NeoSerializerLib for uint256;
    using NeoSerializerLib for bytes;
    using NeoSerializerLib for string;
    
    function serializeData(uint256 value) public pure returns (bytes memory) {
        return value.serialize();  // Cleaner syntax!
    }
    
    function serializeString(string memory text) public pure returns (bytes memory) {
        return text.serialize();
    }
}
```

## Common Use Cases

### Serializing Contract Calls for Neo

```solidity
import "path/to/libraries/NeoSerializerLib.sol";

contract MyContract {
    using NeoSerializerLib for uint256;
    using NeoSerializerLib for bytes;
    using NeoSerializerLib for string;
    
    // Both bytes20 and address are supported for the target
    function createNeoCall(
        address target,  // Can also use bytes20
        string memory method,
        uint256[] memory args
    ) public pure returns (bytes memory) {
        // Serialize each argument
        bytes[] memory serializedArgs = new bytes[](args.length);
        for (uint256 i = 0; i < args.length; i++) {
            serializedArgs[i] = args[i].serialize();
        }
        
        // Serialize the call with CallFlags.All
        return NeoSerializerLib.serializeCall(
            target,  // address is automatically converted
            method,
            NeoSerializerLib.CALL_FLAGS_ALL,  // Use library constants
            serializedArgs
        );
    }
}
```

### Serializing Hash160 (Neo Contract Addresses)

```solidity
contract MyContract {
    // Both bytes20 and address are supported
    function serializeNeoAddress(bytes20 contractHash) public pure returns (bytes memory) {
        // Hash160 is serialized with reversed bytes (little-endian)
        return NeoSerializerLib.serializeHash160(contractHash);
    }
    
    function serializeNeoAddressFromAddr(address contractAddr) public pure returns (bytes memory) {
        // Address type is automatically converted to bytes20
        return NeoSerializerLib.serializeHash160(contractAddr);
    }
}
```

### Serializing Mixed Data Types

```solidity
contract MyContract {
    using NeoSerializerLib for uint256;
    using NeoSerializerLib for string;
    using NeoSerializerLib for bytes;
    
    function serializeMixedData(
        uint256 id,
        string memory name,
        bytes memory data
    ) public pure returns (bytes memory) {
        bytes[] memory items = new bytes[](3);
        items[0] = id.serialize();
        items[1] = name.serialize();
        items[2] = data.serialize();
        
        // Wrap in an array
        return NeoSerializerLib.serialize(items);
    }
}
```

### Deserializing Data

```solidity
contract MyContract {
    function deserializeInteger(bytes memory data) public pure returns (uint256) {
        (uint256 value, ) = NeoSerializerLib.deserializeUint256(data, 0);
        return value;
    }
    
    function deserializeString(bytes memory data) public pure returns (string memory) {
        (bytes memory bytesValue, ) = NeoSerializerLib.deserializeBytes(data, 0);
        return string(bytesValue);
    }
    
    function deserializeArray(bytes memory data) public pure returns (bytes[] memory) {
        (bytes[] memory items, ) = NeoSerializerLib.deserializeArray(data, 0);
        return items;
    }
}
```

## Available Functions

### Serialization Functions

- `serialize(bool value)` → `bytes`
- `serialize(uint256 value)` → `bytes`
- `serialize(bytes memory value)` → `bytes`
- `serialize(string memory value)` → `bytes`
- `serialize(uint256[] memory value)` → `bytes`
- `serialize(bytes[] memory value)` → `bytes`
- `serializeHash160(bytes20 value)` → `bytes` (for Neo contract addresses)
- `serializeHash160(address value)` → `bytes` (convenience overload for address)
- `serializeBuffer(bytes memory value)` → `bytes` (type 0x30, for ByteArray params)
- `serializeCall(bytes20 target, string memory method, uint256 callFlags, bytes[] memory args)` → `bytes`
- `serializeCall(address target, string memory method, uint256 callFlags, bytes[] memory args)` → `bytes` (convenience overload)

### Deserialization Functions

- `deserializeBool(bytes memory data, uint256 offset)` → `(bool value, uint256 newOffset)`
- `deserializeUint256(bytes memory data, uint256 offset)` → `(uint256 value, uint256 newOffset)`
- `deserializeBytes(bytes memory data, uint256 offset)` → `(bytes memory value, uint256 newOffset)`
- `deserializeArray(bytes memory data, uint256 offset)` → `(bytes[] memory items, uint256 newOffset)`

### Constants

- `CALL_FLAGS_NONE` (0)
- `CALL_FLAGS_READ_STATES` (1)
- `CALL_FLAGS_WRITE_STATES` (2)
- `CALL_FLAGS_ALLOW_CALL` (4)
- `CALL_FLAGS_ALLOW_NOTIFY` (8)
- `CALL_FLAGS_STATES` (3) - ReadStates | WriteStates
- `CALL_FLAGS_READ_ONLY` (5) - ReadStates | AllowCall
- `CALL_FLAGS_ALL` (15) - All flags combined

## Complete Example

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "path/to/libraries/NeoSerializerLib.sol";

contract OracleBridge {
    using NeoSerializerLib for uint256;
    using NeoSerializerLib for string;
    using NeoSerializerLib for bytes;
    
    event OracleCallSerialized(bytes indexed serializedCall);
    
    function serializeOracleRequest(
        bytes20 oracleContract,
        string memory url,
        bytes20 callbackContract,
        string memory callbackMethod,
        uint256 gasForResponse
    ) public pure returns (bytes memory) {
        // Serialize arguments
        bytes[] memory args = new bytes[](6);
        args[0] = url.serialize();                                    // String
        args[1] = "".serialize();                                     // Empty filter
        args[2] = NeoSerializerLib.serializeHash160(callbackContract); // Hash160
        args[3] = callbackMethod.serialize();                         // String
        args[4] = "".serialize();                                     // Empty userData
        args[5] = gasForResponse.serialize();                         // Integer
        
        // Serialize the call
        return NeoSerializerLib.serializeCall(
            oracleContract,
            "requestOracleData",
            NeoSerializerLib.CALL_FLAGS_ALL,
            args
        );
    }
    
    function deserializeOracleResponse(bytes memory data) 
        public 
        pure 
        returns (string memory result) 
    {
        (bytes memory bytesResult, ) = NeoSerializerLib.deserializeBytes(data, 0);
        return string(bytesResult);
    }
}
```

## Hardhat Configuration

If using Hardhat, add the library path to your `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    // If library is in node_modules:
    // libraries: "./node_modules/@axlabs/neo-serializer/contracts",
  },
};

export default config;
```

## Notes

- All serialization functions are `pure` (no state changes)
- Deserialization functions return both the value and the new offset (for parsing multiple items)
- Hash160 values are automatically reversed to little-endian (matching Neo's UInt160 format)
- Integer zero serializes as empty bytes (`21 00`), not a single zero byte
- Integers with MSB ≥ 0x80 get a sign extension byte (matching .NET BigInteger.ToByteArray())

## Troubleshooting

### Import path issues

If you get import errors, check:
1. The library files are in the correct directory structure
2. Your import path matches the actual file location
3. Hardhat/compiler can find the files (check `hardhat.config.ts`)

### Type errors

Make sure you're using the correct types:
- `bytes20` or `address` for Hash160 (both are supported)
- `bytes memory` for serialized data (not `bytes calldata`)
- `bytes[] memory` for arrays of serialized items

### Gas optimization

For gas optimization:
- Prefer `pure` functions when possible
- Consider caching serialized data if it's reused
- Serialize arguments once and reuse them if calling `serializeCall` multiple times
