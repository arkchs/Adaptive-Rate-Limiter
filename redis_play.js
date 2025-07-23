import { client } from "./redis_playground.js";

async function setKeyValue(key, value) {
  try {
    await client.set(key, value);
    console.log(`Set ${key} = ${value}`);
  } catch (error) {
    console.error("Error setting key:", error);
  }
}

async function getValue(key) {
  try {
    const value = await client.get(key);
    console.log(`Got ${key} = ${value}`);
    return value;
  } catch (error) {
    console.error("Error getting key:", error);
  }
}

async function setKeyTTL(key, ttl) {
  try {
    const value = await client.expire(key, ttl);
    console.log(`Got ${key} = ${value}`);
  } catch (error) {
    console.error("Error getting key:", error);
  }
}

// getValue("user:1");
// setKeyValue("user:4", "John Doe");
// getValue("user:3");
// getValue("user:4");


// setKeyValue("user:4", "John Doe");
// setKeyTTL("user:4", 10);
// for (let index = 0; index < 10; index++) {
//     setTimeout(async () => {
//         const value = await getValue("user:4"); // Get value after the delay
//         console.log(`Time: ${index + 1}s, Value for user:4:`, value);
//         if (value === null) {
//             console.log("Key 'user:4' has expired or was deleted.");
//             clearInterval(interval); // Stop if the key is gone
//         }
//     }, index * 1000)
// }



await client.lpush("new_list", 1)
