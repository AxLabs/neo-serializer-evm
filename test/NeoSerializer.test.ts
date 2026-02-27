import { expect } from "chai";
import { ethers } from "hardhat";
import { NeoSerializerTestHelper } from "../typechain-types";

describe("NeoSerializer", function () {
  let serializer: NeoSerializerTestHelper;

  before(async function () {
    const NeoSerializerFactory = await ethers.getContractFactory("NeoSerializerTestHelper");
    serializer = (await NeoSerializerFactory.deploy()) as unknown as NeoSerializerTestHelper;
    await serializer.waitForDeployment();
  });

  describe("VarInt Encoding/Decoding", function () {
    it("Should encode/decode small values (< 0xFD)", async function () {
      const testValues = [0, 1, 100, 252];
      for (const value of testValues) {
        const serializeUint = serializer.getFunction("serialize(uint256)");
        const encoded = await serializeUint(value);
        // For value 0: type (0x02) + VarInt(1) + byte(0x00) = 0x02 0x01 0x00
        // For value 1: type (0x02) + VarInt(1) + byte(0x01) = 0x02 0x01 0x01
        expect(encoded.length).to.be.greaterThan(0);
        
        const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
        expect(decoded).to.equal(BigInt(value));
      }
    });

    it("Should encode/decode medium values (0xFD - 0xFFFF)", async function () {
      const testValues = [253, 1000, 65535];
      const serializeUint = serializer.getFunction("serialize(uint256)");
      for (const value of testValues) {
        const encoded = await serializeUint(value);
        const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
        expect(decoded).to.equal(BigInt(value));
      }
    });

    it("Should encode/decode large values (0x10000 - 0xFFFFFFFF)", async function () {
      const testValues = [65536, 100000, 4294967295];
      const serializeUint = serializer.getFunction("serialize(uint256)");
      for (const value of testValues) {
        const encoded = await serializeUint(value);
        const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
        expect(decoded).to.equal(BigInt(value));
      }
    });

    it("Should encode/decode very large values (uint64 max)", async function () {
      const maxUint64 = BigInt("18446744073709551615");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const encoded = await serializeUint(maxUint64);
      const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
      expect(decoded).to.equal(maxUint64);
    });
  });

  describe("Boolean Serialization", function () {
    it("Should serialize false", async function () {
      const serializeBool = serializer.getFunction("serialize(bool)");
      const encoded = await serializeBool(false);
      const encodedBytes = ethers.getBytes(encoded);
      expect(encodedBytes[0]).to.equal(0x20); // Boolean type (Neo format)
      expect(encodedBytes[1]).to.equal(0x00); // false value
    });

    it("Should serialize true", async function () {
      const serializeBool = serializer.getFunction("serialize(bool)");
      const encoded = await serializeBool(true);
      const encodedBytes = ethers.getBytes(encoded);
      expect(encodedBytes[0]).to.equal(0x20); // Boolean type (Neo format)
      expect(encodedBytes[1]).to.equal(0x01); // true value
    });

    it("Should deserialize false", async function () {
      const serializeBool = serializer.getFunction("serialize(bool)");
      const encoded = await serializeBool(false);
      const [value, offset] = await serializer.deserializeBool(encoded, 0);
      expect(value).to.equal(false);
      expect(offset).to.equal(2);
    });

    it("Should deserialize true", async function () {
      const serializeBool = serializer.getFunction("serialize(bool)");
      const encoded = await serializeBool(true);
      const [value, offset] = await serializer.deserializeBool(encoded, 0);
      expect(value).to.equal(true);
      expect(offset).to.equal(2);
    });

    it("Should round-trip boolean values", async function () {
      const testValues = [true, false];
      const serializeBool = serializer.getFunction("serialize(bool)");
      for (const value of testValues) {
        const encoded = await serializeBool(value);
        const [decoded, offset] = await serializer.deserializeBool(encoded, 0);
        expect(decoded).to.equal(value);
      }
    });
  });

  describe("Integer Serialization", function () {
    it("Should serialize zero", async function () {
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const encoded = await serializeUint(0);
      const encodedBytes = ethers.getBytes(encoded);
      expect(encodedBytes[0]).to.equal(0x21); // Integer type (Neo format)
      const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
      expect(decoded).to.equal(0n);
    });

    it("Should serialize small integers", async function () {
      const testValues = [1, 42, 255, 256];
      const serializeUint = serializer.getFunction("serialize(uint256)");
      for (const value of testValues) {
        const encoded = await serializeUint(value);
        const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
        expect(decoded).to.equal(BigInt(value));
      }
    });

    it("Should serialize large integers", async function () {
      const testValues = [
        BigInt("1000000000000000000"), // 1e18
        BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935"), // max uint256
      ];
      const serializeUint = serializer.getFunction("serialize(uint256)");
      for (const value of testValues) {
        const encoded = await serializeUint(value);
        const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
        expect(decoded).to.equal(value);
      }
    });

    it("Should round-trip integer values", async function () {
      const testValues = [
        0, 1, 42, 255, 256, 1000, 65535, 65536,
        BigInt("1000000000000000000"),
        BigInt("18446744073709551615"), // max uint64
      ];
      const serializeUint = serializer.getFunction("serialize(uint256)");
      for (const value of testValues) {
        const encoded = await serializeUint(value);
        const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
        expect(decoded).to.equal(BigInt(value));
      }
    });
  });

  describe("Byte Array Serialization", function () {
    it("Should serialize empty byte array", async function () {
      const emptyBytes = ethers.toUtf8Bytes("");
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const encoded = await serializeBytes(emptyBytes);
      const encodedBytes = ethers.getBytes(encoded);
      expect(encodedBytes[0]).to.equal(0x28); // ByteString type (Neo format)
      const [decoded, offset] = await serializer.deserializeBytes(encoded, 0);
      const decodedBytes = ethers.getBytes(decoded);
      expect(ethers.hexlify(decodedBytes)).to.equal(ethers.hexlify(emptyBytes));
    });

    it("Should serialize small byte arrays", async function () {
      const testArrays = [
        ethers.toUtf8Bytes("hello"),
        ethers.toUtf8Bytes("test"),
        ethers.getBytes("0x000102ff"),
      ];
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      for (const arr of testArrays) {
        const encoded = await serializeBytes(arr);
        const [decoded, offset] = await serializer.deserializeBytes(encoded, 0);
        const decodedBytes = ethers.getBytes(decoded);
        expect(decodedBytes.length).to.equal(arr.length);
        expect(ethers.hexlify(decodedBytes)).to.equal(ethers.hexlify(arr));
      }
    });

    it("Should serialize strings", async function () {
      const testStrings = ["hello", "world", "test string", ""];
      const serializeString = serializer.getFunction("serialize(string)");
      for (const str of testStrings) {
        const encoded = await serializeString(str);
        const [decoded, offset] = await serializer.deserializeBytes(encoded, 0);
        expect(ethers.toUtf8String(decoded)).to.equal(str);
      }
    });

    it("Should round-trip byte arrays", async function () {
      const testArrays = [
        ethers.toUtf8Bytes("hello world"),
        ethers.getBytes("0x00ff42"),
        ethers.toUtf8Bytes(""),
      ];
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      for (const arr of testArrays) {
        const encoded = await serializeBytes(arr);
        const [decoded, offset] = await serializer.deserializeBytes(encoded, 0);
        // Convert to hex for comparison
        expect(ethers.hexlify(decoded)).to.equal(ethers.hexlify(arr));
      }
    });
  });

  describe("Array Serialization", function () {
    it("Should serialize empty integer array", async function () {
      const emptyArray: bigint[] = [];
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const encoded = await serializeArray(emptyArray);
      // Verify it deserializes correctly (round-trip test)
      const [items, offset] = await serializer.deserializeArray(encoded, 0);
      expect(items.length).to.equal(0);
    });

    it("Should serialize single element array", async function () {
      const array = [42n];
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const encoded = await serializeArray(array);
      
      // Deserialize and verify (round-trip test)
      const [items, offset] = await serializer.deserializeArray(encoded, 0);
      expect(items.length).to.equal(1);
      
      // Deserialize the first item
      const [value, itemOffset] = await serializer.deserializeUint256(items[0], 0);
      expect(value).to.equal(42n);
    });

    it("Should serialize multi-element integer array", async function () {
      const array = [1n, 2n, 3n, 4n, 5n];
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const encoded = await serializeArray(array);
      
      // Deserialize and verify (round-trip test)
      const [items, offset] = await serializer.deserializeArray(encoded, 0);
      expect(items.length).to.equal(5);
      
      // Items should be in correct order (not reversed, since we reverse during deserialization)
      for (let i = 0; i < array.length; i++) {
        const [value, itemOffset] = await serializer.deserializeUint256(items[i], 0);
        expect(value).to.equal(array[i]);
      }
    });

    it("Should serialize array of bytes", async function () {
      const array = [
        ethers.toUtf8Bytes("hello"),
        ethers.toUtf8Bytes("world"),
        ethers.toUtf8Bytes("test"),
      ];
      const serializeBytesArray = serializer.getFunction("serialize(bytes[])");
      const encoded = await serializeBytesArray(array);
      
      // Deserialize and verify (round-trip test)
      const [items, offset] = await serializer.deserializeArray(encoded, 0);
      expect(items.length).to.equal(3);
      
      for (let i = 0; i < array.length; i++) {
        const [decoded, itemOffset] = await serializer.deserializeBytes(items[i], 0);
        expect(ethers.toUtf8String(decoded)).to.equal(ethers.toUtf8String(array[i]));
      }
    });

    it("Should round-trip integer arrays", async function () {
      const testArrays = [
        [],
        [42n],
        [1n, 2n, 3n],
        [0n, 1n, 255n, 256n, 1000n],
      ];
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      for (const array of testArrays) {
        const encoded = await serializeArray(array);
        const [items, offset] = await serializer.deserializeArray(encoded, 0);
        expect(items.length).to.equal(array.length);
        
        for (let i = 0; i < array.length; i++) {
          const [value, itemOffset] = await serializer.deserializeUint256(items[i], 0);
          expect(value).to.equal(array[i]);
        }
      }
    });
  });

  describe("Edge Cases", function () {
    it("Should handle maximum uint256", async function () {
      const maxUint256 = BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const encoded = await serializeUint(maxUint256);
      const [decoded, offset] = await serializer.deserializeUint256(encoded, 0);
      expect(decoded).to.equal(maxUint256);
    });

    it("Should handle large byte arrays", async function () {
      // Create a 1000 byte array
      const largeArray = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) {
        largeArray[i] = i % 256;
      }
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const encoded = await serializeBytes(largeArray);
      const [decoded, offset] = await serializer.deserializeBytes(encoded, 0);
      const decodedBytes = ethers.getBytes(decoded);
      expect(decodedBytes.length).to.equal(1000);
      expect(ethers.hexlify(decodedBytes)).to.equal(ethers.hexlify(largeArray));
    });

    it("Should handle arrays with many elements", async function () {
      const array: bigint[] = [];
      for (let i = 0; i < 100; i++) {
        array.push(BigInt(i));
      }
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const encoded = await serializeArray(array);
      const [items, offset] = await serializer.deserializeArray(encoded, 0);
      expect(items.length).to.equal(100);
      
      for (let i = 0; i < 100; i++) {
        const [value, itemOffset] = await serializer.deserializeUint256(items[i], 0);
        expect(value).to.equal(BigInt(i));
      }
    });
  });

  describe("Error Handling", function () {
    it("Should revert on invalid boolean deserialization", async function () {
      const invalidData = ethers.concat([ethers.toUtf8Bytes("\x01"), ethers.toUtf8Bytes("\x02")]);
      await expect(serializer.deserializeBool(invalidData, 0)).to.be.reverted;
    });

    it("Should revert on insufficient data", async function () {
      const shortData = ethers.toUtf8Bytes("\x01");
      await expect(serializer.deserializeBool(shortData, 0)).to.be.reverted;
    });

    it("Should revert on invalid type for integer", async function () {
      const wrongType = ethers.concat([ethers.toUtf8Bytes("\x01"), ethers.toUtf8Bytes("\x00")]);
      await expect(serializer.deserializeUint256(wrongType, 0)).to.be.reverted;
    });
  });
});
