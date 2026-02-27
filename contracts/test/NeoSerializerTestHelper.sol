// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../libraries/NeoSerializerLib.sol";

/**
 * @title NeoSerializerTestHelper
 * @notice Helper contract for testing NeoSerializerLib
 * @dev Libraries can't be called directly from tests, so we wrap them in a contract
 */
contract NeoSerializerTestHelper {
    // Re-export constants for testing
    uint256 public constant MAX_ITEM_SIZE = 1024 * 1024; // 1MB
    uint256 public constant MAX_STACK_SIZE = 1024;
    
    // CallFlags constants (from NeoSerializerLib)
    uint256 public constant CALL_FLAGS_NONE = NeoSerializerLib.CALL_FLAGS_NONE;
    uint256 public constant CALL_FLAGS_READ_STATES = NeoSerializerLib.CALL_FLAGS_READ_STATES;
    uint256 public constant CALL_FLAGS_WRITE_STATES = NeoSerializerLib.CALL_FLAGS_WRITE_STATES;
    uint256 public constant CALL_FLAGS_ALLOW_CALL = NeoSerializerLib.CALL_FLAGS_ALLOW_CALL;
    uint256 public constant CALL_FLAGS_ALLOW_NOTIFY = NeoSerializerLib.CALL_FLAGS_ALLOW_NOTIFY;
    uint256 public constant CALL_FLAGS_STATES = NeoSerializerLib.CALL_FLAGS_STATES;
    uint256 public constant CALL_FLAGS_READ_ONLY = NeoSerializerLib.CALL_FLAGS_READ_ONLY;
    uint256 public constant CALL_FLAGS_ALL = NeoSerializerLib.CALL_FLAGS_ALL;

    // Serialization functions
    function serialize(bool value) external pure returns (bytes memory) {
        return NeoSerializerLib.serialize(value);
    }

    function serialize(uint256 value) external pure returns (bytes memory) {
        return NeoSerializerLib.serialize(value);
    }

    function serialize(bytes memory value) external pure returns (bytes memory) {
        return NeoSerializerLib.serialize(value);
    }

    function serialize(string memory value) external pure returns (bytes memory) {
        return NeoSerializerLib.serialize(value);
    }

    function serialize(uint256[] memory value) external pure returns (bytes memory) {
        return NeoSerializerLib.serialize(value);
    }

    function serialize(bytes[] memory value) external pure returns (bytes memory) {
        return NeoSerializerLib.serialize(value);
    }

    // Deserialization functions
    function deserializeBool(
        bytes memory data,
        uint256 offset
    ) external pure returns (bool value, uint256 newOffset) {
        return NeoSerializerLib.deserializeBool(data, offset);
    }

    function deserializeUint256(
        bytes memory data,
        uint256 offset
    ) external pure returns (uint256 value, uint256 newOffset) {
        return NeoSerializerLib.deserializeUint256(data, offset);
    }

    function deserializeBytes(
        bytes memory data,
        uint256 offset
    ) external pure returns (bytes memory value, uint256 newOffset) {
        return NeoSerializerLib.deserializeBytes(data, offset);
    }

    function deserializeArray(
        bytes memory data,
        uint256 offset
    ) external pure returns (bytes[] memory items, uint256 newOffset) {
        return NeoSerializerLib.deserializeArray(data, offset);
    }

    // Hash160 serialization (reversed byte order, matching Neo UInt160)
    function serializeHash160(bytes20 value) external pure returns (bytes memory) {
        return NeoSerializerLib.serializeHash160(value);
    }

    // Hash160 serialization (address overload)
    function serializeHash160(address value) external pure returns (bytes memory) {
        return NeoSerializerLib.serializeHash160(value);
    }

    // Buffer serialization (type 0x30, for ByteArray contract params)
    function serializeBuffer(bytes memory value) external pure returns (bytes memory) {
        return NeoSerializerLib.serializeBuffer(value);
    }

    // Contract call serialization
    function serializeCall(
        bytes20 target,
        string memory method,
        uint256 callFlags,
        bytes[] memory args
    ) external pure returns (bytes memory) {
        return NeoSerializerLib.serializeCall(target, method, callFlags, args);
    }

    // Contract call serialization (address overload)
    function serializeCall(
        address target,
        string memory method,
        uint256 callFlags,
        bytes[] memory args
    ) external pure returns (bytes memory) {
        return NeoSerializerLib.serializeCall(target, method, callFlags, args);
    }

    // Append arg to an existing serialized call (auto-navigating)
    function appendArgToCall(
        bytes memory serializedCall,
        bytes memory serializedArg
    ) external pure returns (bytes memory) {
        return NeoSerializerLib.appendArgToCall(serializedCall, serializedArg);
    }

    // Append arg to an existing serialized call (fast: pre-computed offset)
    function appendArgToCall(
        bytes memory serializedCall,
        uint256 innerArrayCountOffset,
        bytes memory serializedArg
    ) external pure returns (bytes memory) {
        return NeoSerializerLib.appendArgToCall(serializedCall, innerArrayCountOffset, serializedArg);
    }

    // Replace last arg in an existing serialized call
    // oldArgSerializedLength = byte length of the old (placeholder) last arg
    // e.g. serialize(0) is 2 bytes, so pass 2
    function replaceLastArg(
        bytes memory serializedCall,
        uint256 oldArgSerializedLength,
        bytes memory newSerializedArg
    ) external pure returns (bytes memory) {
        return NeoSerializerLib.replaceLastArg(serializedCall, oldArgSerializedLength, newSerializedArg);
    }

    // Utility: toLittleEndianBytes
    function toLittleEndianBytes(uint256 value) external pure returns (bytes memory) {
        return NeoSerializerLib.toLittleEndianBytes(value);
    }

}
