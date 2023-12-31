/* eslint-disable no-underscore-dangle */
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import AppError from '../config/app_error';
import catchAsync from '../config/catch_async';
import { ENV } from '../config/env';
import User, { UserDocument } from '../models/user_model';
import sendEmail from '../utils/mailer';

export const createSendToken = (user: UserDocument, statusCode: number, res: Response) => {
    const access_token = jwt.sign({ id: user._id }, ENV.JWT_KEY, {
        expiresIn: Number(ENV.ACCESS_TOKEN_TTL) * 60 * 60,
    });

    const refresh_token = jwt.sign({ id: user._id }, ENV.JWT_KEY, {
        expiresIn: Number(ENV.REFRESH_TOKEN_TTL) * 24 * 60 * 60,
    });
    user.password = undefined;

    const cookieSettings = {
        expires: new Date(Date.now() + Number(ENV.REFRESH_TOKEN_TTL) * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: false,
    };

    if (ENV.NODE_ENV == 'production') cookieSettings.secure = true;

    res.cookie('refresh_token', refresh_token, cookieSettings);
    res.status(statusCode).json({
        status: 'success',
        token: access_token,
        user,
    });
};

export const signup = catchAsync(async (req: Request, res: Response) => {
    const newUser = await User.create(req.body);
    createSendToken(newUser, 201, res);
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    if (!username || !password) return next(new AppError("Username or Password doesn't exists", 400));
    const user = await User.findOne({ username });

    if (!user || !(await user.correctPassword(password))) throw new AppError('Incorrect Username or Password', 400);
    createSendToken(user, 200, res);
});

export const logout = catchAsync(async (req: Request, res: Response) => {
    res.cookie('refresh_token', 'logout', {
        expires: new Date(Date.now() + 1 * 1000),
        httpOnly: true,
    });
    res.status(204).json({
        status: 'success',
        requestedAt: req.requestedAt,
        message: 'User Logged Out',
    });
});

export const sendResetURL = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findOne({ username: req.body.username });
    if (!user) return next(new AppError('No User of this username found', 401));
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const URL = `${req.protocol}://${req.get('host')}/resetPassword/${user.id}/${resetToken}`;
    const EmailSubject = `Reset your Password!`;
    const EmailBody = `Forgot your Password? Click here to reset: ${URL}`;
    try {
        await sendEmail({
            email: user.email,
            subject: EmailSubject,
            body: EmailBody,
            template: 'forgot_password',
        });
        res.status(200).json({
            status: 'success',
            requestedAt: req.requestedAt,
            message: 'Reset URL send to registered email.',
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpiresIn = undefined;
        await user.save({ validateBeforeSave: false });

        return next(new AppError('There was an error sending the email', 500));
    }
});

export const resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findOne({ _id: req.body.userID });
    if (!user) return next(new AppError('Invalid URL', 401));

    if (!user.passwordResetToken || user.resetTokenExpired()) return next(new AppError('URL has Expired', 401));
    if (!user.correctPasswordResetToken(req.body.token)) return next(new AppError('Invalid URL', 401));
    if (req.body.password !== req.body.confirmPassword) return next(new AppError('Passwords do not match', 400));

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpiresIn = undefined;
    await user.save();

    createSendToken(user, 200, res);
});

export const refresh = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const reqBody = req.body;

    const accessTokenString = reqBody.token;

    const accessToken = jwt.verify(accessTokenString, ENV.JWT_KEY) as jwt.JwtPayload;

    if (!accessToken || !accessToken.sub) {
        throw new AppError('Invalid access token', 401);
    }

    const userId = accessToken.sub;

    const user = await User.findById(userId);

    if (!user || user.id === undefined) {
        return res.status(401).json({ status: 'error', message: 'User of this token no longer exists' });
    }

    const refreshTokenString = req.cookies.refresh_token;

    if (!refreshTokenString) {
        return res.status(401).json({ status: 'error', message: 'Refresh token not provided' });
    }

    const refreshToken = jwt.verify(refreshTokenString, ENV.JWT_KEY) as jwt.JwtPayload;

    if (!refreshToken) {
        throw new AppError('Invalid refresh token', 401);
    }

    if (refreshToken.sub !== userId) {
        return res.status(401).json({ status: 'error', message: 'Mismatched Tokens' });
    }

    if (Date.now() > refreshToken.exp! * 1000) {
        return res.status(401).json({ status: 'error', message: 'Refresh token expired' });
    }

    const access_token = jwt.sign({ id: user._id }, ENV.JWT_KEY, {
        expiresIn: Number(ENV.ACCESS_TOKEN_TTL) * 60 * 60,
    });

    return res.status(200).json({ status: 'success', token: access_token });
});
