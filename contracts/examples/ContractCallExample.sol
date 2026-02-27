// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../libraries/NeoSerializerLib.sol";

/**
 * @title ContractCallExample
 * @notice Example contract showing how to serialize Neo contract calls
 * @dev Demonstrates serializing contract calls for cross-chain or off-chain execution
 */
contract ContractCallExample {
    using NeoSerializerLib for uint256;
    using NeoSerializerLib for bytes;

    // Note: CallFlags constants are available from NeoSerializerLib:
    // NeoSerializerLib.CALL_FLAGS_NONE, CALL_FLAGS_READ_STATES, etc.

    /**
     * @notice Serialize a simple contract call with integer arguments
     * @param target The contract hash (Hash160 - 20 bytes)
     * @param method The method name to call
     * @param arg1 First integer argument
     * @param arg2 Second integer argument
     * @return The serialized contract call
     */
    function serializeSimpleCall(
        bytes20 target,
        string memory method,
        uint256 arg1,
        uint256 arg2
    ) external pure returns (bytes memory) {
        // Serialize arguments
        bytes[] memory args = new bytes[](2);
        args[0] = NeoSerializerLib.serialize(arg1);
        args[1] = NeoSerializerLib.serialize(arg2);
        
        // Serialize the call with ReadStates flag (read-only call)
        return NeoSerializerLib.serializeCall(
            target,
            method,
            NeoSerializerLib.CALL_FLAGS_READ_STATES,
            args
        );
    }

    /**
     * @notice Serialize a contract call with mixed argument types
     * @param target The contract hash
     * @param method The method name
     * @param numberArg Integer argument
     * @param stringArg String argument
     * @param bytesArg Bytes argument
     * @return The serialized contract call
     */
    function serializeMixedCall(
        bytes20 target,
        string memory method,
        uint256 numberArg,
        string memory stringArg,
        bytes memory bytesArg
    ) external pure returns (bytes memory) {
        // Serialize arguments of different types
        bytes[] memory args = new bytes[](3);
        args[0] = NeoSerializerLib.serialize(numberArg);
        args[1] = NeoSerializerLib.serialize(stringArg);
        args[2] = NeoSerializerLib.serialize(bytesArg);
        
        // Serialize the call with WriteStates flag (state-changing call)
        return NeoSerializerLib.serializeCall(
            target,
            method,
            NeoSerializerLib.CALL_FLAGS_WRITE_STATES,
            args
        );
    }

    /**
     * @notice Serialize a contract call with no arguments
     * @param target The contract hash
     * @param method The method name
     * @return The serialized contract call
     */
    function serializeNoArgCall(
        bytes20 target,
        string memory method
    ) external pure returns (bytes memory) {
        // Empty arguments array
        bytes[] memory args = new bytes[](0);
        
        // Serialize the call
        return NeoSerializerLib.serializeCall(
            target,
            method,
            NeoSerializerLib.CALL_FLAGS_READ_STATES,
            args
        );
    }

    /**
     * @notice Serialize a contract call with custom flags
     * @param target The contract hash
     * @param method The method name
     * @param callFlags Custom call flags (can combine multiple flags)
     * @param args Array of serialized arguments
     * @return The serialized contract call
     */
    function serializeCustomCall(
        bytes20 target,
        string memory method,
        uint256 callFlags,
        bytes[] memory args
    ) external pure returns (bytes memory) {
        return NeoSerializerLib.serializeCall(target, method, callFlags, args);
    }
}
