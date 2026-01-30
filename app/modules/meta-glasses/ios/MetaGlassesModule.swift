import ExpoModulesCore

#if canImport(MWDATCore)
import MWDATCore
import MWDATCamera
private let sdkAvailable = true
#else
private let sdkAvailable = false
#endif

public class MetaGlassesModule: Module {
  private var connectionState: String = "disconnected"
  private var registrationObserver: Any?

  #if canImport(MWDATCore)
  @MainActor private var deviceSelector: AutoDeviceSelector?
  @MainActor private var streamSession: StreamSession?
  @MainActor private var listenerTokens: [any AnyListenerToken] = []
  @MainActor private var pendingScan: Bool = false
  #endif

  public func definition() -> ModuleDefinition {
    Name("MetaGlasses")

    Events(
      "onConnectionStateChanged",
      "onPhotoCaptured",
      "onError",
      "onDebug"
    )

    OnCreate {
      #if canImport(MWDATCore)
      Task { @MainActor in
        do {
          try Wearables.configure()
        } catch {
          self.sendEvent("onError", [
            "message": "Failed to configure Wearables SDK: \(error.localizedDescription)"
          ])
        }
      }

      // Listen for registration completion from AppDelegate URL callback
      self.registrationObserver = NotificationCenter.default.addObserver(
        forName: Notification.Name("MetaGlassesRegistrationComplete"),
        object: nil,
        queue: .main
      ) { [weak self] _ in
        guard let self = self else { return }
        Task { @MainActor in
          if self.pendingScan {
            self.pendingScan = false
            // Tear down any stale session before starting fresh
            if self.streamSession != nil {
              if let session = self.streamSession {
                await session.stop()
              }
              self.streamSession = nil
              self.deviceSelector = nil
              for token in self.listenerTokens {
                await token.cancel()
              }
              self.listenerTokens.removeAll()
            }
            self.beginScanning()
          }
        }
      }
      #endif
    }

    OnDestroy {
      self.tearDown()
      if let observer = self.registrationObserver {
        NotificationCenter.default.removeObserver(observer)
        self.registrationObserver = nil
      }
    }

    Function("startRegistration") {
      #if canImport(MWDATCore)
      Task { @MainActor in
        self.pendingScan = true
        do {
          try Wearables.shared.startRegistration()
          // If startRegistration returns without opening Meta AI,
          // the user is already registered. Start scanning directly.
          // (If Meta AI did open, the notification handler will scan instead.)
          // Use a short delay to let Meta AI open if it's going to.
          try? await Task.sleep(nanoseconds: 2_000_000_000)
          if self.pendingScan {
            self.pendingScan = false
            self.beginScanning()
          }
        } catch {
          // Registration failed — user may already be registered.
          // Try scanning anyway.
          self.pendingScan = false
          self.beginScanning()
        }
      }
      #else
      self.sendEvent("onError", [
        "message": "Meta SDK not available. Build with expo-dev-client."
      ])
      #endif
    }

    Function("startScanning") {
      #if canImport(MWDATCore)
      Task { @MainActor in
        self.beginScanning()
      }
      #else
      self.sendEvent("onError", [
        "message": "Meta SDK not available. Build with expo-dev-client."
      ])
      #endif
    }

    Function("stopScanning") {
      self.tearDown()
      self.updateConnectionState("disconnected")
    }

    AsyncFunction("capturePhoto") { (promise: Promise) in
      #if canImport(MWDATCore)
      Task { @MainActor in
        self.takePhoto(promise: promise)
      }
      #else
      promise.reject(
        NSError(
          domain: "MetaGlasses",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "Meta SDK not available. Build with expo-dev-client."]
        )
      )
      #endif
    }

    Function("disconnect") {
      self.tearDown()
      self.updateConnectionState("disconnected")
    }

    Function("getConnectionState") { () -> String in
      return self.connectionState
    }

    Function("isSDKAvailable") { () -> Bool in
      return sdkAvailable
    }
  }

  // MARK: - Scanning & Connection

  #if canImport(MWDATCore)
  @MainActor
  private func beginScanning() {
    updateConnectionState("scanning")

    let regState = Wearables.shared.registrationState
    let devices = Wearables.shared.devices
    self.sendEvent("onDebug", ["message": "[MetaGlasses] beginScanning — registration: \(regState), devices: \(devices.count)"])

    // If not registered, we can't do anything
    if regState != .registered {
      self.sendEvent("onDebug", ["message": "[MetaGlasses] Not registered yet (state: \(regState)), waiting..."])
      self.sendEvent("onError", [
        "message": "Not registered with Meta AI. Registration state: \(regState)"
      ])
      self.updateConnectionState("disconnected")
      return
    }

    // Request camera permission before starting the stream
    Task { @MainActor in
      do {
        let cameraStatus = try await Wearables.shared.checkPermissionStatus(.camera)
        self.sendEvent("onDebug", ["message": "[MetaGlasses] Camera permission status: \(cameraStatus)"])
        if cameraStatus != .granted {
          let result = try await Wearables.shared.requestPermission(.camera)
          self.sendEvent("onDebug", ["message": "[MetaGlasses] Camera permission request result: \(result)"])
          if result != .granted {
            self.sendEvent("onError", [
              "message": "Camera permission was denied on the glasses."
            ])
            self.updateConnectionState("disconnected")
            return
          }
        }
      } catch {
        self.sendEvent("onDebug", ["message": "[MetaGlasses] Permission error: \(error)"])
        // Permission check/request failed — try starting anyway
        self.sendEvent("onError", [
          "message": "Permission check failed: \(error). Attempting to stream anyway."
        ])
      }

      self.sendEvent("onDebug", ["message": "[MetaGlasses] Starting stream session..."])
      self.startStreamSession()
    }
  }

  @MainActor
  private func startStreamSession() {
    let devices = Wearables.shared.devices
    self.sendEvent("onDebug", ["message": "[MetaGlasses] startStreamSession — devices available: \(devices)"])

    let selector = AutoDeviceSelector(wearables: Wearables.shared)
    self.deviceSelector = selector

    let config = StreamSessionConfig()
    let session = StreamSession(streamSessionConfig: config, deviceSelector: selector)
    self.streamSession = session

    let stateToken = session.statePublisher.listen { [weak self] state in
      guard let self = self else { return }
      self.sendEvent("onDebug", ["message": "[MetaGlasses] Session state: \(state)"])
      switch state {
      case .streaming:
        self.updateConnectionState("connected")
      case .stopped:
        self.updateConnectionState("disconnected")
      case .starting, .waitingForDevice:
        self.updateConnectionState("connecting")
      case .stopping:
        self.updateConnectionState("disconnected")
      case .paused:
        self.updateConnectionState("connected")
      @unknown default:
        break
      }
    }
    self.listenerTokens.append(stateToken)

    let photoToken = session.photoDataPublisher.listen { [weak self] photoData in
      guard let self = self else { return }
      let base64 = photoData.data.base64EncodedString()
      self.sendEvent("onPhotoCaptured", ["base64": base64])
    }
    self.listenerTokens.append(photoToken)

    let errorToken = session.errorPublisher.listen { [weak self] error in
      guard let self = self else { return }
      self.sendEvent("onDebug", ["message": "[MetaGlasses] Stream error: \(error)"])
      self.sendEvent("onError", ["message": "Stream error: \(error)"])
    }
    self.listenerTokens.append(errorToken)

    Task {
      await session.start()
    }
  }

  @MainActor
  private func takePhoto(promise: Promise) {
    guard let session = self.streamSession else {
      promise.reject(
        NSError(
          domain: "MetaGlasses",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "No active session. Connect to glasses first."]
        )
      )
      return
    }

    let photoToken = session.photoDataPublisher.listen { [weak self] photoData in
      let base64 = photoData.data.base64EncodedString()
      self?.sendEvent("onPhotoCaptured", ["base64": base64])
      promise.resolve(base64)
    }
    self.listenerTokens.append(photoToken)

    let success = session.capturePhoto(format: .jpeg)
    if !success {
      promise.reject(
        NSError(
          domain: "MetaGlasses",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "Failed to initiate photo capture."]
        )
      )
    }
  }
  #endif

  // MARK: - Helpers

  private func updateConnectionState(_ state: String) {
    self.connectionState = state
    sendEvent("onConnectionStateChanged", ["state": state])
  }

  private func tearDown() {
    #if canImport(MWDATCore)
    Task { @MainActor in
      if let session = self.streamSession {
        await session.stop()
      }
      self.streamSession = nil
      self.deviceSelector = nil
      for token in self.listenerTokens {
        await token.cancel()
      }
      self.listenerTokens.removeAll()
    }
    #endif
  }
}
