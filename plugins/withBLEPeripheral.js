const { withDangerousMod } = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");
const fs = require("fs");
const path = require("path");

async function addBLEFiles(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const sourceRoot = path.join(projectRoot, "ios");

      // Add Swift file
      const swiftContent = `
import Foundation
import CoreBluetooth

@objc(BLEPeripheralManager)
class BLEPeripheralManager: NSObject, CBPeripheralManagerDelegate {
    // ... (your Swift code here)
}
`;
      fs.writeFileSync(path.join(sourceRoot, "BLEPeripheralManager.swift"), swiftContent);

      // Add Bridging Header
      const bridgingHeaderContent = `#import <React/RCTBridgeModule.h>`;
      fs.writeFileSync(path.join(sourceRoot, "BLEPeripheralManager-Bridging-Header.h"), bridgingHeaderContent);

      // Add Objective-C file
      const objcContent = `
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BLEPeripheralManager, NSObject)
// ... (your Objective-C code here)
@end
`;
      fs.writeFileSync(path.join(sourceRoot, "BLEPeripheralManager.m"), objcContent);

      return config;
    },
  ]);
}

module.exports = addBLEFiles;
