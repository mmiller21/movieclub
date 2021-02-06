import { User } from "../entities/User";
import { Review } from "../entities/Review";
import { Watchlist } from "../entities/Watchlist";
import { Favourites } from "../entities/Favourites";


import { UserProfileEdit } from "../interfaces/UserEdit";
import { UserGeneral } from "../interfaces/UserGeneral";
import { CustomError } from "../interfaces/CustomError";
import { ReviewFilter } from "../interfaces/ReviewFilter";

import { createPassword, comparePassword } from "../utils/password";
import { fieldError } from "../utils/fieldError";
import { validatePassword } from "../utils/validatePassword";
import { validateUserGeneral } from "../utils/validateUserGeneral";
import { HttpError } from "../utils/CustomErrors";

import { Request, Response } from "express";
import { v4 } from "uuid";
import { getConnection } from "typeorm";



/**
 * @description Edit user properties such as firstname, last name, etc
 * @param {UserProfileEdit} res user properties to edit
 * @param {Request} req Cookie containing user id
 * @returns {Promise<User>} error if invalid, user otherwise
 */
export const editProfile: (userEdit: UserProfileEdit, req: Request) => Promise<User> = async function(userEdit: UserProfileEdit, req: Request): Promise<User> {
    const errors: CustomError[] = [];
    if (userEdit.firstName.length > 50 || userEdit.lastName.length > 50){
        errors.push(fieldError("name", "name too long"));
    }

    if(errors.length > 0){
        throw new HttpError(errors);
    }
    //no validation errors, update user 

    let user: User = await getConnection()
    .createQueryBuilder()
    .update(User)
    .set({...userEdit})
    .where('id = :id', {id: req.session.userId})
    .returning('*')
    .execute()
    .then(res => res.raw[0]);

    if (!user){
        throw new HttpError([fieldError("user", "User doesn't exist")]);
    }

    return user;
}

/**
 * @description Edit username and email, requires user to enter password to update
 * @param {UserGeneral} userGeneral username, email, and password
 * @param {Request} req Cookie containing user id
 * @returns {Promise<User>} error if invalid, user otherwise
 */
export const updateUserGeneral: (userGeneral: UserGeneral, req: Request) => Promise<User> = async function(userGeneral: UserGeneral, req: Request): Promise<User> {
    // validate input
    const errors = validateUserGeneral(userGeneral);
    if (errors.length > 0){
        throw new HttpError(errors);
    }
    //obtain the user
    const user: User | undefined = await User.findOne({where: {id: req.session.userId}})
    //user doesn't exist
    if (!user){
        throw new HttpError([fieldError("user", "user doesn't exist")]);
    }
    //Compare the user password with the password in the db
    const success = await comparePassword(userGeneral.password, user.password);
    if (!success){
        throw new HttpError([fieldError("user", "user doesn't exist")]);
    }
    //everything good, update user
    try {
        await User.update({id: req.session.userId}, {username: userGeneral.username, email: userGeneral.email})
    }
    catch(err) {
        if (err.code === "23505"){
            if (err.detail.includes("username")){
                throw new HttpError([fieldError("username", "username already exists")])
            }
            if (err.detail.includes("email")){
                throw new HttpError([fieldError("email", "email already exists")])
            }
        }
    }

    user.username = userGeneral.username;
    user.email = userGeneral.email;
    
    return user;
}

/**
 * @description Change password of user, first make sure oldpassword is correct then update to new password
 * @param {string} password new password
 * @param {Request} req Request object containing user id
 * @returns {Promise<void>} void if valid, error otherwise
 */
export const changePassword: (oldPassword: string, newPassword: string, req: Request) => Promise<void> = async function(oldPassword: string, newPassword: string, req: Request): Promise<void> {
    //obtain the user
    const user: any = await User.findOne({where: {id: req.session.userId}})
    //user doesn't exist
    if (!user){
        throw new HttpError([fieldError("user", "user doesn't exist")]);
    }
    //validate the new password
    const error = validatePassword(newPassword);
    if(error){
        throw new HttpError([error])
    }

    //Compare the user password with the password in the db
    const success = await comparePassword(oldPassword, user.password);
    if (!success){
        throw new HttpError([fieldError("password", "incorrect password")])
    }
    const hashedPassword = await createPassword(newPassword);
    console.log(hashedPassword);
    try {
        await User.update({id: req.session.userId}, {password: hashedPassword});
    }
    catch(err){
        throw new HttpError([fieldError("Error", "Unknown Error")])
    }
}

/**
 * @description return user by id
 * @param userid 
 */
export const getUser: (userid: string) => Promise<User> = async function(userid: string): Promise<User> {
    const user: User | undefined = await User.findOne({where: {id: userid}});
    if (!user){
        throw new HttpError([fieldError("user", "user not found")]);
    }
    return user;
}

/**
 * @description get paginated result of reviews for that movie
 * @param {ReviewFilter} reviewFilter 
 * @param {number} movieId 
 * @returns {Promise<Review[]>} array of reviews, if none returned then array is empty
 */
export const getUserReviews: (reviewFilter: ReviewFilter, userId: string) => Promise<Review[]> = async function(reviewFilter: ReviewFilter, userId: string): Promise<Review[]> {
    const reviews: Review[] = await getConnection()
    .getRepository(Review)
    .createQueryBuilder("review")
    .orderBy(reviewFilter.filter === "date" ? "review.createdAt" : "score", reviewFilter.sort === "asc" ? "ASC" : "DESC")
    .skip(reviewFilter.skip * reviewFilter.take)
    .take(reviewFilter.take)
    .where("review.userId = :userId", {userId})
    .getMany();
    return reviews;
}

/**
 * @description return watchlist of user
 * @param {string} userId 
 * @returns {Promise<Watchlist[]>} array of watchlist, empty if none returned
 */
export const getWatchlist: (userId: string) => Promise<Watchlist[]> = async function(userId: string): Promise<Watchlist[]> {
    const watchlist: Watchlist[] = await getConnection()
    .getRepository(Watchlist)
    .createQueryBuilder("watchlist")
    .orderBy("watchlist.dateAdded", "DESC")
    .where("watchlist.userId = :userId", {userId})
    .getMany();

    return watchlist;
}

/**
 * @description return watchlist of user
 * @param {string} userId 
 * @returns {Promise<Favourites[]>} array of favourites, empty if none returned
 */
export const getFavourites: (userId: string) => Promise<Favourites[]> = async function(userId: string): Promise<Favourites[]> {
    const watchlist: Favourites[] = await getConnection()
    .getRepository(Favourites)
    .createQueryBuilder("favourites")
    .orderBy("favourites.dateAdded", "DESC")
    .where("favourites.userId = :userId", {userId})
    .getMany();

    return watchlist;
}