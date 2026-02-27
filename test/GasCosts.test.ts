import { expect } from "chai";
import { ethers } from "hardhat";
import { NeoSerializerTestHelper } from "../typechain-types";

describe("Gas Cost Analysis", function () {
  let serializer: NeoSerializerTestHelper;

  before(async function () {
    const NeoSerializerFactory = await ethers.getContractFactory("NeoSerializerTestHelper");
    serializer = (await NeoSerializerFactory.deploy()) as unknown as NeoSerializerTestHelper;
    await serializer.waitForDeployment();
  });

  describe("Gas Costs for 100 Bytes", function () {
    it("Should measure gas for serializing 100 bytes", async function () {
      // Create 100 bytes of data
      const data100 = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        data100[i] = i % 256;
      }

      const serializeBytes = serializer.getFunction("serialize(bytes)");
      // Estimate gas for the call
      const gasEstimate = await serializeBytes.estimateGas(data100);
      
      console.log(`\nSerialize 100 bytes:`);
      console.log(`  Estimated gas: ${gasEstimate.toString()}`);
      console.log(`  At 20 gwei: ${(Number(gasEstimate) * 20 / 1e9).toFixed(6)} ETH`);
      console.log(`  At 50 gwei: ${(Number(gasEstimate) * 50 / 1e9).toFixed(6)} ETH`);
    });

    it("Should measure gas for deserializing 100 bytes", async function () {
      // First serialize 100 bytes
      const data100 = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        data100[i] = i % 256;
      }

      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const encoded = await serializeBytes(data100);

      // Estimate gas for deserialization
      const gasEstimate = await serializer.deserializeBytes.estimateGas(encoded, 0);
      
      console.log(`\nDeserialize 100 bytes:`);
      console.log(`  Estimated gas: ${gasEstimate.toString()}`);
      console.log(`  At 20 gwei: ${(Number(gasEstimate) * 20 / 1e9).toFixed(6)} ETH`);
      console.log(`  At 50 gwei: ${(Number(gasEstimate) * 50 / 1e9).toFixed(6)} ETH`);
    });

    it("Should measure gas for round-trip (serialize + deserialize)", async function () {
      const data100 = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        data100[i] = i % 256;
      }

      const serializeBytes = serializer.getFunction("serialize(bytes)");
      
      // Estimate gas for serialize
      const serializeGas = await serializeBytes.estimateGas(data100);
      const encoded = await serializeBytes(data100);

      // Estimate gas for deserialize
      const deserializeGas = await serializer.deserializeBytes.estimateGas(encoded, 0);

      const totalGas = serializeGas + deserializeGas;
      console.log(`\nRound-trip (serialize + deserialize) 100 bytes:`);
      console.log(`  Serialize gas: ${serializeGas.toString()}`);
      console.log(`  Deserialize gas: ${deserializeGas.toString()}`);
      console.log(`  Total gas: ${totalGas.toString()}`);
      console.log(`  At 20 gwei: ${(Number(totalGas) * 20 / 1e9).toFixed(6)} ETH`);
      console.log(`  At 50 gwei: ${(Number(totalGas) * 50 / 1e9).toFixed(6)} ETH`);
    });

    it("Should measure gas for different data sizes", async function () {
      const sizes = [10, 50, 100, 500, 1000];
      const serializeBytes = serializer.getFunction("serialize(bytes)");

      console.log(`\nGas costs for different data sizes:`);
      console.log(`Size (bytes) | Serialize Gas | Deserialize Gas | Total Gas`);
      console.log(`------------|---------------|-----------------|----------`);

      for (const size of sizes) {
        const data = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
          data[i] = i % 256;
        }

        // Estimate gas for serialize
        const serializeGas = await serializeBytes.estimateGas(data);
        const encoded = await serializeBytes(data);

        // Estimate gas for deserialize
        const deserializeGas = await serializer.deserializeBytes.estimateGas(encoded, 0);

        const totalGas = serializeGas + deserializeGas;
        console.log(`${size.toString().padStart(11)} | ${serializeGas.toString().padStart(13)} | ${deserializeGas.toString().padStart(15)} | ${totalGas.toString().padStart(9)}`);
      }
    });

    it("Should measure gas for serializing integers of different sizes", async function () {
      const testValues = [
        { name: "0", value: 0n },
        { name: "1", value: 1n },
        { name: "255", value: 255n },
        { name: "256", value: 256n },
        { name: "65535", value: 65535n },
        { name: "1000000", value: 1000000n },
        { name: "max uint64", value: BigInt("18446744073709551615") },
      ];

      const serializeUint = serializer.getFunction("serialize(uint256)");

      console.log(`\nGas costs for serializing integers:`);
      console.log(`Value | Gas Used`);
      console.log(`------|---------`);

      for (const test of testValues) {
        const gasEstimate = await serializeUint.estimateGas(test.value);
        console.log(`${test.name.padEnd(15)} | ${gasEstimate.toString()}`);
      }
    });

    it("Should measure gas for serializing arrays", async function () {
      const arraySizes = [1, 10, 50, 100];
      const serializeArray = serializer.getFunction("serialize(uint256[])");

      console.log(`\nGas costs for serializing arrays:`);
      console.log(`Array Size | Gas Used`);
      console.log(`----------|---------`);

      for (const size of arraySizes) {
        const array: bigint[] = [];
        for (let i = 0; i < size; i++) {
          array.push(BigInt(i));
        }

        const gasEstimate = await serializeArray.estimateGas(array);
        console.log(`${size.toString().padStart(9)} | ${gasEstimate.toString()}`);
      }
    });
  });

  describe("Extended Gas Cost Analysis", function () {
    it("Should measure gas for different data types", async function () {
      console.log(`\nGas costs by data type:`);
      console.log(`Type | Operation | Gas Used`);
      console.log(`-----|-----------|---------`);

      // Boolean
      const serializeBool = serializer.getFunction("serialize(bool)");
      const boolGas = await serializeBool.estimateGas(true);
      console.log(`bool | serialize(true) | ${boolGas.toString()}`);

      // String
      const serializeString = serializer.getFunction("serialize(string)");
      const shortStringGas = await serializeString.estimateGas("hello");
      const longStringGas = await serializeString.estimateGas("a".repeat(100));
      console.log(`string | serialize("hello") | ${shortStringGas.toString()}`);
      console.log(`string | serialize(100 chars) | ${longStringGas.toString()}`);

      // Hash160
      const serializeHash160 = serializer.getFunction("serializeHash160(bytes20)");
      const hash160Gas = await serializeHash160.estimateGas("0x" + "01".repeat(20));
      console.log(`Hash160 | serializeHash160 | ${hash160Gas.toString()}`);

      // Buffer
      const bufferData = new Uint8Array(50);
      for (let i = 0; i < 50; i++) bufferData[i] = i;
      const bufferGas = await serializer.serializeBuffer.estimateGas(bufferData);
      console.log(`Buffer | serializeBuffer(50) | ${bufferGas.toString()}`);

      // Empty bytes
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const emptyBytesGas = await serializeBytes.estimateGas("0x");
      console.log(`bytes | serialize(empty) | ${emptyBytesGas.toString()}`);
    });

    it("Should measure gas for array of different types", async function () {
      console.log(`\nGas costs for arrays of different element types:`);
      console.log(`Element Type | Array Size | Gas Used`);
      console.log(`-------------|------------|---------`);

      const serializeBytesArray = serializer.getFunction("serialize(bytes[])");
      const serializeString = serializer.getFunction("serialize(string)");

      // Array of bytes
      for (const size of [1, 5, 10]) {
        const bytesArray: string[] = [];
        for (let i = 0; i < size; i++) {
          bytesArray.push(ethers.hexlify(new Uint8Array([i, i + 1, i + 2])));
        }
        const gas = await serializeBytesArray.estimateGas(bytesArray);
        console.log(`bytes[] | ${size.toString().padStart(10)} | ${gas.toString()}`);
      }

      // Array of strings (serialize each string, then array of serialized bytes)
      for (const size of [1, 5, 10]) {
        const stringArray: string[] = [];
        for (let i = 0; i < size; i++) {
          const serialized = await serializeString(`item${i}`);
          stringArray.push(serialized);
        }
        const gas = await serializeBytesArray.estimateGas(stringArray);
        console.log(`string[] | ${size.toString().padStart(10)} | ${gas.toString()}`);
      }
    });

    it("Should measure gas for nested structures", async function () {
      console.log(`\nGas costs for nested structures:`);
      console.log(`Structure | Description | Gas Used`);
      console.log(`----------|-------------|---------`);

      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const serializeBytesArray = serializer.getFunction("serialize(bytes[])");

      // Array of arrays (nested)
      const nestedArray: string[] = [];
      for (let i = 0; i < 3; i++) {
        const innerArray = [BigInt(i), BigInt(i + 1), BigInt(i + 2)];
        const serialized = await serializeArray(innerArray);
        nestedArray.push(serialized);
      }
      const nestedGas = await serializeBytesArray.estimateGas(nestedArray);
      console.log(`Array[Array[uint256]] | 3 arrays of 3 items | ${nestedGas.toString()}`);

      // Array with mixed types (simulated as bytes[])
      const mixedArray: string[] = [];
      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeBool = serializer.getFunction("serialize(bool)");

      mixedArray.push(await serializeString("hello"));
      mixedArray.push(await serializeUint(42n));
      mixedArray.push(await serializeBool(true));
      const mixedGas = await serializeBytesArray.estimateGas(mixedArray);
      console.log(`Array[mixed] | string+uint+bool | ${mixedGas.toString()}`);
    });

    it("Should measure gas for deserializing different types", async function () {
      console.log(`\nGas costs for deserializing different types:`);
      console.log(`Type | Gas Used`);
      console.log(`-----|---------`);

      // Boolean
      const serializeBool = serializer.getFunction("serialize(bool)");
      const boolEncoded = await serializeBool(true);
      const boolDeserGas = await serializer.deserializeBool.estimateGas(boolEncoded, 0);
      console.log(`bool | ${boolDeserGas.toString()}`);

      // Integer
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const uintEncoded = await serializeUint(1000n);
      const uintDeserGas = await serializer.deserializeUint256.estimateGas(uintEncoded, 0);
      console.log(`uint256 | ${uintDeserGas.toString()}`);

      // Bytes
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const bytesEncoded = await serializeBytes(ethers.toUtf8Bytes("test"));
      const bytesDeserGas = await serializer.deserializeBytes.estimateGas(bytesEncoded, 0);
      console.log(`bytes | ${bytesDeserGas.toString()}`);

      // Array
      const serializeArray = serializer.getFunction("serialize(uint256[])");
      const arrayEncoded = await serializeArray([1n, 2n, 3n, 4n, 5n]);
      const arrayDeserGas = await serializer.deserializeArray.estimateGas(arrayEncoded, 0);
      console.log(`uint256[] | ${arrayDeserGas.toString()}`);
    });
  });

  describe("Oracle Call Gas Analysis", function () {
    it("Should measure gas for complete oracle call serialization", async function () {
      const oracleHash = "ed5811581ed3dfab186364b1f194a738650915e1";
      const target = `0x${oracleHash}` as `0x${string}`;

      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const serializeHash160 = serializer.getFunction("serializeHash160(bytes20)");
      const serializeCall = serializer.getFunction("serializeCall(bytes20,string,uint256,bytes[])");

      console.log(`\nOracle Call Gas Analysis:`);
      console.log(`Component | Gas Used`);
      console.log(`----------|---------`);

      // Individual arg serializations
      const arg1Gas = await serializeString.estimateGas("https://httpbin.org/json");
      const arg1 = await serializeString("https://httpbin.org/json");
      console.log(`arg1 (url string) | ${arg1Gas.toString()}`);

      const arg2Gas = await serializeString.estimateGas("");
      const arg2 = await serializeString("");
      console.log(`arg2 (empty filter) | ${arg2Gas.toString()}`);

      const arg3Gas = await serializeHash160.estimateGas(target);
      const arg3 = await serializeHash160(target);
      console.log(`arg3 (Hash160) | ${arg3Gas.toString()}`);

      const arg4Gas = await serializeString.estimateGas("onOracleResponse");
      const arg4 = await serializeString("onOracleResponse");
      console.log(`arg4 (callback method) | ${arg4Gas.toString()}`);

      const arg5Gas = await serializeBytes.estimateGas("0x");
      const arg5 = await serializeBytes("0x");
      console.log(`arg5 (empty userData) | ${arg5Gas.toString()}`);

      const arg6Gas = await serializeUint.estimateGas(50000000n);
      const arg6 = await serializeUint(50000000n);
      console.log(`arg6 (gasForResponse) | ${arg6Gas.toString()}`);

      // Serialize args array
      const argsArray = [arg1, arg2, arg3, arg4, arg5, arg6];
      const serializeBytesArray = serializer.getFunction("serialize(bytes[])");
      const argsArrayGas = await serializeBytesArray.estimateGas(argsArray);
      console.log(`args array (6 items) | ${argsArrayGas.toString()}`);

      // Full serializeCall
      const fullCallGas = await serializeCall.estimateGas(
        target,
        "requestOracleData",
        15, // CallFlags.All
        argsArray
      );
      console.log(`\nFull serializeCall | ${fullCallGas.toString()}`);
      console.log(`  At 20 gwei: ${(Number(fullCallGas) * 20 / 1e9).toFixed(6)} ETH`);
      console.log(`  At 50 gwei: ${(Number(fullCallGas) * 50 / 1e9).toFixed(6)} ETH`);

      // Breakdown
      const totalArgsGas = arg1Gas + arg2Gas + arg3Gas + arg4Gas + arg5Gas + arg6Gas;
      const overhead = fullCallGas - totalArgsGas;
      console.log(`\nBreakdown:`);
      console.log(`  Individual args total: ${totalArgsGas.toString()}`);
      console.log(`  serializeCall overhead: ${overhead.toString()}`);
      console.log(`  Overhead %: ${((Number(overhead) / Number(fullCallGas)) * 100).toFixed(2)}%`);
    });

    it("Should measure gas for oracle call round-trip", async function () {
      const oracleHash = "ed5811581ed3dfab186364b1f194a738650915e1";
      const target = `0x${oracleHash}` as `0x${string}`;

      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const serializeHash160 = serializer.getFunction("serializeHash160(bytes20)");
      const serializeCall = serializer.getFunction("serializeCall(bytes20,string,uint256,bytes[])");

      // Build args
      const arg1 = await serializeString("https://httpbin.org/json");
      const arg2 = await serializeString("");
      const arg3 = await serializeHash160(target);
      const arg4 = await serializeString("onOracleResponse");
      const arg5 = await serializeBytes("0x");
      const arg6 = await serializeUint(50000000n);

      const argsArray = [arg1, arg2, arg3, arg4, arg5, arg6];

      // Serialize
      const serializeGas = await serializeCall.estimateGas(
        target,
        "requestOracleData",
        15,
        argsArray
      );
      const serialized = await serializeCall(target, "requestOracleData", 15, argsArray);

      // Deserialize
      const deserializeGas = await serializer.deserializeArray.estimateGas(serialized, 0);

      const totalGas = serializeGas + deserializeGas;

      console.log(`\nOracle Call Round-Trip:`);
      console.log(`  Serialize: ${serializeGas.toString()}`);
      console.log(`  Deserialize: ${deserializeGas.toString()}`);
      console.log(`  Total: ${totalGas.toString()}`);
      console.log(`  At 20 gwei: ${(Number(totalGas) * 20 / 1e9).toFixed(6)} ETH`);
      console.log(`  At 50 gwei: ${(Number(totalGas) * 50 / 1e9).toFixed(6)} ETH`);
    });

    it("Should compare gas for serializeCall vs manual array construction", async function () {
      const oracleHash = "ed5811581ed3dfab186364b1f194a738650915e1";
      const target = `0x${oracleHash}` as `0x${string}`;

      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const serializeHash160 = serializer.getFunction("serializeHash160(bytes20)");
      const serializeCall = serializer.getFunction("serializeCall(bytes20,string,uint256,bytes[])");
      const serializeArray = serializer.getFunction("serialize(uint256[])");

      // Method 1: Using serializeCall
      const arg1 = await serializeString("https://httpbin.org/json");
      const arg2 = await serializeString("");
      const arg3 = await serializeHash160(target);
      const arg4 = await serializeString("onOracleResponse");
      const arg5 = await serializeBytes("0x");
      const arg6 = await serializeUint(50000000n);
      const argsArray = [arg1, arg2, arg3, arg4, arg5, arg6];

      const serializeCallGas = await serializeCall.estimateGas(
        target,
        "requestOracleData",
        15,
        argsArray
      );

      // Method 2: Manual construction (serialize each component, then array)
      const targetSerialized = await serializeHash160(target);
      const methodSerialized = await serializeString("requestOracleData");
      const flagsSerialized = await serializeUint(15n);
      const serializeBytesArray = serializer.getFunction("serialize(bytes[])");
      const argsSerialized = await serializeBytesArray(argsArray);
      
      const manualArray = [targetSerialized, methodSerialized, flagsSerialized, argsSerialized];
      const manualGas = await serializeBytesArray.estimateGas(manualArray);

      console.log(`\nSerializeCall vs Manual Construction:`);
      console.log(`  serializeCall: ${serializeCallGas.toString()}`);
      console.log(`  Manual array: ${manualGas.toString()}`);
      const diff = Number(serializeCallGas) - Number(manualGas);
      const diffPercent = ((diff / Number(serializeCallGas)) * 100).toFixed(2);
      console.log(`  Difference: ${diff > 0 ? '+' : ''}${diff.toString()} (${diffPercent}%)`);
    });

    it("Should measure gas for oracle call with different argument counts", async function () {
      const oracleHash = "ed5811581ed3dfab186364b1f194a738650915e1";
      const target = `0x${oracleHash}` as `0x${string}`;

      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeHash160 = serializer.getFunction("serializeHash160(bytes20)");
      const serializeCall = serializer.getFunction("serializeCall(bytes20,string,uint256,bytes[])");

      console.log(`\nOracle Call Gas by Argument Count:`);
      console.log(`Arg Count | Total Gas | Avg per Arg | Marginal Cost`);
      console.log(`----------|-----------|-------------|---------------`);

      const gasMeasurements: { count: number; gas: bigint }[] = [];
      let prevGas: bigint | null = null;
      let prevCount = 0;

      for (const argCount of [0, 1, 3, 6, 10]) {
        const argsArray: string[] = [];
        for (let i = 0; i < argCount; i++) {
          if (i % 3 === 0) {
            argsArray.push(await serializeString(`arg${i}`));
          } else if (i % 3 === 1) {
            argsArray.push(await serializeUint(BigInt(i * 1000)));
          } else {
            argsArray.push(await serializeHash160(target));
          }
        }

        const gas = await serializeCall.estimateGas(
          target,
          "testMethod",
          15,
          argsArray
        );

        gasMeasurements.push({ count: argCount, gas });

        // Calculate marginal cost (difference from previous count, divided by args added)
        let marginalCost = "N/A";
        if (prevGas !== null) {
          const marginal = Number(gas) - Number(prevGas);
          const argsAdded = argCount - prevCount;
          marginalCost = (marginal / argsAdded).toFixed(0); // per-arg marginal cost
        }

        const avgPerArg = argCount > 0 ? (Number(gas) / argCount).toFixed(0) : "N/A";
        console.log(
          `${argCount.toString().padStart(9)} | ${gas.toString().padStart(10)} | ${avgPerArg.padStart(12)} | ${marginalCost.padStart(14)}`
        );

        prevGas = gas;
        prevCount = argCount;
      }

      // Analysis
      const baseCost = Number(gasMeasurements.find(m => m.count === 0)?.gas || 0n);
      console.log(`\nAnalysis:`);
      console.log(`  Fixed base cost (0 args): ${baseCost.toString()} gas`);
      
      // Calculate average marginal cost per argument
      let totalMarginal = 0;
      let marginalCount = 0;
      for (let i = 1; i < gasMeasurements.length; i++) {
        const prev = gasMeasurements[i - 1];
        const curr = gasMeasurements[i];
        const marginal = Number(curr.gas) - Number(prev.gas);
        const argsAdded = curr.count - prev.count;
        totalMarginal += marginal / argsAdded; // per-arg marginal cost
        marginalCount++;
      }
      const avgMarginalPerArg = marginalCount > 0 ? (totalMarginal / marginalCount).toFixed(0) : "N/A";
      console.log(`  Average marginal cost per additional arg: ~${avgMarginalPerArg} gas`);
      console.log(`\nNote: "Avg per Arg" decreases because fixed costs are amortized.`);
      console.log(`      "Marginal Cost" shows the actual cost of adding each argument.`);
    });
  });

  describe("Gas Efficiency Comparison", function () {
    it("Should compare gas efficiency across operation types", async function () {
      console.log(`\nGas Efficiency Comparison (normalized to 100 bytes equivalent):`);
      console.log(`Operation | Gas | Gas per Byte`);
      console.log(`----------|-----|--------------`);

      const serializeBytes = serializer.getFunction("serialize(bytes)");
      const serializeString = serializer.getFunction("serialize(string)");
      const serializeUint = serializer.getFunction("serialize(uint256)");
      const serializeArray = serializer.getFunction("serialize(uint256[])");

      // 100 bytes
      const data100 = new Uint8Array(100);
      for (let i = 0; i < 100; i++) data100[i] = i;
      const bytes100Gas = await serializeBytes.estimateGas(data100);
      console.log(`bytes(100) | ${bytes100Gas.toString()} | ${(Number(bytes100Gas) / 100).toFixed(0)}`);

      // 100 char string
      const string100 = "a".repeat(100);
      const string100Gas = await serializeString.estimateGas(string100);
      console.log(`string(100) | ${string100Gas.toString()} | ${(Number(string100Gas) / 100).toFixed(0)}`);

      // Integer (variable size)
      const uintGas = await serializeUint.estimateGas(1000000n);
      const uintBytes = 4; // approximate
      console.log(`uint256 | ${uintGas.toString()} | ${(Number(uintGas) / uintBytes).toFixed(0)}`);

      // Array of 100 small integers
      const array100: bigint[] = [];
      for (let i = 0; i < 100; i++) array100.push(BigInt(i));
      const array100Gas = await serializeArray.estimateGas(array100);
      console.log(`uint256[](100) | ${array100Gas.toString()} | ${(Number(array100Gas) / 100).toFixed(0)}`);
    });
  });
});
