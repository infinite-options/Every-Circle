import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";

class Crypto {
  getRandomValues(array) {
    return expoCryptoGetRandomValues(array);
  }
}

const webCrypto = typeof crypto !== "undefined" ? crypto : new Crypto();

(() => {
  if (typeof crypto === "undefined") {
    global.crypto = webCrypto;
  }
})();
