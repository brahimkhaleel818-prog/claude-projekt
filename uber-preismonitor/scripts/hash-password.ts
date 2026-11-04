import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Aufruf: npm run hash-password -- "MeinSicheresPasswort"  (mind. 10 Zeichen)');
  process.exit(1);
}
// Base64-kodiert, damit die "$"-Zeichen des bcrypt-Hashs nicht von
// .env-/Docker-Variablenersetzung verfälscht werden.
console.log("b64:" + Buffer.from(bcrypt.hashSync(pw, 12)).toString("base64"));
