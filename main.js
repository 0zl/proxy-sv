'use strict'

const fs = require('fs')
const got = require('got').default
const yaml = require('yaml')
const fastq = require('fastq')
const express = require('express')
const { randomUUID } = require('crypto')

class Stellar {
    app = express()
    port = 3000
    conf = yaml.parse(fs.readFileSync('./stellar.yml', 'utf8'))
    endpoints = this.conf.endpoints
    status = { req: 0, res: 0, err: 0 }

    constructor() {
        this.port = this.conf.port
        this.endpoints = this.conf.endpoints.map(endpoint => ({
            id: randomUUID(),
            endpoint: endpoint,
            queue: fastq.promise(this, this.worker, this.conf.queue.max),
            count: [0, 0] // [success, fail]
        }))
    }

    getAllStatus() {
        return {
            status: this.status,
            endpoints: this.endpoints.map(endpoint => ({
                id: endpoint.id,
                queue: endpoint.queue.length(),
                count: endpoint.count
            }))
        }
    }

    getTheLeastBusyEndpoint() {
        return this.endpoints.sort((a, b) => a.queue.length() - b.queue.length())[0]
    }

    async emitRequest(method, url, headers, data) {
        const endpoint = this.getTheLeastBusyEndpoint()
        endpoint.count[0]++

        console.log(`--> ${endpoint.id} (${endpoint.queue.length()})`)
        return await endpoint.queue.push({ method, url, headers, data, endpoint: endpoint.endpoint })
    }

    async worker({ method, url, headers, data, endpoint }) {
        let response = null

        try {
            response = await got.post(endpoint + '/r', {
                json: { method, url, headers, data }
            })
        } catch (err) {
            console.error(err)
        }

        return response
    }

    startServer() {
        const secretHeader = this.conf.apiSecret.headers
        const secretKeys = this.conf.apiSecret.keys
        
        this.app.use(express.json())
        this.app.use(express.urlencoded({ extended: true }))

        this.app.use((req, res, next) => {
            if ( req.path === '/favicon.ico' ) return res.sendStatus(204)

            this.status.req++
            next()
        })

        this.app.use((req, res, next) => {
            if ( !secretHeader || req.method !== 'POST' ) return next()
            const stellarSecret = req.headers[secretHeader.toLowerCase()]

            if ( !stellarSecret ) {
                this.status.err++
                return res.sendStatus(401)
            }

            if ( !secretKeys.includes(stellarSecret) ) {
                this.status.err++
                return res.sendStatus(403)
            }

            next()
        })

        this.app.post('/r', async (req, res) => {
            const { method, url, headers, data } = req.body
            if ( !method || !url || !headers || !data ) return res.sendStatus(400)

            const response = await this.emitRequest(method, url, headers, data)
            if ( !response ) {
                this.status.err++
                return res.sendStatus(500)
            }

            this.status.res++
            
            const responseBody = JSON.parse(response.body)
            res.json({
                success: response.headers['x-success'],
                headers: responseBody.headers,
                body: JSON.parse(responseBody.body)
            })
        })

        this.app.all('*', (_, res) => res.json(this.getAllStatus()))
        this.app.listen(this.port, () => console.log(`Stellar is running on port ${this.port}`))
    }
}

function main() {
    const stellar = new Stellar()
    stellar.startServer()
}

main()