#!/usr/bin/env node
import { buildSwiftCliHelper } from './swift-cli-helper-macos.mjs'

buildSwiftCliHelper({
  nativeDir: 'project-symbols-macos',
  executable: 'orca-project-symbols',
  argv: process.argv.slice(2)
})
