const {
  withInfoPlist,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const META_APP_ID = '1592507025116162';
const META_DAT_REPO = 'https://github.com/facebook/meta-wearables-dat-ios.git';
const META_DAT_VERSION = '0.3.0';

// Deterministic IDs for SPM objects
const PKG_REF_ID = 'METADAT0PKG0REF000000001';
const PROD_DEP_CORE_ID = 'METADAT0PRD0DEP000000001';
const PROD_DEP_CAMERA_ID = 'METADAT0PRD0DEP000000002';
const PROD_DEP_MOCK_ID = 'METADAT0PRD0DEP000000003';

/**
 * Expo config plugin for Meta Wearables DAT iOS SDK.
 *
 * - Adds required Info.plist entries (Bluetooth, external accessory, URL scheme)
 * - Injects the MetaWearablesDAT SPM package into the Xcode project
 *   with products: MWDATCore, MWDATCamera, MWDATMockDevice
 */
const withMetaGlasses = (config) => {
  config = withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    if (!plist.NSBluetoothAlwaysUsageDescription) {
      plist.NSBluetoothAlwaysUsageDescription =
        'DutySnap needs Bluetooth to connect to Meta Ray-Ban glasses.';
    }

    plist.UISupportedExternalAccessoryProtocols = [
      'com.meta.ar.wearable',
    ];

    const existingModes = plist.UIBackgroundModes || [];
    const requiredModes = ['bluetooth-peripheral', 'external-accessory'];
    for (const mode of requiredModes) {
      if (!existingModes.includes(mode)) {
        existingModes.push(mode);
      }
    }
    plist.UIBackgroundModes = existingModes;

    plist.MetaAppID = META_APP_ID;

    const existingSchemes = plist.CFBundleURLTypes || [];
    const hasScheme = existingSchemes.some(
      (entry) =>
        entry.CFBundleURLSchemes &&
        entry.CFBundleURLSchemes.includes('dutysnap')
    );
    if (!hasScheme) {
      existingSchemes.push({
        CFBundleURLSchemes: ['dutysnap'],
      });
    }
    plist.CFBundleURLTypes = existingSchemes;

    return cfg;
  });

  // Inject SPM package reference directly into project.pbxproj
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const projectDir = cfg.modRequest.platformProjectRoot;
      const pbxprojPath = path.join(
        projectDir,
        'DutySnap.xcodeproj',
        'project.pbxproj'
      );

      if (!fs.existsSync(pbxprojPath)) {
        console.warn('[MetaGlasses] project.pbxproj not found, skipping SPM injection');
        return cfg;
      }

      let pbxproj = fs.readFileSync(pbxprojPath, 'utf-8');

      // Skip if already injected
      if (pbxproj.includes('meta-wearables-dat-ios')) {
        console.log('[MetaGlasses] SPM package already present');
        return cfg;
      }

      console.log('[MetaGlasses] Injecting MetaWearablesDAT SPM package...');

      // 1. Add XCRemoteSwiftPackageReference section
      const remoteRef = `
/* Begin XCRemoteSwiftPackageReference section */
\t\t${PKG_REF_ID} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */ = {
\t\t\tisa = XCRemoteSwiftPackageReference;
\t\t\trepositoryURL = "${META_DAT_REPO}";
\t\t\trequirement = {
\t\t\t\tkind = upToNextMajorVersion;
\t\t\t\tminimumVersion = ${META_DAT_VERSION};
\t\t\t};
\t\t};
/* End XCRemoteSwiftPackageReference section */`;

      // 2. Add XCSwiftPackageProductDependency section (all three products)
      const productDep = `
/* Begin XCSwiftPackageProductDependency section */
\t\t${PROD_DEP_CORE_ID} /* MWDATCore */ = {
\t\t\tisa = XCSwiftPackageProductDependency;
\t\t\tpackage = ${PKG_REF_ID} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */;
\t\t\tproductName = MWDATCore;
\t\t};
\t\t${PROD_DEP_CAMERA_ID} /* MWDATCamera */ = {
\t\t\tisa = XCSwiftPackageProductDependency;
\t\t\tpackage = ${PKG_REF_ID} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */;
\t\t\tproductName = MWDATCamera;
\t\t};
\t\t${PROD_DEP_MOCK_ID} /* MWDATMockDevice */ = {
\t\t\tisa = XCSwiftPackageProductDependency;
\t\t\tpackage = ${PKG_REF_ID} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */;
\t\t\tproductName = MWDATMockDevice;
\t\t};
/* End XCSwiftPackageProductDependency section */`;

      // Insert the new sections before the rootObject line
      const rootObjectMatch = pbxproj.match(/\trootObject = [A-F0-9]+[^;]*;/);
      if (rootObjectMatch) {
        const insertPoint = pbxproj.lastIndexOf(rootObjectMatch[0]);
        pbxproj =
          pbxproj.slice(0, insertPoint) +
          remoteRef +
          '\n' +
          productDep +
          '\n' +
          pbxproj.slice(insertPoint);
      }

      // 3. Add packageReferences to PBXProject section
      if (pbxproj.includes('packageReferences')) {
        pbxproj = pbxproj.replace(
          /(packageReferences\s*=\s*\()/,
          `$1\n\t\t\t\t${PKG_REF_ID} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */,`
        );
      } else {
        pbxproj = pbxproj.replace(
          /(mainGroup\s*=)/,
          `packageReferences = (\n\t\t\t\t${PKG_REF_ID} /* XCRemoteSwiftPackageReference "meta-wearables-dat-ios" */,\n\t\t\t);\n\t\t\t$1`
        );
      }

      // 4. Add packageProductDependencies to PBXNativeTarget
      const allDepsComment = `${PROD_DEP_CORE_ID} /* MWDATCore */,\n\t\t\t\t${PROD_DEP_CAMERA_ID} /* MWDATCamera */,\n\t\t\t\t${PROD_DEP_MOCK_ID} /* MWDATMockDevice */,`;

      if (pbxproj.includes('packageProductDependencies')) {
        pbxproj = pbxproj.replace(
          /(packageProductDependencies\s*=\s*\()/,
          `$1\n\t\t\t\t${allDepsComment}`
        );
      } else {
        // Find PBXNativeTarget section and add before productReference
        const nativeTargetMatch = pbxproj.match(
          /\/\* Begin PBXNativeTarget section \*\/[\s\S]*?isa = PBXNativeTarget;[\s\S]*?productType = "com\.apple\.product-type\.application"/
        );
        if (nativeTargetMatch) {
          const targetStart = pbxproj.indexOf(nativeTargetMatch[0]);
          const afterTarget = pbxproj.indexOf('productReference', targetStart);
          if (afterTarget !== -1) {
            pbxproj =
              pbxproj.slice(0, afterTarget) +
              `packageProductDependencies = (\n\t\t\t\t${allDepsComment}\n\t\t\t);\n\t\t\t` +
              pbxproj.slice(afterTarget);
          }
        }
      }

      fs.writeFileSync(pbxprojPath, pbxproj, 'utf-8');
      console.log('[MetaGlasses] SPM package injected successfully');

      return cfg;
    },
  ]);

  return config;
};

module.exports = withMetaGlasses;
