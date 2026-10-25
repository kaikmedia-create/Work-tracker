import {createInterface} from 'node:readline/promises';
import {randomBytes,scryptSync} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const rl=createInterface({input:process.stdin,output:process.stdout});
const pass=await rl.question('Neues Passwort für Relief Studio (Eingabe ist sichtbar): ');rl.close();
if(pass.length<4){console.error('Mindestens vier Zeichen erforderlich; für Internetbetrieb 12 oder mehr empfohlen.');process.exit(1);}
const salt=randomBytes(24).toString('hex'),hash=scryptSync(pass,salt,64).toString('hex');
await writeFile(new URL('./auth.local.json',import.meta.url),JSON.stringify({salt,hash}),{mode:0o600});
console.log('Lokales Passwort gespeichert. Start: node server.mjs. auth.local.json niemals veröffentlichen.');