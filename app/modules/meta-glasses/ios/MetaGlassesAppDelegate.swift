import ExpoModulesCore

#if canImport(MWDATCore)
import MWDATCore
#endif

public class MetaGlassesAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    #if canImport(MWDATCore)
    Task { @MainActor in
      let result = try? await Wearables.shared.handleUrl(url)
      // Notify the module that registration completed so it can start scanning
      NotificationCenter.default.post(
        name: Notification.Name("MetaGlassesRegistrationComplete"),
        object: nil
      )
    }
    #endif
    return false
  }
}
