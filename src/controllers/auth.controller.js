const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken')

/** 
 * - User Register Controller
 * - POST /api/auth/register
*/
async function userRegisterController(req, res) {
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

    res.cookie('jwt_token', token);

    res.status(201).json({
        user : {
            id : user._id,
            email : user.email,
            name : user.name
        },
        token: token,
        message: "User has been successfully created",
        status : "success"
    })


}

module.exports = {
    userRegisterController
}