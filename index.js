const {
    Pool
} = require('pg');
const express = require("express");
const {
    body,
    validationResult
} = require('express-validator');
const app = express();
const cors = require("cors");
const redis = require('redis');
const config = require('./config.json');


const publicCorsOptions = {
    origin: "*",
    optionsSuccessStatus: 200,
    credentials: true,
}

app.use(cors(publicCorsOptions));

app.use(express.json());

const postgresPool = new Pool({
    user: config.postgres.user,
    host: config.postgres.host,
    database: config.postgres.database,
    password: config.postgres.password,
    port: config.postgres.port,
    max: config.postgres.max,
});

const SORT_METHODS = {
    newest: " ORDER BY time_created DESC",
    oldest: " ORDER BY time_created ASC",
};

app.post('/get-farm', [

        body('farm_name')
            .notEmpty()
            .matches(/^[a-z1-5.]+$/).withMessage('Invalid farm_name format: only a-z, 1-5, and . are allowed')
            .isLength({ min: 1, max: 12 }).withMessage('farm_name length must be between 1 and 12 characters')                   

    ], async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const farm_name = req.body.farm_name;

    let postgresClient = null;

    try {

        postgresClient = await postgresPool.connect();

        try {

            let queryString = `
              SELECT *
              FROM tokenfarms_farms
              WHERE farm_name = $1
              LIMIT 1
            `;

            const selectResult = await postgresClient.query(queryString, [farm_name]);
            res.send({farm: selectResult.rows});     

        } catch (e) {
            console.log(e);
            res.status(500).send('Server error'); 
        }


    } catch (e) {
        console.log(e);
        res.status(500).send('Server error'); 
    } finally {
        if(postgresClient){
            postgresClient.release();
        }            
    }

});


app.post('/get-farms', [

        body('page').optional().isInt({
            min: 1
        }).withMessage('Page must be a positive integer'),

        body('limit').optional().isInt({
            min: 1,
            max: 100
        }).withMessage('Limit must be a positive integer and max 100'),

        body('sort').optional().isIn(Object.keys(SORT_METHODS)).withMessage('Invalid sort method'),

        body('creator')
            .optional()
            .matches(/^[a-z1-5.]+$/).withMessage('Invalid creator format: only a-z, 1-5, and . are allowed')
            .isLength({ min: 1, max: 12 }).withMessage('Creator length must be between 1 and 12 characters'),

        body('original_creator')
            .optional()
            .matches(/^[a-z1-5.]+$/).withMessage('Invalid original creator format: only a-z, 1-5, and . are allowed')
            .isLength({ min: 1, max: 12 }).withMessage('Original creator length must be between 1 and 12 characters')                   

    ], async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const creator = req.body.creator || "";
    const original_creator = req.body.original_creator || "";
    const page = req.body.page || 1;
    const limit = req.body.limit || 100;
    const sort = SORT_METHODS[req.body.sort] || SORT_METHODS["newest"];

    let postgresClient = null;

    try {

        postgresClient = await postgresPool.connect();

        try {

            let paramCounter = 0;
            let params = [];

            let queryString = `
              SELECT *
              FROM tokenfarms_farms
            `;

            if(creator != ""){
                queryString += ` WHERE creator = $${++paramCounter}`;
                params.push(creator);
            } else if(original_creator != ""){
                queryString += ` WHERE original_creator = $${++paramCounter}`;
                params.push(original_creator);                
            }

            queryString += `${sort} LIMIT ${limit} OFFSET ${(limit * page) - limit}`;

            const selectResult = await postgresClient.query(queryString, params);
            res.send({farms: selectResult.rows});     

        } catch (e) {
            console.log(e);
            res.status(500).send('Server error'); 
        }


    } catch (e) {
        console.log(e);
        res.status(500).send('Server error'); 
    } finally {
        if(postgresClient){
            postgresClient.release();
        }            
    }

});

app.post('/get-stakers', [

        body('page').optional().isInt({
            min: 1
        }).withMessage('Page must be a positive integer'),

        body('limit').optional().isInt({
            min: 1,
            max: 100
        }).withMessage('Limit must be a positive integer and max 100'),

        body('farm_name')
            .notEmpty()
            .matches(/^[a-z1-5.]+$/).withMessage('Invalid farm_name format: only a-z, 1-5, and . are allowed')
            .isLength({ min: 1, max: 12 }).withMessage('farm_name length must be between 1 and 12 characters')

    ], async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const farm_name = req.body.farm_name;
    const page = req.body.page || 1;
    const limit = req.body.limit || 100;

    let postgresClient = null;

    try {

        postgresClient = await postgresPool.connect();

        try {

            let paramCounter = 0;
            let params = [];

            let queryString = `
                SELECT *
                FROM tokenfarms_stakers
                WHERE farm_name = $${++paramCounter}
                ORDER BY balance_numeric DESC
                LIMIT $${++paramCounter} 
                OFFSET $${++paramCounter}
            `;

            params.push(farm_name, limit, (limit * page) - limit);

            const selectResult = await postgresClient.query(queryString, params);
            res.send({stakers: selectResult.rows});     

        } catch (e) {
            console.log(e);
            res.status(500).send('Server error'); 
        }


    } catch (e) {
        console.log(e);
        res.status(500).send('Server error'); 
    } finally {
        if(postgresClient){
            postgresClient.release();
        }            
    }

});

app.post('/staked-only', [

        body('page').optional().isInt({
            min: 1
        }).withMessage('Page must be a positive integer'),

        body('limit').optional().isInt({
            min: 1,
            max: 100
        }).withMessage('Limit must be a positive integer and max 100'),

        body('sort').optional().isIn(Object.keys(SORT_METHODS)).withMessage('Invalid sort method'),

        body('staker')
            .notEmpty()
            .matches(/^[a-z1-5.]+$/).withMessage('Invalid staker format: only a-z, 1-5, and . are allowed')
            .isLength({ min: 1, max: 12 }).withMessage('Staker length must be between 1 and 12 characters')

    ], async (req, res) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const staker = req.body.staker;
    const page = req.body.page || 1;
    const limit = req.body.limit || 100;
    const sort = SORT_METHODS[req.body.sort] || SORT_METHODS["newest"];

    let postgresClient = null;

    try {

        postgresClient = await postgresPool.connect();

        try {

            let paramCounter = 0;
            let params = [];

            let queryString = `
                SELECT 
                    farms.*, 
                    stakers.balance AS staker_balance, 
                    stakers.last_update_time AS staker_last_update_time
                FROM tokenfarms_stakers stakers
                JOIN tokenfarms_farms farms ON stakers.farm_name = farms.farm_name
                WHERE stakers.username = $${++paramCounter}
                ${sort}
                LIMIT $${++paramCounter} 
                OFFSET $${++paramCounter}
            `;

            params.push(staker, limit, (limit * page) - limit);

            const selectResult = await postgresClient.query(queryString, params);
            res.send({farms: selectResult.rows});     

        } catch (e) {
            console.log(e);
            res.status(500).send('Server error'); 
        }


    } catch (e) {
        console.log(e);
        res.status(500).send('Server error'); 
    } finally {
        if(postgresClient){
            postgresClient.release();
        }            
    }

});


app.listen(config.express.port, () => {
    console.log(`Token Farms API is running on ${config.express.port}`)
})