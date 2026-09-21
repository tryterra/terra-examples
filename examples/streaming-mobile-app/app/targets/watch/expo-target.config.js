/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'watch',
  name: 'TerraGripWatch',
  displayName: 'Terra Grip',
  deploymentTarget: '8.0',
  icon: '../../assets/icon.png',
  bundleIdentifier: 'com.example.streamingdemo.watchkitapp',
  entitlements: {
    'com.apple.developer.healthkit': true,
  },
  infoPlist: {
    NSHealthShareUsageDescription:
      'Reads live workout heart rate to stream it to the paired phone.',
    NSHealthUpdateUsageDescription:
      'Records the workout session used for full-frequency heart rate.',
    WKBackgroundModes: ['workout-processing'],
  },
};
