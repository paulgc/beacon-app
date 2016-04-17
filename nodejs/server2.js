var http = require('http'),
    fs = require('fs');
 
var app = http.createServer(function (request, response) {
    response.end('Hello World!')
}).listen(8080);
var redis = require('redis'),
    client = redis.createClient()

var proximity = require('geo-proximity').initialize(client) 
var io = require('socket.io').listen(app);
var hash = new Object()
var helper_candidates = new Object()
var active_helpers = new Object()
var global_helpers = new Object() 
 
io.sockets.on('connection', function(socket) {
    socket.on('beacon_request', function(data) {
        msg = data['message']
        console.log('beacon req : ' + JSON.stringify(msg))
        proximity.nearby(msg['lat'], msg['long'], 500, function(err, locations){
              if(err) console.error(err)
              else console.log('nearby locations:', locations)
              for(var i=0; i< locations.length; i++) {
                 if(locations[i] == msg['device']){
                   continue;
                 }
                 hash[locations[i]] = 1
                 if(!helper_candidates.hasOwnProperty(locations[i])) {
                     helper_candidates[locations[i]] = new Array()
                 }
                 helper_candidates[locations[i]]msg['device'] 
              }
        }) 
    });
    socket.on('end_beacon_request', function(data) {
        
    });
    socket.on('heartbeat', function(data) {
        msg = data['message']
        console.log('heartbeat : ' + JSON.stringify(msg))
        proximity.updateLocation(msg['lat'], msg['long'], msg['device'], function(err, reply){
              if(err) console.error(err)
              else console.log('added location:', reply)
        })
        if(hash.hasOwnProperty(msg['device'])) {
           io.sockets.emit("help_request", {message: 'hello'})
        }
    });
});
