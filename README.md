# Neo Serialize/Deserialize in Solidity

This project reimplements Neo's StdLib native contract Serialize and Deserialize methods in Solidity. These methods convert data to/from Neo's binary serialization format, which uses type markers, VarInt encoding, and little-endian byte ordering.

## Overview

Neo's serialization format supports:
- Primitive types: Boolean, Integer (BigInteger), ByteString, Buffer
- Container types: Array, Struct, Map
- Variable-length encoding using VarInt
- Little-endian byte ordering for integers
- Contract call serialization for cross-chain interoperability

## Quick Start

### Installation

```bash
npm install @axlabs/neo-serializer-evm
```

### Basic Usage

```solidity
import "@axlabs/neo-serializer-evm/contracts/libraries/NeoSerializerLib.sol";

contract MyContract {
    using NeoSerializerLib for uint256;
    
    function serializeValue(uint256 value) public pure returns (bytes memory) {
        return value.serialize();
    }
    
    function createNeoCall(bytes20 target, string memory method) 
        public pure returns (bytes memory) 
    {
        bytes[] memory args = new bytes[](0);
        return NeoSerializerLib.serializeCall(
            target,
            method,
            NeoSerializerLib.CALL_FLAGS_ALL,
            args
        );
    }
}
```

**For detailed usage instructions, see [USAGE.md](./USAGE.md)**  
**For practical examples, see [EXAMPLES.md](./EXAMPLES.md)**

## Features

### Core Serialization

- **Boolean**: `serialize(bool)` - Serializes as type byte (0x20) + 0x00/0x01
- **Integer**: `serialize(uint256)` - Serializes as type byte (0x21) + VarInt length + little-endian bytes
  - Handles zero as empty bytes (0x21 0x00)
  - Automatic sign extension for MSB ≥ 0x80
- **ByteString**: `serialize(bytes)` - Serializes as type byte (0x28) + VarInt length + bytes
- **String**: `serialize(string)` - UTF-8 encoded as ByteString
- **Arrays**: 
  - `serialize(uint256[])` - Array of integers
  - `serialize(bytes[])` - Array of byte strings
  - `serializeArray(bytes[])` - Array of already-serialized items

### Neo-Specific Types

- **Hash160**: `serializeHash160(bytes20)` / `serializeHash160(address)` - Reverses bytes for Neo's little-endian UInt160 format
- **Buffer**: `serializeBuffer(bytes)` - Serializes with type byte (0x30) for ByteArray contract params

### Contract Call Serialization

- **serializeCall**: Serializes a complete Neo contract call
  ```solidity
  serializeCall(bytes20 target, string method, uint256 callFlags, bytes[] args)
  serializeCall(address target, string method, uint256 callFlags, bytes[] args)
  ```
  - Serializes: `[target (Hash160), method (String), callFlags (Integer), args (Array)]`
  - Supports both `bytes20` and `address` types for target

### Gas-Optimized Mutations

- **appendArgToCall**: Add an argument to an already-serialized call
  ```solidity
  appendArgToCall(bytes serializedCall, bytes serializedArg)
  appendArgToCall(bytes serializedCall, uint256 innerArrayCountOffset, bytes serializedArg) // Fast path
  ```
  - Auto-navigates to inner args array and increments count
  - Fast-path version accepts pre-computed offset for maximum efficiency

- **replaceLastArg**: Replace the last argument in a serialized call
  ```solidity
  replaceLastArg(bytes serializedCall, uint256 oldArgSerializedLength, bytes newSerializedArg)
  ```
  - Perfect for off-chain serialization with placeholder (e.g., `nonce=0`)
  - On-chain, just replace the placeholder with the real value
  - No navigation needed - computes position from total length

### Deserialization

- **deserializeBool**: `(bool value, uint256 newOffset) = deserializeBool(data, offset)`
- **deserializeUint256**: `(uint256 value, uint256 newOffset) = deserializeUint256(data, offset)`
- **deserializeBytes**: `(bytes value, uint256 newOffset) = deserializeBytes(data, offset)`
- **deserializeArray**: `(bytes[] items, uint256 newOffset) = deserializeArray(data, offset)`
- **deserializeItem**: Generic deserializer that returns the raw serialized item

### CallFlags Constants

Pre-defined constants matching Neo's CallFlags enum:
- `CALL_FLAGS_NONE` (0)
- `CALL_FLAGS_READ_STATES` (1)
- `CALL_FLAGS_WRITE_STATES` (2)
- `CALL_FLAGS_ALLOW_CALL` (4)
- `CALL_FLAGS_ALLOW_NOTIFY` (8)
- `CALL_FLAGS_STATES` (3) - ReadStates | WriteStates
- `CALL_FLAGS_READ_ONLY` (5) - ReadStates | AllowCall
- `CALL_FLAGS_ALL` (15) - All flags combined

### Gas Optimizations

- Assembly-optimized byte copying for bulk operations
- Inlined constants and VarInt encoding
- Word-aligned memory operations
- `unchecked` blocks for safe arithmetic
- Zero-allocation paths for common cases

## Project Structure

```
contracts/
  libraries/
    NeoSerializerLib.sol     # Main serialization library (use this!)
    VarInt.sol               # VarInt encoding/decoding library
    NeoTypes.sol             # StackItemType enum and helpers
  examples/
    ExampleUsage.sol         # Basic usage examples
    ContractCallExample.sol  # Contract call serialization examples
    StorageExample.sol        # On-chain storage example
    CrossChainExample.sol     # Cross-chain interoperability example
  test/
    NeoSerializerTestHelper.sol  # Test helper (for testing libraries)
test/
  NeoSerializer.test.ts           # Comprehensive test suite
  NeoSerializerFormat.test.ts     # Exact byte format verification
  NeoBinarySerializerPort.test.ts # Ported tests from Neo
  ContractCall.test.ts             # Contract call serialization tests
  OracleCallComparison.test.ts     # Real Neo node comparison
  AppendArg.test.ts                # Append argument tests
  ReplaceLastArg.test.ts           # Replace last argument tests
  OptimizationSafety.test.ts      # Assembly optimization safety tests
  GasCosts.test.ts                 # Gas cost analysis
```

## Installation

```bash
npm install
```

## Usage

### Import the Library

The library can be used directly in your contracts without deployment:

```solidity
import "@axlabs/neo-serializer-evm/contracts/libraries/NeoSerializerLib.sol";

contract MyContract {
    using NeoSerializerLib for uint256;
    using NeoSerializerLib for bytes;
    
    function serializeData(uint256 value) external pure returns (bytes memory) {
        // Direct library call - functions are inlined (no external call overhead)
        return NeoSerializerLib.serialize(value);
        
        // Or with 'using' directive:
        // return value.serialize();
    }
    
    function deserializeData(bytes memory data) external pure returns (uint256) {
        (uint256 value, ) = NeoSerializerLib.deserializeUint256(data, 0);
        return value;
    }
}
```

### Examples

See the `contracts/examples/` directory for complete examples:

- **ExampleUsage.sol**: Basic serialization/deserialization patterns
- **ContractCallExample.sol**: Serializing Neo contract calls
- **StorageExample.sol**: Using the library for on-chain storage
- **CrossChainExample.sol**: Cross-chain interoperability with Neo blockchain

### Compile

```bash
npm run compile
```

### Test

```bash
npm test
```

## API Reference

### Serialization Functions

```solidity
// Primitives
bytes memory serialized = NeoSerializerLib.serialize(true);        // Boolean
bytes memory serialized = NeoSerializerLib.serialize(42);           // Integer
bytes memory serialized = NeoSerializerLib.serialize(hex"010203");  // Bytes
bytes memory serialized = NeoSerializerLib.serialize("hello");      // String

// Arrays
uint256[] memory arr = new uint256[](3);
arr[0] = 1; arr[1] = 2; arr[2] = 3;
bytes memory serialized = NeoSerializerLib.serialize(arr);         // Array of integers

bytes[] memory items = new bytes[](2);
items[0] = hex"0102";
items[1] = hex"0304";
bytes memory serialized = NeoSerializerLib.serialize(items);        // Array of bytes

// Neo-specific
bytes memory serialized = NeoSerializerLib.serializeHash160(0x...); // Hash160 (reversed)
bytes memory serialized = NeoSerializerLib.serializeBuffer(hex"..."); // Buffer (type 0x30)

// Contract calls
bytes[] memory args = new bytes[](2);
args[0] = NeoSerializerLib.serialize("url");
args[1] = NeoSerializerLib.serialize(100);
bytes memory call = NeoSerializerLib.serializeCall(
    target,
    "methodName",
    NeoSerializerLib.CALL_FLAGS_ALL,
    args
);
```

### Deserialization Functions

```solidity
uint256 offset = 0;

// Deserialize a boolean
(bool value, offset) = NeoSerializerLib.deserializeBool(data, offset);

// Deserialize an integer
(uint256 value, offset) = NeoSerializerLib.deserializeUint256(data, offset);

// Deserialize bytes
(bytes memory value, offset) = NeoSerializerLib.deserializeBytes(data, offset);

// Deserialize an array
(bytes[] memory items, offset) = NeoSerializerLib.deserializeArray(data, offset);
```

### Gas-Optimized Mutations

```solidity
// Serialize call off-chain with placeholder
bytes[] memory args = new bytes[](6);
// ... populate args ...
args[6] = NeoSerializerLib.serialize(0); // placeholder nonce
bytes memory baseCall = NeoSerializerLib.serializeCall(target, method, flags, args);

// On-chain: append a new argument
bytes memory newArg = NeoSerializerLib.serialize(42);
bytes memory withAppend = NeoSerializerLib.appendArgToCall(baseCall, newArg);

// On-chain: replace the last argument (more efficient than append)
bytes memory realNonce = NeoSerializerLib.serialize(100);
uint256 placeholderLen = 2; // serialize(0) = 2 bytes (0x21 0x00)
bytes memory withReplace = NeoSerializerLib.replaceLastArg(baseCall, placeholderLen, realNonce);
```

## Implementation Details

### Array Serialization Order

Neo serializes arrays with items in **forward order** (first element first). This matches Neo's BinarySerializer behavior.

### Integer Encoding

Integers are encoded as:
1. Type byte (0x21)
2. VarInt encoding of byte length
3. Little-endian bytes
   - Zero is encoded as empty bytes: `0x21 0x00`
   - Sign extension: if MSB ≥ 0x80, adds `0x00` byte to keep value positive

### VarInt Encoding

Neo uses a compact variable-length integer format:
- 0-252: Direct byte value (1 byte)
- 253-65535: `0xFD` + 2-byte little-endian uint16 (3 bytes)
- 65536-4294967295: `0xFE` + 4-byte little-endian uint32 (5 bytes)
- 4294967296+: `0xFF` + 8-byte little-endian uint64 (9 bytes)

### Hash160 Byte Order

Neo's `UInt160` uses **little-endian** byte order. The `serializeHash160` function automatically reverses the input bytes to match Neo's format.

## Testing

The test suite covers:
- VarInt encoding/decoding for all size cases
- Primitive type serialization/deserialization
- Array serialization with forward ordering
- Round-trip tests (serialize → deserialize → compare)
- Edge cases (zero, max values, large arrays)
- Error handling
- Exact byte format verification against Neo specification
- Contract call serialization (including real Neo node comparison)
- Gas-optimized mutations (append/replace)
- Assembly optimization safety (73+ tests)
- Gas cost analysis

Run tests:
```bash
npm test
```

## CI/CD

GitHub Actions workflow runs tests on:
- Pull requests to `main`, `master`, or `develop`
- Pushes to `main`, `master`, or `develop`
- Node.js versions: 18.x and 20.x

## Publishing

```bash
# Dry run (test what would be published)
npm run publish:dry-run

# Publish to npm (runs compile + test first)
npm run publish:public
```

## License

Apache-2.0
