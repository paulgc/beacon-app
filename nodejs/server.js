var http = require('http'),
    fs = require('fs');

var app = http.createServer(function (request, response) {
    response.end('Hello World!')
}).listen(8080);
var redis = require('redis'),
    client = redis.createClient()

var proximity = require('geo-proximity').initialize(client)
var geolib = require('geolib')
var io = require('socket.io').listen(app);
var helper_candidates = new Object() // Helper to victim reverse map
var active_helpers = new Object()
var victim_to_helper = new Object()


function beacon_request_handler(data) {
  msg = data['message']
  console.log('beacon req : ' + JSON.stringify(msg))      
  
  victim_dev = msg['device'];
  if(!victim_to_helper.hasOwnProperty(victim_dev))
  {
      victim_to_helper[victim_dev] = new Array()
      
      proximity.nearby(msg['lat'], msg['long'], 500, function(err, locations)
      {
           if(err) console.error(err)
           else console.log('nearby locations:', locations)
           {
               if(active_helpers.hasOwnProperty(victim_dev)) {
                   delete active_helpers[victim_dev];
               }

               if(helper_candidates.hasOwnProperty(victim_dev)) {
                   delete helper_candidates[victim_dev];
               }
 
               for(var i=0; i < locations.length; i++) 
               {
                   helper = locations[i]
                   if(helper == victim_dev){
                       continue;
                   }
                 
                   if(!helper_candidates.hasOwnProperty(helper)) {
                     helper_candidates[helper] = new Array()
                   }
                 
                   helper_candidates[helper].push(victim_dev)
               }
           }
      });

  }
  
}

function find_dist(x1, y1, x2, y2)
{
    console.log(x1 + ',' + y1 +',' + x2 + ',' + y2);
    return geolib.getDistance(
               {latitude: x1, longitude: y1},
               {latitude: x2, longitude: y2}
           );
}

function end_beacon_request_handler(data) {

}

function heartbeat_handler(data) {
        msg = data['message']
        helper_dev = msg['device']
        helper_lat = msg['lat']
        helper_long = msg['long']
        console.log('heartbeat : ' + JSON.stringify(msg))
        proximity.updateLocation(helper_lat, helper_long, helper_dev, function(err, reply){
              if(err) console.error(err)
              else console.log('added location:', reply)
        });
        if(!victim_to_helper.hasOwnProperty(helper_dev)){
        if (!active_helpers.hasOwnProperty(helper_dev)) {
            if(helper_candidates.hasOwnProperty(helper_dev)) {
                victims = helper_candidates[helper_dev]
                if(victims.length > 0) { 
                        victim_index = -1
                        for(var i=0; i< victims.length; i++) {
                            if(helper_dev == victims[i]) {
                                continue;
                            }
                            victim_index = i;
                            break;
                        }
                        if (victim_index != -1) {
                		proximity.location(victims[victim_index], function(err, location){
                        		if(err) console.error(err)
                        		else  {
                                    		victim_lat = location.latitude
                                    		victim_long = location.longitude
                    		    		active_helpers[helper_dev] = victims[victim_index]
     	                               		msg_to_victim = {'lat' : victim_lat, 'long' : victim_long, 'victim' : victims[victim_index]}
                                    		io.sockets.in(helper_dev).emit("help_request", {message: msg_to_victim})
                                                victims.splice(victim_index, 1)
                        		}
                    		})
                        }
                }
            }
        }
        }
}

function accept_help_request_handler(data) {
        helper_dev = data['message']['device']
        victim_dev = data['message']['victim']
	if(active_helpers.hasOwnProperty(helper_dev)) {
		if (active_helpers[helper_dev] == victim_dev) {
			victim_to_helper[victim_dev].push(helper_dev)
		}	
	}
}

function reject_help_request_handler(data) {
	helper_dev = data['message']['device']
	victim_dev = data['message']['victim']
        if(active_helpers.hasOwnProperty(helper_dev)) {
                if (active_helpers[helper_dev] == victim_dev) {
                	delete active_helpers[helper_dev]; 
                }      
        }
}

function reject_accepted_help_request_handler(data) {
        helper_dev = data['message']['device']
        victim_dev = data['message']['victim']
        if(active_helpers.hasOwnProperty(helper_dev)) {
                if (active_helpers[helper_dev] == victim_dev) {
                        delete active_helpers[helper_dev];
                }      
        }
}

io.sockets.on('connection', function(socket) {
    socket.on('beacon_request', beacon_request_handler);
    socket.on('end_beacon_request', end_beacon_request_handler);
    socket.on('heartbeat', heartbeat_handler);
    socket.on('join', function (data) {
    	socket.join(data['device']);
        console.log('join : ' + data['device']);
    });
    socket.on('accept_help_request', accept_help_request_handler);
    socket.on('reject_help_request', reject_help_request_handler);
    socket.on('reject_accepted_help_request', reject_accepted_help_request_handler);
});
