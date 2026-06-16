import AppKit
import Foundation
import PhotosUI
import UniformTypeIdentifiers

let pickerDidCancel = "__FOLIO_PHOTOS_PICKER_CANCELLED__"
let pickerDidExport = "__FOLIO_PHOTOS_PICKER_EXPORTED__"

final class PickerCoordinator: NSObject, PHPickerViewControllerDelegate {
  private let outputDirectory: URL
  private let fileManager = FileManager.default
  private let resultQueue = DispatchQueue(label: "folio.photos-picker.results")
  private var errors: [String] = []
  var window: NSWindow?

  init(outputDirectory: URL) {
    self.outputDirectory = outputDirectory
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    guard !results.isEmpty else {
      print(pickerDidCancel)
      NSApp.terminate(nil)
      return
    }

    let group = DispatchGroup()

    for (index, result) in results.enumerated() {
      let provider = result.itemProvider
      let typeIdentifier = preferredTypeIdentifier(for: provider)

      group.enter()
      provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { [weak self] url, error in
        defer { group.leave() }
        guard let self else { return }

        if let error {
          self.recordError(error.localizedDescription)
          return
        }

        guard let url else {
          self.recordError("Photos returned an empty file for item \(index + 1).")
          return
        }

        do {
          let destination = try self.destinationURL(
            for: provider,
            typeIdentifier: typeIdentifier,
            fallbackIndex: index,
          )
          try self.copyFile(from: url, to: destination)
        } catch {
          self.recordError(error.localizedDescription)
        }
      }
    }

    group.notify(queue: .main) { [weak self] in
      guard let self else { return }

      if self.errors.isEmpty {
        print(pickerDidExport)
        NSApp.terminate(nil)
        return
      }

      fputs(self.errors.joined(separator: "\n"), stderr)
      NSApp.terminate(nil)
      exit(1)
    }
  }

  private func preferredTypeIdentifier(for provider: NSItemProvider) -> String {
    let identifiers = provider.registeredTypeIdentifiers
    let preferred = identifiers.first { identifier in
      guard let type = UTType(identifier) else { return false }
      return type.conforms(to: .image) || type.conforms(to: .movie) || type.conforms(to: .video)
    }

    return preferred ?? identifiers.first ?? UTType.item.identifier
  }

  private func destinationURL(
    for provider: NSItemProvider,
    typeIdentifier: String,
    fallbackIndex: Int,
  ) throws -> URL {
    let type = UTType(typeIdentifier)
    let fallbackExtension = type?.preferredFilenameExtension ?? "dat"
    let suggestedName = provider.suggestedName ?? "photo-\(fallbackIndex + 1)"
    let baseName = sanitizedBaseName(from: suggestedName)
    let ext = URL(fileURLWithPath: suggestedName).pathExtension.isEmpty
      ? fallbackExtension
      : URL(fileURLWithPath: suggestedName).pathExtension

    var destination = outputDirectory.appendingPathComponent("\(baseName).\(ext)")
    var counter = 2
    while fileManager.fileExists(atPath: destination.path) {
      destination = outputDirectory.appendingPathComponent("\(baseName)-\(counter).\(ext)")
      counter += 1
    }

    return destination
  }

  private func sanitizedBaseName(from filename: String) -> String {
    let base = URL(fileURLWithPath: filename).deletingPathExtension().lastPathComponent
    let cleaned = base
      .replacingOccurrences(
        of: "[^A-Za-z0-9._-]+",
        with: "-",
        options: .regularExpression,
      )
      .trimmingCharacters(in: CharacterSet(charactersIn: ".-_"))

    return cleaned.isEmpty ? "photo" : cleaned
  }

  private func copyFile(from source: URL, to destination: URL) throws {
    try fileManager.copyItem(at: source, to: destination)
  }

  private func recordError(_ message: String) {
    resultQueue.sync {
      errors.append(message)
    }
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  private var coordinator: PickerCoordinator?

  func applicationDidFinishLaunching(_ notification: Notification) {
    guard CommandLine.arguments.count >= 2 else {
      fputs("Missing export directory argument.\n", stderr)
      NSApp.terminate(nil)
      exit(1)
    }

    let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    var configuration = PHPickerConfiguration(photoLibrary: .shared())
    configuration.filter = .any(of: [.images, .videos])
    configuration.selectionLimit = 0
    configuration.preferredAssetRepresentationMode = .current

    let picker = PHPickerViewController(configuration: configuration)
    let coordinator = PickerCoordinator(outputDirectory: outputDirectory)
    picker.delegate = coordinator

    let window = NSWindow(contentViewController: picker)
    window.title = "Import from Photos"
    window.setContentSize(NSSize(width: 960, height: 680))
    window.center()
    window.makeKeyAndOrderFront(nil)

    coordinator.window = window
    self.coordinator = coordinator

    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
