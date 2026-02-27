// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../libraries/NeoSerializerLib.sol";

/**
 * @title CrossChainExample
 * @notice Example contract showing how to use NeoSerializerLib for cross-chain compatibility
 * @dev Serializes data in Neo format for interoperability with Neo blockchain
 */
contract CrossChainExample {
    using NeoSerializerLib for uint256[];
    using NeoSerializerLib for bytes;

    /**
     * @notice Serialize an array of values for cross-chain transfer
     * @param values Array of uint256 values to serialize
     * @return The serialized bytes in Neo format
     */
    function serializeForNeo(uint256[] memory values) external pure returns (bytes memory) {
        return NeoSerializerLib.serialize(values);
    }

    /**
     * @notice Deserialize data received from Neo blockchain
     * @param neoData The serialized data from Neo
     * @return The deserialized array of values
     */
    function deserializeFromNeo(bytes memory neoData) external pure returns (uint256[] memory) {
        (bytes[] memory items, ) = NeoSerializerLib.deserializeArray(neoData, 0);
        
        uint256[] memory values = new uint256[](items.length);
        for (uint256 i = 0; i < items.length; i++) {
            (uint256 value, ) = NeoSerializerLib.deserializeUint256(items[i], 0);
            values[i] = value;
        }
        
        return values;
    }

    /**
     * @notice Serialize complex data structure for cross-chain
     * @param numbers Array of numbers
     * @param data Byte data
     * @return Combined serialized data
     */
    function serializeComplex(
        uint256[] memory numbers,
        bytes memory data
    ) external pure returns (bytes memory) {
        bytes memory serializedNumbers = NeoSerializerLib.serialize(numbers);
        bytes memory serializedData = NeoSerializerLib.serialize(data);
        
        // Combine into a single array for transmission
        bytes[] memory combined = new bytes[](2);
        combined[0] = serializedNumbers;
        combined[1] = serializedData;
        
        return NeoSerializerLib.serialize(combined);
    }
}
