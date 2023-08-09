'use strict'

const got = require('got').default
const express = require('express')

let countRequests = 0
async function redirectRequest(method, url, headers, data) {
    countRequests++
    console.log(`--> ${countRequests}`)
    
    return await got(url, {
        headers: headers,
        method: method,
        body: String(data),
        throwHttpErrors: true
    })
}

express()
    .use(express.json())
    .use(express.urlencoded({ extended: true }))

    .use((req, res, next) => {
        if ( req.path === '/favicon.ico' ) return res.sendStatus(204)
        next()
    })

    .post('/r', async (req, res) => {
        if ( !req.body ) return res.sendStatus(400)

        const { method, url, headers, data } = req.body
        if ( !method || !url || !headers || !data ) return res.sendStatus(400)

        try {
            const response = await redirectRequest(method, url, headers, data)
            res.header('x-success', true).json({
                headers: response.headers,
                body: response.body
            })
        } catch (err) {
            console.error(err)
            res.header('x-success', false).json({
                headers: err?.response.headers,
                body: err?.response.body
            })
        }
    })

    .get('/t', (_, res) => res.end('meow?'))

    .all('*', (_, res) => res.end('Stellar.'))
    .listen(7860, _ => console.log('Stellar Online.'))