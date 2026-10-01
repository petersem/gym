import bcrypt from "bcrypt";
import { UsersModel } from "../models/UsersModel.mjs";

try {
    const admins = await UsersModel.query(
        "SELECT id FROM users WHERE role = 'admin' AND deleted = 0 LIMIT 1",
    );
    if (admins.length === 0) {
        const passwordHash = await bcrypt.hash(process.env.ADMIN_SEED_PASSWORD, 10);
        await UsersModel.query(
            `INSERT INTO users (first_name, last_name, role, email, password, phone)
       VALUES (?, ?, 'admin', ?, ?, '18675309')`,
            ["Gym", "Admin", process.env.ADMIN_EMAIL, passwordHash],
        );
        console.log("** New database detected **");
        console.log(
            `Seeded admin: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_SEED_PASSWORD}`,
        );
        console.log("** Change the default admin password after seeding **");
    } else {
        console.log(`Admin already exists: ${process.env.ADMIN_EMAIL}`);
    }
}
finally {
    await UsersModel.connection.end();
}
