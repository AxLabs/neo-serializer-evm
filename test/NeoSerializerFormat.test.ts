import { expect } from "chai";
import { ethers } from "hardhat";
import { NeoSerializerTestHelper } from "../typechain-types";

/**
 * Tests to verify the exact byte format matches Neo's specification
 * These tests ensure we're not just doing round-trips, but actually
 * producing the correct binary format.
 */
describe("NeoSerializer Format Verification", function () {
  let serializer: NeoSerializerTestHelper;

  before(async function () {
    const NeoSerializerFactory = await ethers.getContractFactory("NeoSerializerTestHelper");
    serializer = (await NeoSerializerFactory.deploy()) as unknown as NeoSerializerTestHelper;
    await serializer.waitForDeployment();
  });

  describe("Boolean Format", function () {
    it("Should produce correct format for false", async function () {
      const serializeBool = serializer.getFunction("serialize(bool)");
      const encoded = await serializeBool(false);
      const bytes = ethers.getBytes(encoded);
      
      // Neo format: type (0x20) + value (0x00)
      expect(bytes.length).to.equal(2);
      expect(bytes[0]).to.equal(0x20); // Boolean type (corrected from Neo tests)
      expect(bytes[1]).to.equal(0x00); // false
    });

    it("Should produce correct format for true", async function () {
      const serializeBool = serializer.getFunction("serialize(bool)");
      const encoded = await serializeBool(true);
      const bytes = ethers.getBytes(encoded);
      
      // Neo format: type (0x20) + value (0x01)
      expect(bytes.length).to.equal(2);
      expect(bytes[0]).to.equal(0x20); // Boolean type (corrected from Neo tests)
      expect(bytes[1]).to.equal(0x01); // true
    });
  });

  describe("Integer Format", function () {
    it("Should produce correct format for zero", async function () {
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const encoded = await serializeUint(0);
      const bytes = ethers.getBytes(encoded);
      
      // Neo format: type (0x21) + VarInt(0)
      // Neo's BinarySerializer: BigInteger.IsZero ? Array.Empty<byte>() : ...
      // Zero is represented with zero data bytes (empty), NOT a single 0x00 byte
      expect(bytes[0]).to.equal(0x21); // Integer type
      expect(bytes[1]).to.equal(0x00); // VarInt length = 0 (empty bytes for zero)
      expect(bytes.length).to.equal(2);
    });

    it("Should produce correct format for small integer", async function () {
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const encoded = await serializeUint(42);
      const bytes = ethers.getBytes(encoded);
      
      // Neo format: type (0x21) + VarInt(1) + byte(0x2A)
      expect(bytes[0]).to.equal(0x21); // Integer type (corrected from Neo tests)
      expect(bytes[1]).to.equal(0x01); // VarInt length = 1
      expect(bytes[2]).to.equal(0x2A); // 42 in hex
      expect(bytes.length).to.equal(3);
    });
  });

  describe("ByteString Format", function () {
    it("Should produce correct format for empty bytes", async function () {
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const encoded = await serializeBytes(ethers.toUtf8Bytes(""));
      const bytes = ethers.getBytes(encoded);
      
      // Neo format: type (0x28) + VarInt(0) = 0x28 0x00
      expect(bytes.length).to.equal(2);
      expect(bytes[0]).to.equal(0x28); // ByteString type (corrected from Neo tests)
      expect(bytes[1]).to.equal(0x00); // VarInt(0)
    });

    it("Should produce correct format for non-empty bytes", async function () {
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const testBytes = ethers.toUtf8Bytes("hello");
      const encoded = await serializeBytes(testBytes);
      const bytes = ethers.getBytes(encoded);
      
      // Neo format: type (0x28) + VarInt(5) + "hello"
      expect(bytes[0]).to.equal(0x28); // ByteString type (corrected from Neo tests)
      expect(bytes[1]).to.equal(0x05); // VarInt length = 5
      expect(bytes.length).to.equal(7); // 1 + 1 + 5
      // Verify the actual bytes
      const dataBytes = bytes.slice(2);
      expect(ethers.toUtf8String(dataBytes)).to.equal("hello");
    });
  });

  describe("Array Format", function () {
    it("Should produce correct format for empty array", async function () {
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const encoded = await serializeArray([]);
      const bytes = ethers.getBytes(encoded);
      
      // Neo format: type (0x40) + VarInt(0) = 0x40 0x00
      expect(bytes.length).to.equal(2);
      expect(bytes[0]).to.equal(0x40); // Array type (corrected from Neo tests)
      expect(bytes[1]).to.equal(0x00); // VarInt(0)
    });

    it("Should produce correct format for single element array", async function () {
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const encoded = await serializeArray([42n]);
      const bytes = ethers.getBytes(encoded);
      
      // Neo format: type (0x40) + VarInt(1) + serialized(42)
      // serialized(42) = 0x21 0x01 0x2A
      expect(bytes[0]).to.equal(0x40); // Array type (corrected from Neo tests)
      expect(bytes[1]).to.equal(0x01); // VarInt count = 1
      // The item should be serialized (type + VarInt length + value)
      expect(bytes[2]).to.equal(0x21); // Integer type for the item (corrected)
      expect(bytes[3]).to.equal(0x01); // VarInt length = 1
      expect(bytes[4]).to.equal(0x2A); // value 42
    });

    it("Should serialize items in forward order", async function () {
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const encoded = await serializeArray([1n, 2n, 3n]);
      const bytes = ethers.getBytes(encoded);
      
      // Neo's BinarySerializer uses a stack: pushes items in reverse onto the stack,
      // so they pop in forward order. The result is items in forward order in the byte stream.
      expect(bytes[0]).to.equal(0x40); // Array type
      expect(bytes[1]).to.equal(0x03); // VarInt count = 3
      
      let offset = 2;
      
      // First item in serialized order should be 1 (first in original array)
      expect(bytes[offset]).to.equal(0x21);
      expect(bytes[offset + 1]).to.equal(0x01);
      expect(bytes[offset + 2]).to.equal(0x01); // value 1
      offset += 3;
      
      // Second item should be 2
      expect(bytes[offset]).to.equal(0x21);
      expect(bytes[offset + 1]).to.equal(0x01);
      expect(bytes[offset + 2]).to.equal(0x02); // value 2
      offset += 3;
      
      // Third item should be 3
      expect(bytes[offset]).to.equal(0x21);
      expect(bytes[offset + 1]).to.equal(0x01);
      expect(bytes[offset + 2]).to.equal(0x03); // value 3
    });
  });
});
