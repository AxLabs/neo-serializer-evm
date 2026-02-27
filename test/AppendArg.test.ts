import { expect } from "chai";
import { ethers } from "hardhat";
import { NeoSerializerTestHelper } from "../typechain-types";

/**
 * Tests for appendArgToCall — the gas-efficient pattern where the call
 * is serialized off-chain and only an additional argument is appended on-chain.
 *
 * Two versions:
 *   1. appendArgToCall(bytes, bytes) — auto-navigating, finds the inner array count
 *   2. appendArgToCall(bytes, uint256, bytes) — fast path, caller provides the offset
 */
describe("appendArgToCall", function () {
  let serializer: NeoSerializerTestHelper;

  // Helper to call overloaded functions by explicit signature
  function getSerializeCall() {
    return serializer.getFunction("serializeCall(bytes20,string,uint256,bytes[])");
  }
  function getSerializeUint() {
    return serializer.getFunction("serialize(uint256)");
  }
  function getSerializeString() {
    return serializer.getFunction("serialize(string)");
  }
  function getSerializeBytes() {
    return serializer.getFunction("serialize(bytes)");
  }
  function getSerializeHash160() {
    return serializer.getFunction("serializeHash160(bytes20)");
  }
  function getAppendAutoNav() {
    return serializer.getFunction("appendArgToCall(bytes,bytes)");
  }
  function getAppendFast() {
    return serializer.getFunction("appendArgToCall(bytes,uint256,bytes)");
  }

  /**
   * Finds the inner array count byte offset by scanning the serialized call bytes.
   * This simulates what the off-chain code would do to compute the offset.
   */
  function findInnerArrayCountOffset(serializedHex: string): number {
    const bytes = ethers.getBytes(serializedHex);
    // byte[0] = 0x40 (outer Array), byte[1] = count (4)
    let offset = 2;
    // Skip 3 items (target, method, flags) — each is: type + varint(len) + len bytes
    for (let i = 0; i < 3; i++) {
      offset++; // skip type byte
      const lenByte = bytes[offset];
      if (lenByte < 0xFD) {
        offset = offset + 1 + lenByte;
      } else {
        // 3-byte varint
        const lo = bytes[offset + 1];
        const hi = bytes[offset + 2];
        offset = offset + 3 + (lo + hi * 256);
      }
    }
    // Now at inner Array type byte (0x40), count is at offset+1
    return offset + 1;
  }

  before(async function () {
    const Factory = await ethers.getContractFactory("NeoSerializerTestHelper");
    serializer = (await Factory.deploy()) as unknown as NeoSerializerTestHelper;
    await serializer.waitForDeployment();
  });

  describe("Correctness (auto-navigating)", function () {
    it("Should produce identical output to a full serializeCall with the extra arg", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "requestOracleData";
      const callFlags = 15;
      const nonce = 42n;

      const arg1 = await getSerializeString()("https://httpbin.org/json");
      const arg2 = await getSerializeString()("");
      const arg3 = await getSerializeHash160()(target);
      const arg4 = await getSerializeString()("onOracleResponse");
      const arg5 = await getSerializeBytes()("0x");
      const arg6 = await getSerializeUint()(50000000n);

      // Method 1: Full serialization with 7 args
      const allArgs = [arg1, arg2, arg3, arg4, arg5, arg6, await getSerializeUint()(nonce)];
      const fullResult = await getSerializeCall()(target, method, callFlags, allArgs);

      // Method 2: Serialize 6 args off-chain, append 7th on-chain
      const baseCall = await getSerializeCall()(target, method, callFlags, [arg1, arg2, arg3, arg4, arg5, arg6]);
      const serializedNonce = await getSerializeUint()(nonce);
      const appendResult = await getAppendAutoNav()(baseCall, serializedNonce);

      expect(appendResult).to.equal(fullResult);
    });

    it("Should work with a simple call (0 args → 1 arg)", async function () {
      const target = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      const arg = await getSerializeUint()(100n);
      const fullResult = await getSerializeCall()(target, method, callFlags, [arg]);

      const baseCall = await getSerializeCall()(target, method, callFlags, []);
      const appendResult = await getAppendAutoNav()(baseCall, arg);

      expect(appendResult).to.equal(fullResult);
    });

    it("Should work with multiple appends", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "multiAppend";
      const callFlags = 15;

      const arg1 = await getSerializeString()("hello");
      const arg2 = await getSerializeUint()(42n);
      const arg3 = await getSerializeString()("world");

      const fullResult = await getSerializeCall()(target, method, callFlags, [arg1, arg2, arg3]);

      let result = await getSerializeCall()(target, method, callFlags, []);
      result = await getAppendAutoNav()(result, arg1);
      result = await getAppendAutoNav()(result, arg2);
      result = await getAppendAutoNav()(result, arg3);

      expect(result).to.equal(fullResult);
    });

    it("Should work appending different types", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "mixedTypes";
      const callFlags = 15;

      const strArg = await getSerializeString()("base");
      const baseCall = await getSerializeCall()(target, method, callFlags, [strArg]);

      const intArg = await getSerializeUint()(999n);
      const afterInt = await getAppendAutoNav()(baseCall, intArg);

      const hashArg = await getSerializeHash160()("0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`);
      const afterHash = await getAppendAutoNav()(afterInt, hashArg);

      const bytesArg = await getSerializeBytes()("0xdeadbeef");
      const afterBytes = await getAppendAutoNav()(afterHash, bytesArg);

      const fullResult = await getSerializeCall()(target, method, callFlags, [strArg, intArg, hashArg, bytesArg]);
      expect(afterBytes).to.equal(fullResult);
    });

    it("Should correctly deserialize after append", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "test";
      const callFlags = 15;
      const nonce = 12345n;

      const arg1 = await getSerializeUint()(100n);
      const baseCall = await getSerializeCall()(target, method, callFlags, [arg1]);
      const serializedNonce = await getSerializeUint()(nonce);
      const result = await getAppendAutoNav()(baseCall, serializedNonce);

      const [outerItems] = await serializer.deserializeArray(result, 0);
      expect(outerItems.length).to.equal(4);

      const [innerItems] = await serializer.deserializeArray(outerItems[3], 0);
      expect(innerItems.length).to.equal(2);

      const [deserializedNonce] = await serializer.deserializeUint256(innerItems[1], 0);
      expect(deserializedNonce).to.equal(nonce);
    });
  });

  describe("Correctness (fast path with pre-computed offset)", function () {
    it("Should produce identical output to auto-navigating version", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "requestOracleData";
      const callFlags = 15;

      const arg1 = await getSerializeString()("https://httpbin.org/json");
      const arg2 = await getSerializeString()("");
      const arg3 = await getSerializeHash160()(target);
      const arg4 = await getSerializeString()("onOracleResponse");
      const arg5 = await getSerializeBytes()("0x");
      const arg6 = await getSerializeUint()(50000000n);

      const baseCall = await getSerializeCall()(target, method, callFlags, [arg1, arg2, arg3, arg4, arg5, arg6]);
      const serializedNonce = await getSerializeUint()(42n);

      // Find offset off-chain
      const offset = findInnerArrayCountOffset(baseCall);

      // Auto-nav result
      const autoResult = await getAppendAutoNav()(baseCall, serializedNonce);
      // Fast path result
      const fastResult = await getAppendFast()(baseCall, offset, serializedNonce);

      expect(fastResult).to.equal(autoResult);
    });

    it("Should produce identical output to full serializeCall", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      const arg1 = await getSerializeUint()(100n);
      const arg2 = await getSerializeString()("hello");
      const nonce = await getSerializeUint()(999n);

      const fullResult = await getSerializeCall()(target, method, callFlags, [arg1, arg2, nonce]);

      const baseCall = await getSerializeCall()(target, method, callFlags, [arg1, arg2]);
      const offset = findInnerArrayCountOffset(baseCall);
      const fastResult = await getAppendFast()(baseCall, offset, nonce);

      expect(fastResult).to.equal(fullResult);
    });

    it("Should work with multiple fast appends (offset changes each time)", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      const arg1 = await getSerializeString()("hello");
      const arg2 = await getSerializeUint()(42n);
      const arg3 = await getSerializeString()("world");

      const fullResult = await getSerializeCall()(target, method, callFlags, [arg1, arg2, arg3]);

      // Start with 0 args, append 3 times with fast path
      // Note: offset is the SAME for each append (it's position of the count byte,
      // which doesn't move because we only append at the end)
      let result = await getSerializeCall()(target, method, callFlags, []);
      const offset = findInnerArrayCountOffset(result);

      result = await getAppendFast()(result, offset, arg1);
      result = await getAppendFast()(result, offset, arg2);
      result = await getAppendFast()(result, offset, arg3);

      expect(result).to.equal(fullResult);
    });
  });

  describe("Error handling", function () {
    it("Should revert on non-serialized-call input (auto-nav)", async function () {
      const randomBytes = "0xdeadbeef";
      const arg = await getSerializeUint()(1n);

      await expect(getAppendAutoNav()(randomBytes, arg)).to.be.reverted;
    });

    it("Should revert on malformed call structure (auto-nav)", async function () {
      const badCall = await serializer.getFunction("serialize(uint256[])")([1n, 2n, 3n]);
      const arg = await getSerializeUint()(1n);

      await expect(getAppendAutoNav()(badCall, arg)).to.be.reverted;
    });
  });

  describe("Gas Comparison: Full vs Auto-nav vs Fast Path", function () {
    it("Should show gas savings for the oracle call pattern (all 3 methods)", async function () {
      console.log(`\n=== Gas: Full serializeCall vs appendArgToCall (auto-nav vs fast) ===\n`);

      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "requestOracleData";
      const callFlags = 15;

      const arg1 = await getSerializeString()("https://httpbin.org/json");
      const arg2 = await getSerializeString()("");
      const arg3 = await getSerializeHash160()(target);
      const arg4 = await getSerializeString()("onOracleResponse");
      const arg5 = await getSerializeBytes()("0x");
      const arg6 = await getSerializeUint()(50000000n);
      const baseArgs = [arg1, arg2, arg3, arg4, arg5, arg6];

      const baseCall = await getSerializeCall()(target, method, callFlags, baseArgs);
      const serializedNonce = await getSerializeUint()(42n);

      // Find offset off-chain
      const offset = findInnerArrayCountOffset(baseCall);

      // Measure: full serializeCall
      const allArgs = [...baseArgs, serializedNonce];
      const fullGas = await getSerializeCall().estimateGas(target, method, callFlags, allArgs);

      // Measure: auto-navigating append
      const autoGas = await getAppendAutoNav().estimateGas(baseCall, serializedNonce);

      // Measure: fast path append
      const fastGas = await getAppendFast().estimateGas(baseCall, offset, serializedNonce);

      // Measure: just serialize the nonce
      const nonceOnlyGas = await getSerializeUint().estimateGas(42n);

      // Verify all produce identical output
      const fullResult = await getSerializeCall()(target, method, callFlags, allArgs);
      const autoResult = await getAppendAutoNav()(baseCall, serializedNonce);
      const fastResult = await getAppendFast()(baseCall, offset, serializedNonce);
      expect(autoResult).to.equal(fullResult);
      expect(fastResult).to.equal(fullResult);

      const autoSavings = Number(fullGas) - Number(autoGas);
      const fastSavings = Number(fullGas) - Number(fastGas);

      console.log(`Full serializeCall (7 args):      ${String(fullGas).padStart(6)} gas`);
      console.log(`appendArgToCall (auto-navigate):  ${String(autoGas).padStart(6)} gas  → saved ${autoSavings} (${(autoSavings / Number(fullGas) * 100).toFixed(1)}%)`);
      console.log(`appendArgToCall (fast, w/ offset): ${String(fastGas).padStart(6)} gas  → saved ${fastSavings} (${(fastSavings / Number(fullGas) * 100).toFixed(1)}%)`);
      console.log(`serialize(uint256) alone:          ${String(nonceOnlyGas).padStart(6)} gas  (baseline)`);
      console.log(`───────────────────────────────────────────────`);
      console.log(`Auto-nav overhead vs nonce-only:   ${Number(autoGas) - Number(nonceOnlyGas)} gas`);
      console.log(`Fast path overhead vs nonce-only:  ${Number(fastGas) - Number(nonceOnlyGas)} gas`);
      console.log(`Fast path saves vs auto-nav:       ${Number(autoGas) - Number(fastGas)} gas`);
    });

    it("Should show gas scaling with different base call sizes", async function () {
      console.log(`\n=== Gas Scaling: appendArgToCall by Base Call Size ===\n`);
      console.log(`Base Args | Full Gas | Auto-nav |   Fast  | Auto Saving | Fast Saving`);
      console.log(`----------|----------|----------|---------|-------------|------------`);

      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "test";
      const callFlags = 15;
      const nonceArg = await getSerializeUint()(42n);

      for (const baseArgCount of [0, 1, 3, 6, 10]) {
        const baseArgs: string[] = [];
        for (let i = 0; i < baseArgCount; i++) {
          baseArgs.push(await getSerializeUint()(BigInt(i * 100)));
        }

        const baseCall = await getSerializeCall()(target, method, callFlags, baseArgs);
        const offset = findInnerArrayCountOffset(baseCall);

        const allArgs = [...baseArgs, nonceArg];
        const fullGas = await getSerializeCall().estimateGas(target, method, callFlags, allArgs);
        const autoGas = await getAppendAutoNav().estimateGas(baseCall, nonceArg);
        const fastGas = await getAppendFast().estimateGas(baseCall, offset, nonceArg);

        const autoSave = Number(fullGas) - Number(autoGas);
        const fastSave = Number(fullGas) - Number(fastGas);

        console.log(
          `${String(baseArgCount).padStart(9)} | ` +
          `${String(fullGas).padStart(8)} | ` +
          `${String(autoGas).padStart(8)} | ` +
          `${String(fastGas).padStart(7)} | ` +
          `${String(autoSave).padStart(5)} (${(autoSave / Number(fullGas) * 100).toFixed(0)}%)`.padStart(11) + ` | ` +
          `${String(fastSave).padStart(5)} (${(fastSave / Number(fullGas) * 100).toFixed(0)}%)`
        );
      }
    });

    it("Should show gas for appending different value types", async function () {
      console.log(`\n=== appendArgToCall Gas by Appended Type ===\n`);

      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      const baseArgs = [
        await getSerializeString()("hello"),
        await getSerializeUint()(100n),
        await getSerializeString()("world"),
      ];
      const baseCall = await getSerializeCall()(target, method, callFlags, baseArgs);
      const offset = findInnerArrayCountOffset(baseCall);

      console.log(`Type              | Auto-nav | Fast   | Bytes`);
      console.log(`------------------|----------|--------|------`);

      const tests: Array<{ name: string; arg: string }> = [];

      const intArg = await getSerializeUint()(12345n);
      tests.push({ name: "Integer (12345)  ", arg: intArg });

      const strArg = await getSerializeString()("nonce_value");
      tests.push({ name: "String (11 chars) ", arg: strArg });

      const longStrArg = await getSerializeString()("a]".repeat(50));
      tests.push({ name: "String (100 chars)", arg: longStrArg });

      const hashArg = await getSerializeHash160()("0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`);
      tests.push({ name: "Hash160          ", arg: hashArg });

      const bytesArg = await getSerializeBytes()("0x" + "ab".repeat(32));
      tests.push({ name: "Bytes (32 bytes) ", arg: bytesArg });

      const boolArg = await serializer.getFunction("serialize(bool)")(true);
      tests.push({ name: "Boolean          ", arg: boolArg });

      for (const t of tests) {
        const autoGas = await getAppendAutoNav().estimateGas(baseCall, t.arg);
        const fastGas = await getAppendFast().estimateGas(baseCall, offset, t.arg);
        console.log(
          `${t.name} | ${String(autoGas).padStart(8)} | ${String(fastGas).padStart(6)} | ${ethers.getBytes(t.arg).length}`
        );
      }
    });
  });
});
