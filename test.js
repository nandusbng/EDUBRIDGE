const fs = require('fs');
try {
  let code = fs.readFileSync('public/assets/js/faculty.js', 'utf8');
  new Function(code);
  console.log("Syntax is valid.");
} catch(e) {
  console.log("Syntax error:", e);
}
