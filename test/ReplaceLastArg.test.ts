import { expect } from "chai";
import { ethers } from "hardhat";
import { NeoSerializerTestHelper } from "../typechain-types";

/**
 * Tests for replaceLastArg — serialize everything off-chain with a placeholder,
 * then on-chain only replace the last arg (e.g. nonce) with the real value.
 *
 * The API: replaceLastArg(serializedCall, oldArgSerializedLength, newSerializedArg)
 *   - oldArgSerializedLength = byte length of the placeholder arg that was serialized off-chain
 *   - No navigation needed: the last arg is always at the end of the byte array,
 *     so prefixLen = serializedCall.length - oldArgSerializedLength
 */
describe("replaceLastArg", function () {
  let serializer: NeoSerializerTestHelper;

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
  function getReplace() {
    return serializer.getFunction("replaceLastArg(bytes,uint256,bytes)");
  }
  function getAppend() {
    return serializer.getFunction("appendArgToCall(bytes,bytes)");
  }

  /** Get the byte length of a hex-encoded serialized value */
  function serializedLen(hexStr: string): number {
    return ethers.getBytes(hexStr).length;
  }

  before(async function () {
    const Factory = await ethers.getContractFactory("NeoSerializerTestHelper");
    serializer = (await Factory.deploy()) as unknown as NeoSerializerTestHelper;
    await serializer.waitForDeployment();
  });

  describe("Correctness", function () {
    it("Should replace nonce=0 with nonce=100 and match full serializeCall", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "requestOracleData";
      const callFlags = 15;

      const arg1 = await getSerializeString()("https://httpbin.org/json");
      const arg2 = await getSerializeString()("");
      const arg3 = await getSerializeHash160()(target);
      const arg4 = await getSerializeString()("onOracleResponse");
      const arg5 = await getSerializeBytes()("0x");
      const arg6 = await getSerializeUint()(50000000n);
      const noncePlaceholder = await getSerializeUint()(0n);

      // Off-chain: serialize with nonce=0
      const baseCall = await getSerializeCall()(target, method, callFlags,
        [arg1, arg2, arg3, arg4, arg5, arg6, noncePlaceholder]);

      // On-chain: replace nonce=0 (2 bytes) with nonce=100
      const realNonce = await getSerializeUint()(100n);
      const oldLen = serializedLen(noncePlaceholder);
      const result = await getReplace()(baseCall, oldLen, realNonce);

      // Expected: full serializeCall with nonce=100
      const expected = await getSerializeCall()(target, method, callFlags,
        [arg1, arg2, arg3, arg4, arg5, arg6, await getSerializeUint()(100n)]);

      expect(result).to.equal(expected);
    });

    it("Should work when replacing with a larger value", async function () {
      const target = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      // nonce=0 → serialize(0) = 0x21 0x00 (2 bytes)
      const placeholder = await getSerializeUint()(0n);
      const baseCall = await getSerializeCall()(target, method, callFlags, [placeholder]);

      // Replace with large value → serialize(999999999) = more bytes
      const bigNonce = await getSerializeUint()(999999999n);
      const result = await getReplace()(baseCall, serializedLen(placeholder), bigNonce);

      const expected = await getSerializeCall()(target, method, callFlags, [bigNonce]);
      expect(result).to.equal(expected);
    });

    it("Should work when replacing with a smaller value", async function () {
      const target = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      // Start with large nonce
      const largePlaceholder = await getSerializeUint()(999999999n);
      const baseCall = await getSerializeCall()(target, method, callFlags, [largePlaceholder]);

      // Replace with 0
      const smallNonce = await getSerializeUint()(0n);
      const result = await getReplace()(baseCall, serializedLen(largePlaceholder), smallNonce);

      const expected = await getSerializeCall()(target, method, callFlags, [smallNonce]);
      expect(result).to.equal(expected);
    });

    it("Should work when replacing with a different type", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      // Last arg is an integer placeholder
      const arg1 = await getSerializeString()("hello");
      const placeholder = await getSerializeUint()(0n);
      const baseCall = await getSerializeCall()(target, method, callFlags, [arg1, placeholder]);

      // Replace with a string
      const newArg = await getSerializeString()("world");
      const result = await getReplace()(baseCall, serializedLen(placeholder), newArg);

      const expected = await getSerializeCall()(target, method, callFlags, [arg1, newArg]);
      expect(result).to.equal(expected);
    });

    it("Should correctly deserialize after replace", async function () {
      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "test";
      const callFlags = 15;
      const realNonce = 12345n;

      const arg1 = await getSerializeUint()(100n);
      const placeholder = await getSerializeUint()(0n);
      const baseCall = await getSerializeCall()(target, method, callFlags, [arg1, placeholder]);

      const realNonceSerialized = await getSerializeUint()(realNonce);
      const result = await getReplace()(baseCall, serializedLen(placeholder), realNonceSerialized);

      // Deserialize and verify
      const [outerItems] = await serializer.deserializeArray(result, 0);
      expect(outerItems.length).to.equal(4);

      const [innerItems] = await serializer.deserializeArray(outerItems[3], 0);
      expect(innerItems.length).to.equal(2); // count stays the same!

      const [val1] = await serializer.deserializeUint256(innerItems[0], 0);
      expect(val1).to.equal(100n);

      const [val2] = await serializer.deserializeUint256(innerItems[1], 0);
      expect(val2).to.equal(realNonce);
    });

    it("Should work with a single arg (replace the only arg)", async function () {
      const target = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      const placeholder = await getSerializeUint()(0n);
      const baseCall = await getSerializeCall()(target, method, callFlags, [placeholder]);

      const newArg = await getSerializeUint()(42n);
      const result = await getReplace()(baseCall, serializedLen(placeholder), newArg);

      const expected = await getSerializeCall()(target, method, callFlags, [newArg]);
      expect(result).to.equal(expected);
    });

    it("Should work with many args (replace last of 10)", async function () {
      const target = "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`;
      const method = "test";
      const callFlags = 15;

      const args: string[] = [];
      for (let i = 0; i < 9; i++) {
        args.push(await getSerializeUint()(BigInt(i * 100)));
      }
      const placeholder = await getSerializeUint()(0n);
      args.push(placeholder);

      const baseCall = await getSerializeCall()(target, method, callFlags, args);

      const newArg = await getSerializeUint()(99999n);
      const result = await getReplace()(baseCall, serializedLen(placeholder), newArg);

      const expectedArgs = [...args.slice(0, -1), newArg];
      const expected = await getSerializeCall()(target, method, callFlags, expectedArgs);
      expect(result).to.equal(expected);
    });
  });

  describe("Gas Comparison: Full vs Append vs Replace", function () {
    it("Should show gas for oracle call nonce pattern (all methods)", async function () {
      console.log(`\n=== Gas: Full serializeCall vs appendArgToCall vs replaceLastArg ===\n`);

      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "requestOracleData";
      const callFlags = 15;

      const arg1 = await getSerializeString()("https://httpbin.org/json");
      const arg2 = await getSerializeString()("");
      const arg3 = await getSerializeHash160()(target);
      const arg4 = await getSerializeString()("onOracleResponse");
      const arg5 = await getSerializeBytes()("0x");
      const arg6 = await getSerializeUint()(50000000n);
      const baseArgsWithoutNonce = [arg1, arg2, arg3, arg4, arg5, arg6];

      // Placeholder and real values
      const noncePlaceholder = await getSerializeUint()(0n);
      const realNonce = await getSerializeUint()(42n);

      // Pre-serialize (off-chain)
      const baseCallWithPlaceholder = await getSerializeCall()(target, method, callFlags,
        [...baseArgsWithoutNonce, noncePlaceholder]);
      const baseCallWithoutNonce = await getSerializeCall()(target, method, callFlags,
        baseArgsWithoutNonce);

      // Full serializeCall (7 args, all on-chain)
      const fullGas = await getSerializeCall().estimateGas(target, method, callFlags,
        [...baseArgsWithoutNonce, realNonce]);

      // appendArgToCall (6 args off-chain, append nonce on-chain)
      const appendGas = await getAppend().estimateGas(baseCallWithoutNonce, realNonce);

      // replaceLastArg (7 args off-chain with placeholder, replace on-chain)
      const replaceGas = await getReplace().estimateGas(
        baseCallWithPlaceholder, serializedLen(noncePlaceholder), realNonce);

      // serialize(uint256) baseline
      const nonceOnlyGas = await getSerializeUint().estimateGas(42n);

      // Verify all produce correct output
      const fullResult = await getSerializeCall()(target, method, callFlags,
        [...baseArgsWithoutNonce, realNonce]);
      const appendResult = await getAppend()(baseCallWithoutNonce, realNonce);
      const replaceResult = await getReplace()(
        baseCallWithPlaceholder, serializedLen(noncePlaceholder), realNonce);
      expect(appendResult).to.equal(fullResult);
      expect(replaceResult).to.equal(fullResult);

      console.log(`Method                            |    Gas | vs Full`);
      console.log(`----------------------------------|--------|--------`);
      console.log(`Full serializeCall (7 args)        | ${String(fullGas).padStart(6)} |     —`);
      console.log(`appendArgToCall (auto-nav)         | ${String(appendGas).padStart(6)} | -${(Number(fullGas) - Number(appendGas))} (${((Number(fullGas) - Number(appendGas)) / Number(fullGas) * 100).toFixed(0)}%)`);
      console.log(`replaceLastArg                     | ${String(replaceGas).padStart(6)} | -${(Number(fullGas) - Number(replaceGas))} (${((Number(fullGas) - Number(replaceGas)) / Number(fullGas) * 100).toFixed(0)}%)`);
      console.log(`serialize(uint256) alone           | ${String(nonceOnlyGas).padStart(6)} | baseline`);
      console.log(`\nOverhead above serialize(uint256):`);
      console.log(`  appendArgToCall:  ${Number(appendGas) - Number(nonceOnlyGas)} gas`);
      console.log(`  replaceLastArg:   ${Number(replaceGas) - Number(nonceOnlyGas)} gas`);
    });

    it("Should show scaling with different numbers of base args", async function () {
      console.log(`\n=== replaceLastArg Gas by Number of Args ===\n`);
      console.log(`Total Args | Full Gas | Replace Gas | Savings`);
      console.log(`-----------|----------|-------------|--------`);

      const target = "0xed5811581ed3dfab186364b1f194a738650915e1" as `0x${string}`;
      const method = "test";
      const callFlags = 15;
      const realNonce = await getSerializeUint()(42n);
      const placeholder = await getSerializeUint()(0n);
      const placeholderLen = serializedLen(placeholder);

      for (const totalArgs of [1, 2, 4, 7, 10]) {
        // Build args with last one as placeholder
        const args: string[] = [];
        for (let i = 0; i < totalArgs - 1; i++) {
          args.push(await getSerializeUint()(BigInt(i * 100)));
        }
        args.push(placeholder);

        const baseCall = await getSerializeCall()(target, method, callFlags, args);

        // Full serializeCall with real nonce
        const fullArgs = [...args.slice(0, -1), realNonce];
        const fullGas = await getSerializeCall().estimateGas(target, method, callFlags, fullArgs);

        const replaceGas = await getReplace().estimateGas(baseCall, placeholderLen, realNonce);

        const saving = Number(fullGas) - Number(replaceGas);
        console.log(
          `${String(totalArgs).padStart(10)} | ` +
          `${String(fullGas).padStart(8)} | ` +
          `${String(replaceGas).padStart(11)} | ` +
          `${saving} (${(saving / Number(fullGas) * 100).toFixed(0)}%)`
        );
      }
    });
  });
});
