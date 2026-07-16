/**
 * Adds the TerraRTiOS pod to the watch target's Podfile block.
 *
 * @bacons/apple-targets generates the TerraGripWatch target at prebuild,
 * but the watch app imports TerraRTiOS (Terra's watchOS SDK), which is
 * distributed via CocoaPods — so the Podfile needs a target block the
 * plugin doesn't write itself.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BLOCK = `
target 'TerraGripWatch' do
  platform :watchos, '8.0'
  pod 'TerraRTiOS', '0.3.14'
end
`;

module.exports = function withWatchTerraPod(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes("target 'TerraGripWatch'")) {
        contents = contents.trimEnd() + '\n' + BLOCK;
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
