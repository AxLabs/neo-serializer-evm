import { expect } from "chai";
import { ethers } from "hardhat";
import { NeoSerializerTestHelper } from "../typechain-types";

describe("Contract Call Serialization", function () {
  let serializer: NeoSerializerTestHelper;

  before(async function () {
    const NeoSerializerFactory = await ethers.getContractFactory("NeoSerializerTestHelper");
    serializer = (await NeoSerializerFactory.deploy()) as unknown as NeoSerializerTestHelper;
    await serializer.waitForDeployment();
  });

  function toHex(data: string): string {
    return ethers.hexlify(data).slice(2).toLowerCase();
  }

  function reverseHex(hex: string): string {
    const bytes = hex.match(/.{2}/g);
    if (!bytes) return hex;
    return bytes.reverse().join("");
  }

  // Helper to get serializeCall with bytes20 signature (to avoid ambiguity)
  function getSerializeCall(serializer: NeoSerializerTestHelper) {
    return serializer.getFunction("serializeCall(bytes20,string,uint256,bytes[])");
  }

  describe("serializeCall — exact byte format (Neo-compatible)", function () {
    it("Should produce exact bytes for call with no arguments", async function () {
      // Neo serializes array items in FORWARD order: [target, method, callFlags, args]
      const targetDisplay = "1234567890abcdef1234567890abcdef12345678";
      const targetLE = reverseHex(targetDisplay);
      const target = `0x${targetDisplay}` as `0x${string}`;

      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(target, "test", 1, []);
      const hex = toHex(serialized);

      const expected =
        "40" + "04" +                        // Array(4)
        "28" + "14" + targetLE +             // [0] target = ByteString(20 bytes, little-endian)
        "28" + "04" + "74657374" +           // [1] method = ByteString("test")
        "21" + "01" + "01" +                 // [2] callFlags = Integer(1)
        "40" + "00";                         // [3] args = Array(0)

      expect(hex).to.equal(expected);
    });

    it("Should produce exact bytes for call with integer args", async function () {
      const targetDisplay = "d2a4cff31913016155e38e474a2c06d08be276cf";
      const targetLE = reverseHex(targetDisplay);
      const target = `0x${targetDisplay}` as `0x${string}`;

      const serializeUint = serializer.getFunction("serialize(uint256)");
      const arg1 = await serializeUint(100n);
      const arg2 = await serializeUint(200n);

      // Verify individual serializations match Neo's format
      expect(toHex(arg1)).to.equal("210164");     // Integer(100): no sign extension
      expect(toHex(arg2)).to.equal("2102c800");   // Integer(200): 0xC8 ≥ 0x80 → extra 0x00

      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(
        target, "transfer", 15, [arg1, arg2]
      );
      const hex = toHex(serialized);

      const expected =
        "40" + "04" +                                         // Outer Array(4)
        "28" + "14" + targetLE +                              // [0] target (little-endian)
        "28" + "08" + "7472616e73666572" +                    // [1] method = ByteString("transfer")
        "21" + "01" + "0f" +                                  // [2] callFlags = Integer(15)
        "40" + "02" + "210164" + "2102c800";                  // [3] args = Array(2) forward

      expect(hex).to.equal(expected);
    });

    it("Should produce exact bytes for call with mixed args", async function () {
      const targetDisplay = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const targetLE = reverseHex(targetDisplay);
      const target = `0x${targetDisplay}` as `0x${string}`;

      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeString = serializer.getFunction("serialize(string)");
      const serializeBytes = serializer.getFunction("serialize(bytes)");

      const arg1 = await serializeUint(42n);
      const arg2 = await serializeString("hello");
      const arg3 = await serializeBytes("0x0102");

      expect(toHex(arg1)).to.equal("21012a");
      expect(toHex(arg2)).to.equal("280568656c6c6f");
      expect(toHex(arg3)).to.equal("28020102");

      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(
        target, "set", 2, [arg1, arg2, arg3]
      );
      const hex = toHex(serialized);

      const expected =
        "40" + "04" +
        "28" + "14" + targetLE +                                   // [0] target LE
        "28" + "03" + "736574" +                                   // [1] method
        "21" + "01" + "02" +                                       // [2] callFlags
        "40" + "03" + "21012a" + "280568656c6c6f" + "28020102";   // [3] args forward

      expect(hex).to.equal(expected);
    });

    it("Should serialize target in little-endian (Neo UInt160 format)", async function () {
      const targetDisplay = "ef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
      const targetLE = reverseHex(targetDisplay);
      const target = `0x${targetDisplay}` as `0x${string}`;

      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(target, "a", 0, []);
      const hex = toHex(serialized);

      // Integer(0) = 21 00 (empty bytes for zero, matching Neo BigInteger)
      const expected =
        "40" + "04" +
        "28" + "14" + targetLE +   // [0] target
        "28" + "01" + "61" +       // [1] method "a"
        "21" + "00" +              // [2] Integer(0): zero = empty bytes
        "40" + "00";               // [3] args = Array(0)

      expect(hex).to.equal(expected);
    });

    it("Should handle sign extension for integers correctly", async function () {
      // Verify .NET BigInteger.ToByteArray() compatibility
      const serializeUint = serializer.getFunction("serialize(uint256)");

      expect(toHex(await serializeUint(0n))).to.equal("2100");           // zero → empty bytes
      expect(toHex(await serializeUint(1n))).to.equal("210101");         // [0x01]
      expect(toHex(await serializeUint(127n))).to.equal("21017f");       // [0x7F]
      expect(toHex(await serializeUint(128n))).to.equal("21028000");     // [0x80, 0x00] sign ext
      expect(toHex(await serializeUint(255n))).to.equal("2102ff00");     // [0xFF, 0x00] sign ext
      expect(toHex(await serializeUint(256n))).to.equal("21020001");     // [0x00, 0x01] no sign
      expect(toHex(await serializeUint(65535n))).to.equal("2103ffff00"); // [0xFF, 0xFF, 0x00]
      expect(toHex(await serializeUint(10000000n))).to.equal("210480969800"); // [0x80, 0x96, 0x98, 0x00]
      expect(toHex(await serializeUint(50000000n))).to.equal("210480f0fa02"); // [0x80, 0xF0, 0xFA, 0x02]
    });
  });

  describe("serializeHash160 — exact byte format", function () {
    it("Should reverse bytes and serialize as ByteString", async function () {
      const hash = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5" as `0x${string}`;
      const serializeHash160 = serializer.getFunction("serializeHash160(bytes20)");
      const serialized = await serializeHash160(hash);
      expect(toHex(serialized)).to.equal("2814f563ea40bc283d4d0e05c48ea305b3f2a07340ef");
    });
  });

  describe("serializeBuffer — exact byte format", function () {
    it("Should serialize empty buffer with type 0x30", async function () {
      const serialized = await serializer.serializeBuffer("0x");
      expect(toHex(serialized)).to.equal("3000");
    });

    it("Should serialize non-empty buffer with type 0x30", async function () {
      const serialized = await serializer.serializeBuffer("0x010203");
      expect(toHex(serialized)).to.equal("3003010203");
    });
  });

  describe("serializeCall — round-trip verification", function () {
    it("Should round-trip target bytes (little-endian) through deserialization", async function () {
      const targetDisplay = "d2a4cff31913016155e38e474a2c06d08be276cf";
      const targetLE = reverseHex(targetDisplay);
      const target = `0x${targetDisplay}` as `0x${string}`;

      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(target, "method", 1, []);
      const [items] = await serializer.deserializeArray(serialized, 0);
      expect(items.length).to.equal(4);

      const [targetBytes] = await serializer.deserializeBytes(items[0], 0);
      expect(toHex(targetBytes)).to.equal(targetLE);
    });

    it("Should round-trip method name through deserialization", async function () {
      const target = "0xd2a4cff31913016155e38e474a2c06d08be276cf" as `0x${string}`;
      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(target, "myMethod", 1, []);

      const [items] = await serializer.deserializeArray(serialized, 0);
      const [methodBytes] = await serializer.deserializeBytes(items[1], 0);
      expect(ethers.toUtf8String(methodBytes)).to.equal("myMethod");
    });

    it("Should round-trip call flags through deserialization", async function () {
      const target = "0xd2a4cff31913016155e38e474a2c06d08be276cf" as `0x${string}`;

      for (const flag of [0, 1, 2, 4, 8, 15]) {
        const serializeCall = getSerializeCall(serializer);
        const serialized = await serializeCall(target, "m", flag, []);
        const [items] = await serializer.deserializeArray(serialized, 0);
        const [value] = await serializer.deserializeUint256(items[2], 0);
        expect(Number(value)).to.equal(flag);
      }
    });

    it("Should round-trip args through deserialization", async function () {
      const target = "0xd2a4cff31913016155e38e474a2c06d08be276cf" as `0x${string}`;
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const arg1 = await serializeUint(100n);
      const arg2 = await serializeUint(200n);

      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(target, "m", 1, [arg1, arg2]);
      const [items] = await serializer.deserializeArray(serialized, 0);
      const [argsItems] = await serializer.deserializeArray(items[3], 0);
      expect(argsItems.length).to.equal(2);

      const [v1] = await serializer.deserializeUint256(argsItems[0], 0);
      const [v2] = await serializer.deserializeUint256(argsItems[1], 0);
      expect(v1).to.equal(100n);
      expect(v2).to.equal(200n);
    });

    it("Should round-trip mixed-type args", async function () {
      const target = "0xd2a4cff31913016155e38e474a2c06d08be276cf" as `0x${string}`;
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeString = serializer.getFunction("serialize(string)");
      const serializeBool = serializer.getFunction("serialize(bool)");

      const arg1 = await serializeUint(999n);
      const arg2 = await serializeString("hello");
      const arg3 = await serializeBool(true);

      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(target, "fn", 15, [arg1, arg2, arg3]);
      const [items] = await serializer.deserializeArray(serialized, 0);
      const [argsItems] = await serializer.deserializeArray(items[3], 0);
      expect(argsItems.length).to.equal(3);

      const [v1] = await serializer.deserializeUint256(argsItems[0], 0);
      expect(v1).to.equal(999n);

      const [v2] = await serializer.deserializeBytes(argsItems[1], 0);
      expect(ethers.toUtf8String(v2)).to.equal("hello");

      const [v3] = await serializer.deserializeBool(argsItems[2], 0);
      expect(v3).to.equal(true);
    });
  });

  describe("Address type support", function () {
    it("Should serialize address as Hash160 (same as bytes20)", async function () {
      const addr = "0xd2a4cff31913016155e38e474a2c06d08be276cf" as `0x${string}`;
      const addrBytes20 = ethers.zeroPadValue(addr, 20);
      
      // Serialize using address (explicitly specify function signature)
      const serializeHash160Addr = serializer.getFunction("serializeHash160(address)");
      const serializedAddr = await serializeHash160Addr(addr);
      
      // Serialize using bytes20
      const serializeHash160Bytes20 = serializer.getFunction("serializeHash160(bytes20)");
      const serializedBytes20 = await serializeHash160Bytes20(addrBytes20);
      
      // Should produce identical output
      expect(toHex(serializedAddr)).to.equal(toHex(serializedBytes20));
    });

    it("Should serialize call with address target (same as bytes20)", async function () {
      const addr = "0xd2a4cff31913016155e38e474a2c06d08be276cf" as `0x${string}`;
      const addrBytes20 = ethers.zeroPadValue(addr, 20);
      
      // Serialize call using address (explicitly specify function signature)
      const serializeCallAddr = serializer.getFunction("serializeCall(address,string,uint256,bytes[])");
      const serializedAddr = await serializeCallAddr(addr, "test", 1, []);
      
      // Serialize call using bytes20
      const serializeCallBytes20 = serializer.getFunction("serializeCall(bytes20,string,uint256,bytes[])");
      const serializedBytes20 = await serializeCallBytes20(addrBytes20, "test", 1, []);
      
      // Should produce identical output
      expect(toHex(serializedAddr)).to.equal(toHex(serializedBytes20));
    });
  });
});
