// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../libraries/NeoSerializerLib.sol";

/**
 * @title StorageExample
 * @notice Example contract showing how to use NeoSerializerLib for on-chain storage
 * @dev Demonstrates serializing data before storing it in a mapping
 */
contract StorageExample {
    using NeoSerializerLib for bytes;
    using NeoSerializerLib for uint256;

    // Store serialized data by key
    mapping(bytes32 => bytes) private storageData;

    /**
     * @notice Store serialized data
     * @param key The storage key
     * @param value The value to serialize and store
     */
    function storeUint256(bytes32 key, uint256 value) external {
        bytes memory serialized = NeoSerializerLib.serialize(value);
        storageData[key] = serialized;
    }

    /**
     * @notice Retrieve and deserialize stored data
     * @param key The storage key
     * @return The deserialized uint256 value
     */
    function getUint256(bytes32 key) external view returns (uint256) {
        bytes memory serialized = storageData[key];
        require(serialized.length > 0, "Key not found");
        
        (uint256 value, ) = NeoSerializerLib.deserializeUint256(serialized, 0);
        return value;
    }

    /**
     * @notice Store serialized bytes
     * @param key The storage key
     * @param data The bytes to serialize and store
     */
    function storeBytes(bytes32 key, bytes memory data) external {
        bytes memory serialized = NeoSerializerLib.serialize(data);
        storageData[key] = serialized;
    }

    /**
     * @notice Retrieve and deserialize stored bytes
     * @param key The storage key
     * @return The deserialized bytes
     */
    function getBytes(bytes32 key) external view returns (bytes memory) {
        bytes memory serialized = storageData[key];
        require(serialized.length > 0, "Key not found");
        
        (bytes memory value, ) = NeoSerializerLib.deserializeBytes(serialized, 0);
        return value;
    }
}
