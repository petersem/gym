import express from "express";
import { UsersModel } from "../models/UsersModel.mjs";

/** HTTP handlers for users. */
export class UsersController {
    static routes = express.Router()

    static {
        this.routes.get(
            "/",
            //AuthenticationController.restrict(["admin"]),
            this.viewEmployeeManagement
        )

        this.routes.get(
            "/:id",
            //AuthenticationController.restrict(["admin"]),
            this.viewEmployeeManagement
        )

        this.routes.post(
            "/",
            //AuthenticationController.restrict(["admin"]),
            this.handleEmployeeManagement
        )

        this.routes.post(
            "/:id",
            //AuthenticationController.restrict(["admin"]),
            this.handleEmployeeManagement
        )
    }

    /**
     * 
     * @type {express.RequestHandler}
     */
    static viewUserManagement(req, res) {
        const selectedEmployeeId = req.params.id

        UserModel.getAll()
            .then(users => {

                const selectedUser = users.find(
                    e => e.id == selectedUserId
                ) ?? new UserModel(null, "", "", "", "", "")

                res.render("user_management.ejs", {
                    user,
                    selectedUser,
                    role: "admin",
                })
            })
            .catch(error => {
                console.log(error)
            })
    }

    /**
     * 
     * @type {express.RequestHandler}
     */
    static handleUserManagement(req, res) {
        const selectedUserId = req.params.id
        const formData = req.body
        const action = formData.action

        // TODO: Validate form data and url parameter (id)

        const user = new UsersModel(
            selectedUserId,
            formData["firstName"],
            formData["lastName"],
            formData["role"],
            formData["username"],
            formData["password"]
        )

        // We need to hash the password if it is not hashed
        if (!user.password.startsWith("$2a")) {
            user.password = bcrypt.hashSync(user.password)
        }

        if (action == "create") {
            UsersModel.create(user)
                .then(result => {
                    res.redirect("/users")
                })
                .catch(error => {
                    res.render("status.ejs", {
                        status: "Database Error",
                        message: "The user could not be created.",
                    });
                    console.error(error)
                })
        } else if (action == "update") {
            UsersModel.update(user)
                .then(result => {
                    if (result.affectedRows > 0) {
                        res.redirect("/users")
                    } else {
                        res.render("status.ejs", {
                            status: "User Update Failed",
                            message: "The user could not be found.",
                        });
                    }
                })
                .catch(error => {
                    res.render("status.ejs", {
                        status: "Database Error",
                        message: "The user could not be updated.",
                    });
                    console.error(error)
                })
        } else if (action == "delete") {
            UsersModel.delete(user.id)
                .then(result => {
                    if (result.affectedRows > 0) {
                        res.redirect("/usersemployees")
                    } else {
                        res.render("status.ejs", {
                            status: "Employee Deletion Failed",
                            message: "The employee could not be found.",
                        });
                    }
                })
                .catch(error => {
                    res.render("status.ejs", {
                        status: "Database Error",
                        message: "The employee could not be deleted.",
                    });
                    console.error(error)
                })
        } else {
            res.render("status.ejs", {
                status: "Invalid Action",
                message: "The form doesn't support this action.",
            });
        }
    }

}