var express = require('express');
var http = require("http");
var router = express.Router();
var play = require('play');
//var SockJS = require('sockjs');
var SockJS = require('sockjs-client');



var usgsHOST = "earthquake.usgs.gov";

var usgsPATH = "/earthquakes/feed/v1.0/summary/1.0_hour.geojson";
//var usgsPATH = "/earthquakes/feed/v1.0/summary/4.5_hour.geojson";

//var usgsPATH = "/earthquakes/feed/v1.0/summary/all_day.geojson";
//var usgsPATH = "/earthquakes/feed/v1.0/summary/all_hour.geojson";
//var usgsPATH = "/earthquakes/feed/v1.0/summary/4.5_day.geojson";
//var usgsPATH = "/earthquakes/feed/v1.0/summary/4.5_hour.geojson";

global.downloadedSize = 0;
global.frequency = 60000//500; //default in milisec
global.pollCount = 0;

router.get('/getDownloadedSize', function(req, res) {
    res.send({"downloadedMBs":(global.downloadedSize)/(1024*1024)}).end();
});

router.get('/getdownloadRate', function(req, res) {
   
        var start = global.downloadedSize;
        setTimeout(function(){

            var finish = global.downloadedSize - start;
            res.send({"rate":finish/(1024*global.frequency)}).end();
        },global.frequency);

});

router.get('/setFrequency/:freq', function(req, res) {
    //console.log(req.params.freq);
    global.frequency = req.params.freq;
    res.send({"frequency":global.frequency}).end()
});


router.get('/startDetector', function(req, res) {

    if(!global.pollingStarted || global.pollingStarted === false){
        console.log("Polling Started");

        //Starting WebSock also
        try{

                // var echo = SockJS.createServer({ sockjs_url: 'http://www.seismicportal.eu/standing_order' });
                // echo.on('connection', function(conn) {
                    
                //     console.log("sockjs - connected");

                //     conn.on('data', function(message) {
                //         //conn.write(message);
                //         console.log("sock - message : " + message);
                //     });

                //     conn.on('close', function() {
                //         console.log("sockjs - disconnected");
                //     });

                // });


                var sock = new SockJS('http://www.seismicportal.eu/standing_order');

                    sock.onopen = function() {

                    console.log('sockjs - connected');

                };

                sock.onmessage = function(e) {

                    try{
                        msg = JSON.parse(e.data);
                    }
                    catch(err){
                        console.log("sockjs - parse error");
                        return;
                    }

                    console.log(Date() + ' sockjs - message received : ', msg);

                    if(msg.data.properties.mag > 6.0){
                            if(msg.data.properties.flynn_region.includes("Nepal") 
                            || msg.data.properties.flynn_region.includes("India")){

                                play.sound('/SAQUIB/gitHub/earthquake-detector/media/song.mp3');

                            }
                        } //mag comparison ends here                
                };

                sock.onclose = function() {

                    console.log('disconnected');

                };
        }
        catch(err){
            console.log("ws exception - " + err);
        }
        checkEQData();
        
        global.pollingStarted = true;
        
        res.send({"pollingStarted":"true"}).end();
        return;
    }

    res.send({"pollingCheck":"true"}).end();

});

function processGeoResponse(body){

    //console.log(lastGeoResponse);
    try{
        body = JSON.parse(body);
    }
    catch(err){
        console.log("jeo resp parse error - ");
        console.log(body);
        setTimeout(checkEQData,global.frequency);
        return;
    }
    
    //console.log(body.metadata);

    var currentCount = body.metadata.count;
    var currentTitle="";
    if(currentCount > 0){
        currentTitle = body.features[0].properties.title;
    }

    if(!global.lastTitle){
        global.lastTitle = currentTitle;
    }

    if(currentTitle !== "" && currentTitle !== global.lastTitle){

        global.lastTitle = currentTitle;

        console.log("New Earthquake Reported Alert! Alert! Alert!");
        
        var title = body.features[0].properties.title;
        
        var d = new Date(body.features[0].properties.time);
        console.log(Date() + " : " + title + " - " + d);

        if(body.features[0].properties.mag > 6.0){
            if(body.features[0].properties.title.includes("Nepal") 
                || body.features[0].properties.title.includes("India")){
                    
                    play.sound('/SAQUIB/gitHub/earthquake-detector/media/song.mp3');

            }
        } //mag comparison ends here                
    } //comparing the titles ends here
}

function checkEQData(){

    global.pollCount++;
    //console.log(global.pollCount + " polling....");
    var headers = {
                "Accept": "application/json"
            };

    var options = {
          "host": usgsHOST,
          "path": usgsPATH,
          "method": "GET",
          "headers":headers,
        };

    var request = http.request(options, function(resp) {

        //console.log("STATUS: " + resp.statusCode);
        //console.log("HEADERS: " + JSON.stringify(resp.headers));
        resp.setEncoding("utf8");

        var body="";
        resp.on("data", function (chunk) {
            //console.log("BODY: " + chunk);
            body+=chunk;
        });

        resp.on("end", function(){

            if(global.downloadedSize){
                global.downloadedSize += JSON.stringify(body).length
            }else{
                global.downloadedSize = JSON.stringify(body).length
            }
            
            processGeoResponse(body);

        }); //resp end


    });

    request.end();

    request.on('error',function(e){
        //console.log("Error: " + hostNames[i] + "\n" + e.message); 
        //console.log( e.stack );
        //res.status(500).end();
        console.log("error on request");
    });

    setTimeout(checkEQData,global.frequency);
}

module.exports = router;
