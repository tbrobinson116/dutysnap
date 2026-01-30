Pod::Spec.new do |s|
  s.name           = 'MetaGlasses'
  s.version        = '0.1.0'
  s.summary        = 'Expo module bridging Meta Wearables DAT SDK for Ray-Ban Meta glasses'
  s.description    = 'Native iOS bridge for Meta Wearables Device Access Toolkit, enabling Bluetooth discovery, connection, and photo capture from Ray-Ban Meta glasses.'
  s.homepage       = 'https://github.com/tbrobinson116/dutysnap'
  s.license        = { :type => 'MIT' }
  s.author         = 'Travis Robinson'
  s.source         = { git: 'https://github.com/tbrobinson116/dutysnap.git' }

  s.platform       = :ios, '15.1'
  s.swift_version  = '5.9'
  s.source_files   = '**/*.swift'

  # Vendor the Meta Wearables DAT xcframeworks so canImport(MWDATCore) resolves
  s.vendored_frameworks = 'MWDATCore.xcframework', 'MWDATCamera.xcframework', 'MWDATMockDevice.xcframework'

  s.dependency 'ExpoModulesCore'
end
