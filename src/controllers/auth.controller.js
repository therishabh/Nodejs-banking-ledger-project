const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const { sendRegistrationEmail } = require('../services/email.service');

/** 
 * - User Register Controller
 * - POST /api/auth/register
*/
async function userRegisterController(req, res) {
    try {
        const {email, password, name} = req.body;
        const isEmailExists = await userModel.findOne({email});

        if(isEmailExists){
            return res.status(422).json({
                message : "User already exists with this email.",
                status: "failed"
            })
        }

        const user = await userModel.create({
            email, name, password
        });

        const jwtSecret = process.env.JWT_SECRET;
        const token = jwt.sign({userId: user._id}, jwtSecret, {expiresIn: '3d'})

        // httpOnly: JS (document.cookie) se cookie read nahi hogi, XSS se token chori nahi hoga
        // maxAge: 3 din (ms me), token ki expiry ke barabar
        // sameSite: dusri site se aayi request me cookie nahi jayegi (CSRF se bachav)
        // secure: production me sirf HTTPS par cookie jayegi
        res.cookie('jwt_token', token, {
            httpOnly: true,
            maxAge: 3 * 24 * 60 * 60 * 1000,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production'
        });

        res.status(201).json({
            user : {
                id : user._id,
                email : user.email,
                name : user.name
            },
            token: token,
            message: "User has been successfully created",
            status : "success"
        });

        await sendRegistrationEmail(email, name);
    } catch (error) {
        // schema validation fail (galat email, chhota password, etc.)
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: Object.values(error.errors).map(e => e.message).join(', '),
                status: 'failed'
            })
        }

        // do request ek saath aayi to unique index duplicate email par E11000 deta hai
        if (error.code === 11000) {
            return res.status(422).json({
                message: "User already exists with this email.",
                status: "failed"
            })
        }

        console.error('Register error:', error);
        return res.status(500).json({
            message: "Something went wrong, please try again later.",
            status: "failed"
        })
    }
}

/**
 * 
 * 
 */

async function userLoginController(req, res) {
    const {email, password} = req.body;

    // password field me select:false hai, isliye login me .select("+password") zaroori hai
    const user = await userModel.findOne({email}).select("+password");

    if(!user){
        return res.status(401).json({
            status : "failed",
            message : "Email or password is not valid"
        });
    }

    const isValidPassword = await user.comparePassword(password);
    if(!isValidPassword){
        return res.status(401).json({
            status : "failed",
            message : "Email or password is not valid"
        });
    }

    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign({userId: user._id}, jwtSecret, {expiresIn: '3d'})

    // httpOnly: JS (document.cookie) se cookie read nahi hogi, XSS se token chori nahi hoga
    // maxAge: 3 din (ms me), token ki expiry ke barabar
    // sameSite: dusri site se aayi request me cookie nahi jayegi (CSRF se bachav)
    // secure: production me sirf HTTPS par cookie jayegi
    res.cookie('jwt_token', token, {
        httpOnly: true,
        maxAge: 3 * 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
    });

    res.status(200).json({
        user : {
            id : user._id,
            email : user.email,
            name : user.name
        },
        token: token,
        message: "User has been successfully login",
        status : "success"
    })


}

module.exports = {
    userRegisterController,
    userLoginController
}