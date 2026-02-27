// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../libraries/NeoSerializerLib.sol";

/**
 * @title ExampleUsage
 * @notice Example contract demonstrating how to use NeoSerializerLib
 */
contract ExampleUsage {
    using NeoSerializerLib for bytes;
    using NeoSerializerLib for uint256;
    using NeoSerializerLib for bool;

    /**
     * @notice Example: Serialize data using the library directly
     * @dev Functions are inlined, so no external call overhead
     */
    function serializeData(
        bool flag,
        uint256 number,
        bytes memory data
    ) external pure returns (bytes memory) {
        // Serialize each value
        bytes memory serializedBool = NeoSerializerLib.serialize(flag);
        bytes memory serializedNumber = NeoSerializerLib.serialize(number);
        bytes memory serializedBytes = NeoSerializerLib.serialize(data);
        
        // Combine them (in a real scenario, you might put them in an array)
        bytes memory combined = abi.encodePacked(
            serializedBool,
            serializedNumber,
            serializedBytes
        );
        
        return combined;
    }

    /**
     * @notice Example: Using the library with 'using' directive
     * @dev This allows calling serialize() directly on the type
     */
    function serializeWithUsing(
        bool flag,
        uint256 number,
        bytes memory data
    ) external pure returns (bytes memory) {
        // With 'using', you can call serialize directly on the value
        bytes memory serializedBool = flag.serialize();
        bytes memory serializedNumber = number.serialize();
        bytes memory serializedBytes = data.serialize();
        
        return abi.encodePacked(
            serializedBool,
            serializedNumber,
            serializedBytes
        );
    }

    /**
     * @notice Example: Deserialize data
     */
    function deserializeData(bytes memory serialized) 
        external 
        pure 
        returns (
            bool flag,
            uint256 number,
            bytes memory data
        ) 
    {
        uint256 offset = 0;
        
        // Deserialize boolean
        (flag, offset) = NeoSerializerLib.deserializeBool(serialized, offset);
        
        // Deserialize integer
        (number, offset) = NeoSerializerLib.deserializeUint256(serialized, offset);
        
        // Deserialize bytes
        (data, offset) = NeoSerializerLib.deserializeBytes(serialized, offset);
        
        return (flag, number, data);
    }

    /**
     * @notice Example: Round-trip serialization
     */
    function roundTrip(uint256 value) external pure returns (uint256) {
        bytes memory serialized = NeoSerializerLib.serialize(value);
        (uint256 deserialized, ) = NeoSerializerLib.deserializeUint256(serialized, 0);
        return deserialized;
    }
}
