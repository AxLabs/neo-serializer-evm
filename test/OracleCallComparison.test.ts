import { expect } from "chai";
import { ethers } from "hardhat";
import { NeoSerializerTestHelper } from "../typechain-types";

/**
 * Oracle Call Comparison Test
 *
 * Verified against ACTUAL Neo node output. The expected hex string in the
 * "exact match" test was produced by a real Neo N3 node via neon-js's
 * ExecutionManager.serializeCall() RPC invocation.
 *
 * Neo's StdLib.Serialize produces:
 *   Array(4)[
 *     ByteString(target, 20 bytes little-endian),   — Hash160 → UInt160(LE) → ByteString
 *     ByteString(method),                           — String → ByteString
 *     Integer(callFlags),                           — Integer
 *     Array(6)[                                     — Array of args (forward order):
 *       ByteString(url),                              — String → ByteString
 *       ByteString(filter),                           — String → ByteString (empty = 28 00)
 *       ByteString(callbackHash, 20 bytes LE),        — Hash160 → ByteString(LE)
 *       ByteString(callbackMethod),                   — String → ByteString
 *       ByteString(empty),                            — ByteArray → ByteString (28 00)
 *       Integer(gasForResponse)                       — Integer
 *     ]
 *   ]
 *
 * IMPORTANT: Array items are in FORWARD order (not reversed).
 * IMPORTANT: Empty ByteArray is serialized as ByteString (0x28), not Buffer (0x30).
 *   This is because Neo's RPC layer converts ContractParamType.ByteArray to a
 *   byte[] which is implicitly cast to ByteString on the stack.
 */
describe("Oracle Call Comparison (neon-js serializeOracleCall)", function () {
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

  // Helper to get functions with explicit signatures (to avoid ambiguity)
  function getSerializeHash160(serializer: NeoSerializerTestHelper) {
    return serializer.getFunction("serializeHash160(bytes20)");
  }

  function getSerializeCall(serializer: NeoSerializerTestHelper) {
    return serializer.getFunction("serializeCall(bytes20,string,uint256,bytes[])");
  }

  describe("Exact match against real Neo node output", function () {
    /**
     * This test uses the EXACT output captured from a real Neo N3 node.
     *
     * Inputs:
     *   oracleExampleContractHash: "ed5811581ed3dfab186364b1f194a738650915e1"
     *   method: "requestOracleData"
     *   callFlags: 15 (CallFlags.All)
     *   args: [
     *     { type: 'String',    value: 'https://httpbin.org/json' },
     *     { type: 'String',    value: '' },   // empty filter
     *     { type: 'Hash160',   value: 'ed5811581ed3dfab186364b1f194a738650915e1' },
     *     { type: 'String',    value: 'onOracleResponse' },
     *     { type: 'ByteArray', value: '' },   // null userData
     *     { type: 'Integer',   value: '50000000' }
     *   ]
     *
     * Expected output (from real Neo node):
     *   0x40042814e115096538a794f1b1646318abdfd31e581158ed
     *     2811726571756573744f7261636c654461746121010f
     *     4006281868747470733a2f2f6874747062696e2e6f72672f6a736f6e
     *     28002814e115096538a794f1b1646318abdfd31e581158ed
     *     28106f6e4f7261636c65526573706f6e73652800210480f0fa02
     */
    it("Should produce byte-for-byte identical output to Neo node", async function () {
      const oracleHash = "ed5811581ed3dfab186364b1f194a738650915e1";
      const target = `0x${oracleHash}` as `0x${string}`;

      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeBytes = serializer.getFunction("serialize(bytes)");

      // Build args exactly matching the JS function's ContractParam types:
      const arg1 = await serializeString("https://httpbin.org/json");  // String → ByteString
      const arg2 = await serializeString("");                           // String → ByteString (empty)
      const serializeHash160 = getSerializeHash160(serializer);
      const arg3 = await serializeHash160(target);           // Hash160 → ByteString(LE)
      const arg4 = await serializeString("onOracleResponse");           // String → ByteString
      const arg5 = await serializeBytes("0x");                          // ByteArray(null) → ByteString(empty)
      const arg6 = await serializeUint(50000000n);                      // Integer

      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(
        target,
        "requestOracleData",
        15,  // CallFlags.All
        [arg1, arg2, arg3, arg4, arg5, arg6]
      );

      // The EXACT hex output from a real Neo N3 node:
      const neoNodeOutput =
        "40042814e115096538a794f1b1646318abdfd31e581158ed" +
        "2811726571756573744f7261636c654461746121010f" +
        "4006281868747470733a2f2f6874747062696e2e6f72672f6a736f6e" +
        "28002814e115096538a794f1b1646318abdfd31e581158ed" +
        "28106f6e4f7261636c65526573706f6e73652800210480f0fa02";

      expect(toHex(serialized)).to.equal(neoNodeOutput);
    });
  });

  describe("Individual arg serializations — exact bytes", function () {
    const oracleHash = "ed5811581ed3dfab186364b1f194a738650915e1";
    const oracleHashLE = "e115096538a794f1b1646318abdfd31e581158ed";

    it("Should serialize url as ByteString", async function () {
      const serializeString = serializer.getFunction("serialize(string)");
      const result = await serializeString("https://httpbin.org/json");
      expect(toHex(result)).to.equal(
        "281868747470733a2f2f6874747062696e2e6f72672f6a736f6e"
      );
    });

    it("Should serialize empty filter as ByteString(0)", async function () {
      const serializeString = serializer.getFunction("serialize(string)");
      const result = await serializeString("");
      expect(toHex(result)).to.equal("2800");
    });

    it("Should serialize callbackContract as Hash160 (little-endian)", async function () {
      const serializeHash160 = getSerializeHash160(serializer);
      const result = await serializeHash160(
        `0x${oracleHash}` as `0x${string}`
      );
      expect(toHex(result)).to.equal("2814" + oracleHashLE);
    });

    it("Should serialize callbackMethod as ByteString", async function () {
      const serializeString = serializer.getFunction("serialize(string)");
      const result = await serializeString("onOracleResponse");
      expect(toHex(result)).to.equal("28106f6e4f7261636c65526573706f6e7365");
    });

    it("Should serialize null userData as empty ByteString (0x28 0x00)", async function () {
      // In the real Neo output, empty ByteArray becomes ByteString(0x28), not Buffer(0x30).
      // This is because the RPC layer's implicit cast: (byte[])value → ByteString.
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const result = await serializeBytes("0x");
      expect(toHex(result)).to.equal("2800");
    });

    it("Should serialize gasForResponse = 50000000", async function () {
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const result = await serializeUint(50000000n);
      // 50000000 = 0x02FAF080 → LE: [0x80, 0xF0, 0xFA, 0x02]
      // MSB = 0x02 < 0x80 → no sign extension needed
      expect(toHex(result)).to.equal("210480f0fa02");
    });
  });

  describe("Full structure round-trip", function () {
    it("Should round-trip the full oracle call structure", async function () {
      const oracleHash = "ed5811581ed3dfab186364b1f194a738650915e1";
      const target = `0x${oracleHash}` as `0x${string}`;

      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeBytes = serializer.getFunction("serialize(bytes)");

      const serializeHash160 = getSerializeHash160(serializer);
      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(
        target,
        "requestOracleData",
        15,
        [
          await serializeString("https://httpbin.org/json"),
          await serializeString(""),
          await serializeHash160(target),
          await serializeString("onOracleResponse"),
          await serializeBytes("0x"),
          await serializeUint(50000000n),
        ]
      );

      // Deserialize outer array
      const [outerItems] = await serializer.deserializeArray(serialized, 0);
      expect(outerItems.length).to.equal(4);

      // [0] target
      const [targetBytes] = await serializer.deserializeBytes(outerItems[0], 0);
      expect(toHex(targetBytes)).to.equal(reverseHex(oracleHash));
      expect(ethers.getBytes(targetBytes).length).to.equal(20);

      // [1] method
      const [methodBytes] = await serializer.deserializeBytes(outerItems[1], 0);
      expect(ethers.toUtf8String(methodBytes)).to.equal("requestOracleData");

      // [2] callFlags
      const [flagsValue] = await serializer.deserializeUint256(outerItems[2], 0);
      expect(flagsValue).to.equal(15n);

      // [3] args array
      const [argsItems] = await serializer.deserializeArray(outerItems[3], 0);
      expect(argsItems.length).to.equal(6);

      // args[0] url
      const [urlBytes] = await serializer.deserializeBytes(argsItems[0], 0);
      expect(ethers.toUtf8String(urlBytes)).to.equal("https://httpbin.org/json");

      // args[1] filter (empty)
      const [filterBytes] = await serializer.deserializeBytes(argsItems[1], 0);
      expect(ethers.getBytes(filterBytes).length).to.equal(0);

      // args[2] callbackContract (Hash160 LE)
      const [cbBytes] = await serializer.deserializeBytes(argsItems[2], 0);
      expect(toHex(cbBytes)).to.equal(reverseHex(oracleHash));

      // args[3] callbackMethod
      const [cbMethodBytes] = await serializer.deserializeBytes(argsItems[3], 0);
      expect(ethers.toUtf8String(cbMethodBytes)).to.equal("onOracleResponse");

      // args[4] userData (empty)
      const [userDataBytes] = await serializer.deserializeBytes(argsItems[4], 0);
      expect(ethers.getBytes(userDataBytes).length).to.equal(0);

      // args[5] gasForResponse
      const [gasValue] = await serializer.deserializeUint256(argsItems[5], 0);
      expect(gasValue).to.equal(50000000n);
    });
  });

  describe("Variant: different userData types", function () {
    it("Should handle string userData as ByteString", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeBytes = serializer.getFunction("serialize(bytes)");

      const serializeHash160 = getSerializeHash160(serializer);
      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(
        target, "requestOracleData", 15,
        [
          await serializeString("https://httpbin.org/json"),
          await serializeString(""),
          await serializeHash160(target),
          await serializeString("onOracleResponse"),
          await serializeString("my-user-data"),   // String userData
          await serializeUint(50000000n),
        ]
      );

      const [outerItems] = await serializer.deserializeArray(serialized, 0);
      const [argsItems] = await serializer.deserializeArray(outerItems[3], 0);
      const [userDataBytes] = await serializer.deserializeBytes(argsItems[4], 0);
      expect(ethers.toUtf8String(userDataBytes)).to.equal("my-user-data");
    });

    it("Should handle integer userData", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");

      const serializeHash160 = getSerializeHash160(serializer);
      const serializeCall = getSerializeCall(serializer);
      const serialized = await serializeCall(
        target, "requestOracleData", 15,
        [
          await serializeString("https://httpbin.org/json"),
          await serializeString(""),
          await serializeHash160(target),
          await serializeString("onOracleResponse"),
          await serializeUint(42n),   // Integer userData
          await serializeUint(50000000n),
        ]
      );

      const [outerItems] = await serializer.deserializeArray(serialized, 0);
      const [argsItems] = await serializer.deserializeArray(outerItems[3], 0);
      const [userDataValue] = await serializer.deserializeUint256(argsItems[4], 0);
      expect(userDataValue).to.equal(42n);
    });
  });
});
