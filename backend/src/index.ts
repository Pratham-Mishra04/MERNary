import * as cors from 'cors';
import * as express from 'express';
import { Express, NextFunction, Request, Response } from 'express';
import * as ExpressMongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import * as morgan from 'morgan';
import * as path from 'path';
import AppError from './config/app_error';
import connectToDB from './config/db';
import { ENV, configENV } from './config/env';
import ErrorController from './controllers/error_controller';
import authRouter from './routes/auth_routes';
import exhibitionRouter from './routes/exhibition_routes';
import userRouter from './routes/user_routes';

const server = async () => {
    configENV();

    await connectToDB();

    const app: Express = express();

    app.use(express.json());

    const allowedOrigins = [ENV.FRONTEND_URL, 'http://192.168.1.7:9966'];
    app.use(
        cors({
            allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization'],
            credentials: true,
            methods: ['GET', 'POST', 'PATCH', 'DELETE'],
            origin: function (origin, callback) {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
        })
    );

    app.use(
        helmet({
            crossOriginResourcePolicy: false,
        })
    );
    app.use(ExpressMongoSanitize());
    if (ENV.NODE_ENV === 'development') app.use(morgan('dev'));
    else app.use(morgan('short'));

    app.use(express.static(path.join(__dirname, '../public')));

    app.use((req: Request, res: Response, next: NextFunction) => {
        req.requestedAt = new Date().toISOString();
        next();
    });

    app.use('/', authRouter);
    app.use('/users', userRouter);
    app.use('/exhibitions', exhibitionRouter);

    app.all('*', (req: Request, res: Response, next: NextFunction) => {
        next(new AppError(`Cannot find ${req.originalUrl}`, 404));
    });

    app.use(ErrorController);

    app.listen(ENV.PORT, () => {
        console.log(`Server is running on http://127.0.0.1:${ENV.PORT}`);
    });
};

server();
