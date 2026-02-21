const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

// Atualiza src-tauri/tauri.conf.json
const tauriConfPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
let tauriConf = fs.readFileSync(tauriConfPath, 'utf8');
tauriConf = tauriConf.replace(/"version": ".*?"/, `"version": "${currentVersion}"`);
fs.writeFileSync(tauriConfPath, tauriConf);

// Atualiza src-tauri/Cargo.toml
const cargoTomlPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version = ".*?"/m, `version = "${currentVersion}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);

console.log(`✔ Arquivos do Tauri atualizados para a versão: ${currentVersion}`);
