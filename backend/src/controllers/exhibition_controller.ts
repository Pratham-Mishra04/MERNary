import { NextFunction, Request, Response } from 'express';
import AppError from '../config/app_error';
import catchAsync from '../config/catch_async';
import Exhibition from '../models/exhibition_model';

export const getExhibitions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const exhibitions = await Exhibition.find();

    res.status(200).json({
        status: 'success',
        requestedAt: req.requestedAt,
        exhibitions,
    });
});

export const getExhibition = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const exhibition = await Exhibition.findById(req.params.exhibitionID).populate('user');
    if (!exhibition) return next(new AppError('No exhibition of this ID found', 400));

    res.status(200).json({
        status: 'success',
        requestedAt: req.requestedAt,
        exhibition,
    });
});

export const newExhibition = catchAsync(async (req: Request, res: Response) => {
    const exhibition = await Exhibition.create(req.body);
    res.status(201).json({
        status: 'success',
        requestedAt: req.requestedAt,
        exhibition,
    });
});

export const updateExhibition = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const exhibition = await Exhibition.findByIdAndUpdate(req.exhibition.id, req.body, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({
        status: 'success',
        requestedAt: req.requestedAt,
        exhibition,
    });
});

export const deleteExhibition = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    await Exhibition.findByIdAndDelete(req.exhibition.id);
    res.status(204).json({
        status: 'success',
        requestedAt: req.requestedAt,
        data: null,
    });
});