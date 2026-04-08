const fs = require('fs');
const path = require('path');
const glob = require('glob');

function replaceInFile(filePath, regex, replacement) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

const tsxFiles = glob.sync('src/app/**/*.tsx', { absolute: true });
tsxFiles.forEach(file => {
  replaceInFile(file, / uppercase tracking-wider/g, '');
  replaceInFile(file, /uppercase tracking-wider /g, '');
});

const dartFiles = glob.sync('mylui_mobile/lib/pages/*.dart', { absolute: true });
dartFiles.forEach(file => {
  // Fix .toUpperCase() in _buildLabel
  replaceInFile(file, /label\.toUpperCase\(\),/g, 'label,');
  // Fix ITEM DETAILS
  replaceInFile(file, /'ITEM DETAILS'/g, "'Item Details'");
  replaceInFile(file, /'ACTIVITY DETAILS'/g, "'Activity Details'");
  
  // Fix transaction_edit_page.dart ALL CAPS args
  replaceInFile(file, /_buildLabel\('AMOUNT'\)/g, "_buildLabel('Amount')");
  replaceInFile(file, /_buildLabel\('CATEGORY'\)/g, "_buildLabel('Note (Category)')");
  replaceInFile(file, /_buildLabel\('INCOME SOURCE',/g, "_buildLabel('Linked Income',");
  replaceInFile(file, /_buildLabel\('INCOME SOURCE'\)/g, "_buildLabel('Linked Income')");
  replaceInFile(file, /_buildLabel\('DATE'\)/g, "_buildLabel('Date')");
  replaceInFile(file, /_buildLabel\('ADDITIONAL DESCRIPTION'\)/g, "_buildLabel('Additional Description')");
});
