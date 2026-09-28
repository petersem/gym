import express from "express";
import { UsersModel, USER_ROLE_ADMIN, USER_ROLE_TRAINER, USER_ROLE_MEMBER } from "../models/UsersModel.mjs";
import bcrypt from "bcrypt";

/** HTTP handlers for users. */
export class UsersController {
    static routes = express.Router()

    static {
        this.routes.get(
            "/",
            //AuthenticationController.restrict(["admin"]),
            this.viewUserManagement
        )

        this.routes.get(
            "/:id",
            //AuthenticationController.restrict(["admin"]),
            this.viewUserManagement
        )

        this.routes.post(
            "/",
            //AuthenticationController.restrict(["admin"]),
            this.handleUserManagement
        )

        this.routes.post(
            "/:id",
            //AuthenticationController.restrict(["admin"]),
            this.handleUserManagement
        )
    }

    /**
     * 
     * @type {express.RequestHandler}
     */
    static viewUserManagement(req, res) {
        const selectedUserId = req.params.id
        const query = req.query ?? {}
        const selectedSearchTerm = String(query.search_term ?? "").trim()
        const selectedRole = [USER_ROLE_ADMIN, USER_ROLE_TRAINER, USER_ROLE_MEMBER].includes(query.role)
            ? query.role : ""
        const selectedSortBy = Object.keys(UsersModel.SORTABLE_COLUMNS).includes(query.sort_by)
            ? query.sort_by : "last_name"
        const selectedSortDir = query.sort_dir === "desc" ? "desc" : "asc"
        const pageSize = 7
        const selectedPage = Math.max(1, Number(query.page) || 1)
        const usersPromise = UsersModel.list({
            searchTerm: selectedSearchTerm, role: selectedRole, sortBy: selectedSortBy, sortDir: selectedSortDir,
            page: selectedPage, pageSize,
        })

        usersPromise
            .then(({ users, total }) => {

                const selectedUser = users.find(
                    e => e.id == selectedUserId
                ) ?? new UsersModel(
                    null,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    0,
                    0,
                )

                res.render("user_management.ejs", {
                    users,
                    selectedUser,
                    selectedSearchTerm,
                    selectedRole,
                    selectedSortBy,
                    selectedSortDir,
                    selectedPage,
                    totalPages: Math.max(1, Math.ceil(total / pageSize)),
                    authenticatedUser: req.authenticatedUser,
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
            formData["email"],
            formData["password"],
            formData["phone"],
            formData["dob"],
            formData["deleted"],
            formData["authenticationKey"] ?? formData["authentication_key"] ?? 0
        )

        // We need to hash the password if it is not hashed
        if (!/^\$2[aby]\$/.test(user.password)) {
            user.password = bcrypt.hashSync(user.password, 10)
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
                        res.redirect("/users")
                    } else {
                        res.render("status.ejs", {
                            status: "User Deletion Failed",
                            message: "The user could not be found.",
                        });
                    }
                })
                .catch(error => {
                    res.render("status.ejs", {
                        status: "Database Error",
                        message: "The user could not be deleted.",
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