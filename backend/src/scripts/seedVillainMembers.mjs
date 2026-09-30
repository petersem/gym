import bcrypt from "bcrypt";
import { UsersModel } from "../models/UsersModel.mjs";

// First/last name pairs based on well-known villains from movies and TV over
// the last ~35 years, used to seed member accounts.
const VILLAIN_NAMES = [
  ["Obadiah", "Stane"],
  ["Ivan", "Vanko"],
  ["Aldrich", "Killian"],
  ["Emil", "Blonsky"],
  ["Loki", "Laufeyson"],
  ["Malekith", "Aetherios"],
  ["Hela", "Odindottir"],
  ["Gorr", "Butcher"],
  ["Ayesha", "Sovereign"],
  ["Ronan", "Accuser"],
  ["Ego", "Celestial"],
  ["Thanos", "Titan"],
  ["Ultron", "Prime"],
  ["Helmut", "Zemo"],
  ["Erik", "Killmonger"],
  ["Ulysses", "Klaue"],
  ["Adrian", "Toomes"],
  ["Quentin", "Beck"],
  ["Dormammu", "Dark"],
  ["Ebony", "Maw"],
  ["Kang", "Conqueror"],
  ["Agatha", "Harkness"],
  ["Namor", "Mckenzie"],
  ["Cassandra", "Nova"],
  ["Arthur", "Harrow"],
  ["Antonia", "Dreykov"],
  ["Valentin", "Dreykov"],
  ["Karli", "Morgenthau"],
  ["Norman", "Osborn"],
  ["Otto", "Octavius"],
  ["Harry", "Osborn"],
  ["Flint", "Marko"],
  ["Max", "Dillon"],
  ["Eddie", "Brock"],
  ["Cletus", "Kasady"],
  ["Curt", "Connors"],
  ["Mac", "Gargan"],
  ["Ra's", "al Ghul"],
  ["Bane", "Santiago"],
  ["Harvey", "Dent"],
  ["Edward", "Nygma"],
  ["Oswald", "Cobblepot"],
  ["Selina", "Kyle"],
  ["Jonathan", "Crane"],
  ["Dru", "Zod"],
  ["Faora", "Ul"],
  ["Lex", "Luthor"],
  ["Amanda", "Waller"],
  ["David", "Kane"],
  ["Orm", "Marius"],
  ["Slade", "Wilson"],
  ["Darkseid", "Uxas"],
  ["Steppenwolf", "Ares"],
  ["Amora", "Enchantress"],
  ["Maxwell", "Lord"],
  ["Barbara", "Minerva"],
  ["Ares", "Olympian"],
  ["Arthur", "Fleck"],
  ["Ultraman", "Kent"],
  ["Angela", "Spica"],
  ["Walter", "White"],
  ["Gustavo", "Fring"],
  ["Lalo", "Salamanca"],
  ["Cersei", "Lannister"],
  ["Ramsay", "Bolton"],
  ["Joffrey", "Baratheon"],
  ["John", "Gillman"],
  ["Soldier", "Boy"],
  ["Henry", "Creel"],
  ["Bill", "Cipher"],
  ["Negan", "Smith"],
  ["Philip", "Blake"],
  ["Zebediah", "Killgrave"],
  ["Wilson", "Fisk"],
  ["Tom", "Riddle"],
  ["Sauron", "Mairon"],
  ["Anton", "Chigurh"],
  ["Immortan", "Joe"],
  ["Alexander", "Pierce"],
  ["William", "Stryker"],
  ["Sebastian", "Shaw"],
  ["Apocalypse", "Nur"],
  ["Raven", "Darkholme"],
  ["Erik", "Lehnsherr"],
  ["Tyrell", "Wellick"],
  ["White", "Rose"],
  ["Hannibal", "Lecter"],
  ["Jame", "Gumb"],
  ["Norman", "Stansfield"],
  ["Hans", "Landa"],
  ["Hans", "Gruber"],
  ["Anakin", "Skywalker"],
  ["Sheev", "Palpatine"],
  ["Ben", "Solo"],
  ["Agent", "Smith"],
  ["Norman", "Bates"],
  ["Freddy", "Krueger"],
  ["Jason", "Voorhees"],
  ["Michael", "Myers"],
  ["Pinhead", "Cenobite"],
  ["Charles", "LeeRay"],
  ["Robert", "Gray"],
  ["Mildred", "Ratched"],
  ["Annie", "Wilkes"],
  ["Jafar", "Sultan"],
  ["Cruella", "de Vil"],
  ["Taka", "Scar"],
  ["Vecna", "Creel"],
  ["Brainiac", "Vril"],
  ["Deathstroke", "Slade"],
];

const DEFAULT_PASSWORD_HASH = bcrypt.hashSync("testing123", 10);

const buildEmail = (firstName, lastName, usedEmails) => {
  const initials = `${firstName[0]}${lastName[0]}`.toLowerCase();
  let email = `${initials}@gym.com`;
  let suffix = 2;
  while (usedEmails.has(email)) {
    email = `${initials}${suffix}@gym.com`;
    suffix += 1;
  }
  usedEmails.add(email);
  return email;
};

const seedVillainMembers = async () => {
  const usedEmails = new Set();
  const namesWithLastName = VILLAIN_NAMES.filter(([, lastName]) =>
    Boolean(lastName && lastName.trim()),
  );
  let skipped = 0;
  for (const [index, [firstName, lastName]] of namesWithLastName.entries()) {
    const user = new UsersModel(
      null,
      firstName,
      lastName,
      "member",
      buildEmail(firstName, lastName, usedEmails),
      DEFAULT_PASSWORD_HASH,
      `555-${String(1000 + index).padStart(4, "0")}`,
      "1990-01-01",
      0,
      null,
    );
    try {
      await UsersModel.create(user);
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }
  console.log(
    `Seeded ${namesWithLastName.length - skipped} member users.${skipped ? ` Skipped ${skipped} duplicate(s).` : ""}`,
  );
  await UsersModel.connection.end();
};

seedVillainMembers().catch((error) => {
  console.error("Failed to seed villain members:", error);
  process.exitCode = 1;
});
