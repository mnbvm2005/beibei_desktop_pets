#!/usr/bin/env node
// Build-only resource editor; no native Windows tools or application dependencies.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as PE from 'pe-library';
import * as ResEdit from 'resedit';

const [inputPath, outputPath, iconPath, version = '1.0.0'] = process.argv.slice(2);
if (!inputPath || !outputPath || !iconPath) {
  throw new Error('Usage: node set-windows-resources.mjs source.exe output.exe icon.ico [version]');
}
if (inputPath === outputPath) throw new Error('Use a separate output file; original runtime is never edited.');
const original = fs.readFileSync(inputPath);
const exe = PE.NtExecutable.from(original, { ignoreCert: true });
const resource = PE.NtExecutableResource.from(exe);
const icon = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resource.entries);
assert(groups.length > 0, 'Electron icon resource was not found');
for (const group of groups) {
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resource.entries, group.id, group.lang, icon.icons.map(item => item.data));
}
const versions = ResEdit.Resource.VersionInfo.fromEntries(resource.entries);
assert(versions.length > 0, 'Electron version metadata was not found');
for (const info of versions) {
  const languages = info.getAvailableLanguages();
  for (const language of languages) {
    info.setFileVersion(version, language.lang);
    info.setProductVersion(version, language.lang);
    info.setStringValues(language, {
      CompanyName: '杯杯', FileDescription: '杯杯桌宠', ProductName: '杯杯',
      InternalName: 'Beibei', OriginalFilename: 'Beibei.exe',
      FileVersion: version, ProductVersion: version,
      LegalCopyright: '杯杯桌宠 · Electron contributors',
    });
  }
  info.outputToResourceEntries(resource.entries);
}
resource.outputResource(exe);
const generated = Buffer.from(exe.generate());
// Ensure an icon/metadata update did not modify executable code or import sections.
const reparsed = PE.NtExecutable.from(generated);
for (const section of PE.NtExecutable.from(original, { ignoreCert: true }).getAllSections()) {
  if (section.info.name === '.rsrc') continue;
  const next = reparsed.getAllSections().find(item => item.info.name === section.info.name);
  assert(next, `Missing section ${section.info.name}`);
  assert.deepEqual(Buffer.from(next.data ?? []), Buffer.from(section.data ?? []), `Changed non-resource section ${section.info.name}`);
}
const finalResource = PE.NtExecutableResource.from(reparsed);
const finalVersions = ResEdit.Resource.VersionInfo.fromEntries(finalResource.entries);
assert(finalVersions.every(info => info.getAvailableLanguages().every(lang => info.getStringValues(lang).ProductName === '杯杯')));
const finalGroups = ResEdit.Resource.IconGroupEntry.fromEntries(finalResource.entries);
assert(finalGroups.length === groups.length);
fs.writeFileSync(outputPath, generated);
console.log(`Windows resources: ${finalGroups.length} icon group(s), product 杯杯, version ${version}; executable sections unchanged.`);
