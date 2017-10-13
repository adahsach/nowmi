const fs     = require('fs')
const http   = require('http')
const spawn  = require('child_process').spawn
const crypto = require('crypto')

const port   = process.env.MAIN_PORT || 80
const sshPort= process.env.SSHD_PORT || 22
const creds  = process.env.WTTY_CRED || ''

let output = []

const main_page = fs.readFileSync('./src/index.html', 'utf8')
const wait_page = fs.readFileSync('./src/wait.html' , 'utf8')
const styles    = fs.readFileSync('./src/styles.css', 'utf8')

if (process.env.PROC_CHILD) {
  const [cmd, ...args ] = process.env.PROC_CHILD.split(' ')

  const child = spawn(cmd, args)
  // since these are streams, you can pipe them elsewhere
  // child.stderr.pipe(dest);
  child.stdout.on('data', chunk => {
    output.push(chunk.toString().replace(/\n/, ''))
    output = output.splice(-15,15)
  })
  child.on('close', code => output.push(`child exited code ${code}`))
}


const parsePost = request => new Promise (resolve => {
  const data = []

  request.on('data', chunk => {
    const str = chunk.length ? chunk.toString() : ''
    data.push(str)

    // Too much POST data, kill the connection!
    // 1e3 === 1000 ~~~ 1KB
    if (data.length > 1e3)
      request.connection.destroy()
  })

  request.on('end', () => {
    resolve(data.join('\n'))
  })
})

const checkCredentials = str => creds == crypto.createHash('sha512').update(str).digest('base64')
 
const runWetty = () => new Promise ((resolve, reject) => {
  const wetty = spawn('node', ['wetty/app.js','-p',port,'--sshport',sshPort])

  // wetty.stdout.on('data', chunk => console.log('wetty out:', chunk.toString()))
  // wetty.stderr.on('data', chunk => console.log('wetty err:', chunk.toString()))

  wetty.on('close', code => resolve( code ))
  wetty.on('exit' , code => resolve( code ))
  wetty.on('error', err  => reject( err ))
})

const server = http.createServer((request, response) => {
  if (request.method == 'POST')
    return parsePost(request)
      .then(post => {
        response.setHeader('Connection', 'close')
        response.end(wait_page)
        return post
       })
      .then(post => {
        if (checkCredentials(post)) 
          server.close(()=> runWetty().then(startListening))
      })

  if (request.method == 'GET') {
    if (request.url == '/styles.css'){
      response.setHeader('Content-Type','text/css')
      return response.end(styles)  
    }
  
    if (request.url == '/api/output') {
      response.setHeader('Content-Type'  , 'application/json')
      // response.setHeader('Content-Length', JSON.stringify(output).length )
      // response.setHeader('Set-Cookie'    , 'type=ninja')
      // response.statusCode    = 200
      return response.end(JSON.stringify(output)) 
    }
    
    if (request.url == '/api/env') {
      response.setHeader('Content-Type'  , 'application/json')
      return response.end(JSON.stringify(process.env)) 
    }

  }
  

  return response.end(main_page)
})

const startListening = () => server.listen(port, err => console.log(`Listening ${port}`, !err || err))
startListening()