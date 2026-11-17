import AppKit
import Foundation

let preferred = [
    "folder",
    "folder.fill",
    "terminal",
    "terminal.fill",
    "chevron.left.forwardslash.chevron.right",
    "doc",
    "doc.fill",
    "doc.text",
    "doc.text.fill",
    "doc.on.clipboard",
    "list.bullet",
    "list.bullet.rectangle",
    "pencil",
    "pencil.and.ruler",
    "ruler",
    "swatchpalette.fill",
    "paintpalette.fill",
    "sparkle",
    "star",
    "star.fill",
    "gearshape",
    "gearshape.fill",
    "wrench",
    "wrench.fill",
    "hammer",
    "hammer.fill",
    "screwdriver",
    "screwdriver.fill",
    "wand.and.stars",
    "globe",
    "globe.americas",
    "network",
    "server.rack",
    "externaldrive",
    "externaldrive.fill",
    "opticaldisc",
    "opticaldisc.fill",
    "cloud",
    "cloud.fill",
    "square.grid.2x2",
    "square.grid.2x2.fill",
    "square.grid.3x2",
    "square.grid.3x2.fill",
    "rectangle.grid.1x2",
    "rectangle.grid.1x2.fill",
    "rectangle.3.group",
    "rectangle.3.group.fill",
    "square.stack",
    "square.stack.fill",
    "circle",
    "circle.fill",
    "diamond",
    "diamond.fill",
    "hexagon",
    "hexagon.fill",
    "app",
    "app.fill",
    "app.badge",
    "app.badge.fill",
    "macwindow",
    "play",
    "play.fill",
    "play.rectangle",
    "play.rectangle.fill",
    "music.note",
    "music.note.list",
    "film",
    "film.fill",
    "photo",
    "photo.fill",
    "video",
    "video.fill",
    "message",
    "message.fill",
    "bubble.left",
    "bubble.left.fill",
    "envelope",
    "envelope.fill",
    "calendar",
    "clock",
    "clock.fill",
    "timer",
    "bell",
    "bell.fill",
    "bell.badge",
    "bell.badge.fill",
    "bookmark",
    "bookmark.fill",
    "flag",
    "flag.fill",
    "tag",
    "tag.fill",
    "book",
    "book.fill",
    "books.vertical",
    "books.vertical.fill",
    "magnifyingglass",
    "lightbulb",
    "lightbulb.fill",
    "cube",
    "cube.fill",
    "cylinder",
    "cylinder.fill",
    "capsule",
    "capsule.fill",
    "pyramid",
    "pyramid.fill",
    "cone",
    "cone.fill",
    "key",
    "key.fill",
    "lock",
    "lock.fill",
    "lock.shield",
    "lock.shield.fill",
    "shield",
    "shield.fill",
    "bolt",
    "bolt.fill",
    "bolt.shield",
    "bolt.shield.fill",
    "waveform",
    "waveform.path",
    "chart.pie",
    "chart.pie.fill",
    "chart.bar",
    "chart.bar.fill",
    "chart.line.uptrend.xyaxis",
    "gauge",
    "speedometer",
    "viewfinder",
    "viewfinder.circle",
    "camera",
    "camera.fill",
    "eye",
    "eye.fill",
    "eye.slash",
    "eye.slash.fill",
    "person",
    "person.fill",
    "person.circle",
    "person.circle.fill",
    "person.2",
    "person.2.fill",
    "person.3",
    "person.3.fill",
    "backpack",
    "backpack.fill",
    "house",
    "house.fill",
    "building",
    "building.fill",
    "building.columns",
    "building.columns.fill",
    "cart",
    "cart.fill",
    "bag",
    "bag.fill",
    "creditcard",
    "creditcard.fill",
    "link",
    "link.circle",
    "link.circle.fill",
    "square.and.arrow.up",
    "square.and.arrow.up.fill",
    "square.on.square",
    "square.on.square.fill",
    "arrowshape.turn.up.forward",
    "arrowshape.turn.up.forward.fill",
    "arrow.up",
    "arrow.down",
    "arrow.left",
    "arrow.right",
    "arrow.up.circle",
    "arrow.up.circle.fill",
    "arrow.down.circle",
    "arrow.down.circle.fill",
    "arrow.left.circle",
    "arrow.left.circle.fill",
    "arrow.right.circle",
    "arrow.right.circle.fill",
    "arrow.left.and.right",
    "arrow.up.and.down",
    "arrow.triangle.branch",
    "arrow.triangle.merge",
    "arrow.triangle.swap",
    "arrowshape.backward",
    "arrowshape.forward",
    "gobackward",
    "goforward",
    "forward",
    "forward.fill",
]

let resources = URL(fileURLWithPath: "/System/Library/CoreServices/CoreGlyphs.bundle/Contents/Resources")
func plist<T>(_ name: String, fallback: T) -> T {
    guard let data = try? Data(contentsOf: resources.appendingPathComponent(name)),
          let value = try? PropertyListSerialization.propertyList(from: data, format: nil) as? T else { return fallback }
    return value
}
func writeJSON(_ value: Any) throws {
    FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]))
}
func symbolPNG(_ name: String) -> String? {
    guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil),
          let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 64, pixelsHigh: 64,
              bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
              colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
          let context = NSGraphicsContext(bitmapImageRep: bitmap) else { return nil }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    let scale = 48 / max(image.size.width, image.size.height)
    let size = NSSize(width: image.size.width * scale, height: image.size.height * scale)
    image.draw(in: NSRect(x: (64 - size.width) / 2, y: (64 - size.height) / 2, width: size.width, height: size.height))
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: 64, height: 64).fill(using: .sourceIn)
    NSGraphicsContext.restoreGraphicsState()
    guard let data = bitmap.representation(using: .png, properties: [:]) else { return nil }
    return "data:image/png;base64," + data.base64EncodedString()
}

do {
    if CommandLine.arguments.dropFirst().first == "catalog" {
        let order: [String] = plist("symbol_order.plist", fallback: [])
        let restrictions: [String: String] = plist("symbol_restrictions.strings", fallback: [:])
        let keywords: [String: [String]] = plist("symbol_search.plist", fallback: [:])
        let groups: [String: [String]] = plist("symbol_categories.plist", fallback: [:])
        let listed = Set(order)
        let locales = Set("ar bn el gu he hi ja km kn ko ml mni mr my or pa rtl ru sat si sr ta te th uk vi zh".split(separator: " ").map(String.init))
        let preferredSet = Set(preferred)
        let entries = (preferred + order.filter { !preferredSet.contains($0) }).filter { name in
            let parts = name.split(separator: ".")
            let localized = parts.last.map { locales.contains(String($0)) && listed.contains(parts.dropLast().joined(separator: ".")) } ?? false
            return !localized && restrictions[name] == nil
        }.map { name -> [String: Any] in
            ["name": name, "search": (name.replacingOccurrences(of: ".", with: " ") + " " + (keywords[name] ?? []).joined(separator: " ")).lowercased(), "categories": groups[name] ?? []]
        }
        let categories: [[String: String]] = plist("categories.plist", fallback: [])
        try writeJSON(["entries": entries, "categories": categories.filter { $0["key"] != "all" }.map { ["key": $0["key"] ?? "", "name": $0["key"] ?? "", "icon": $0["icon"] ?? ""] }])
    } else if CommandLine.arguments.dropFirst().first == "render" {
        let names = Array(CommandLine.arguments.dropFirst(2))
        guard names.count <= 128 && names.allSatisfy({ $0.range(of: "^[a-zA-Z0-9._-]{1,128}$", options: .regularExpression) != nil }) else { exit(1) }
        var images: [String: String] = [:]
        for name in names { if let png = symbolPNG(name) { images[name] = png } }
        try writeJSON(images)
    } else { exit(1) }
} catch {
    FileHandle.standardError.write(Data("Project symbols: \(error)\n".utf8))
    exit(1)
}
